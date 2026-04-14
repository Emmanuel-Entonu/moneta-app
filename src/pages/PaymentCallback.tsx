import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { verifyPayment } from '../lib/monetaApi'
import { useAuthStore } from '../store/authStore'
import { usePortfolioStore } from '../store/portfolioStore'
import MonetaLogo from '../components/MonetaLogo'
import type { PacOrderRequest } from '../lib/pacApi'

export default function PaymentCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying')
  const [message, setMessage] = useState('')
  const [amount, setAmount] = useState(0)
  const [orderSymbol, setOrderSymbol] = useState<string | null>(null)
  const [orderFailed, setOrderFailed] = useState(false)
  const creditWallet = useAuthStore((s) => s.creditWallet)
  const debitWallet  = useAuthStore((s) => s.debitWallet)
  const authLoading  = useAuthStore((s) => s.loading)
  const ran = useRef(false)

  // Detect when we're loaded inside the in-app browser (Custom Tab) rather than
  // the Capacitor WebView. The callback URL includes ?source=native on native builds.
  // Custom Tab: source=native AND Capacitor.isNativePlatform() = false (it's Chrome, not our app).
  // WebView:    source=native AND Capacitor.isNativePlatform() = true  → process normally.
  const isInsideCustomTab = params.get('source') === 'native' && !Capacitor.isNativePlatform()

  useEffect(() => {
    // Don't process anything inside the Custom Tab — the WebView handles it
    if (isInsideCustomTab) return
    // Wait until auth has restored the session — creditWallet needs user to be set
    if (authLoading) return
    // Guard against StrictMode double-fire
    if (ran.current) return
    ran.current = true

    const ref = params.get('reference') ?? params.get('txnref') ?? params.get('ref_no') ?? ''
    // Read the amount WE sent to Moneta — stored at payment initiation
    const savedAmount = parseFloat(
      params.get('expected') ?? localStorage.getItem('moneta_pending_amount') ?? '0'
    )
    if (!ref) { setStatus('failed'); setMessage('No payment reference found.'); return }
    // navigateToCallback in App.tsx already removed these, but clean up defensively
    localStorage.removeItem('moneta_pending_ref')
    localStorage.removeItem('moneta_pending_amount')

    verifyPayment(ref)
      .then(async (result) => {
        if (!result.success) {
          // Clean up any pending order — don't let it execute on a future successful payment
          localStorage.removeItem('moneta_pending_order')
          setStatus('failed')
          setMessage(result.message || 'Payment was not completed.')
          return
        }

        // Always use the amount we originally sent — Moneta's verify response
        // returns naira but our code was dividing by 100 (treating it as kobo),
        // causing ₦100 to be credited as ₦1.
        const amountToCredit = savedAmount > 0 ? savedAmount : result.amountNaira
        await creditWallet(amountToCredit)

        // If this payment was for a specific stock order (from Trade page),
        // execute the order then debit the wallet — but ONLY debit if the order succeeded.
        const pendingRaw = localStorage.getItem('moneta_pending_order')
        if (pendingRaw) {
          localStorage.removeItem('moneta_pending_order')
          try {
            const order = JSON.parse(pendingRaw) as PacOrderRequest
            setOrderSymbol(order.symbol)
            await usePortfolioStore.getState().placeOrder(order)

            // placeOrder catches errors internally and never throws — check the store result
            const orderResult = usePortfolioStore.getState().orderResult
            if (orderResult?.success) {
              // Order went through — debit the wallet for the purchase
              await debitWallet(amountToCredit)
            } else {
              // Order failed — money stays in wallet, user can retry from Portfolio
              setOrderFailed(true)
              console.error('[PaymentCallback] order failed:', orderResult?.message)
            }
          } catch (e) {
            // Unexpected error parsing the order — money stays in wallet
            setOrderFailed(true)
            console.error('[PaymentCallback] pending order error:', e)
          }
        }

        setStatus('success')
        setAmount(amountToCredit)
        setMessage(result.message)
      })
      .catch((e: Error) => {
        setStatus('failed')
        setMessage(e.message)
      })
  }, [authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Custom Tab: Moneta redirected here inside the in-app browser.
  // Show a simple "payment done" screen. The Capacitor WebView handles all processing.
  if (isInsideCustomTab) {
    return (
      <div style={{
        minHeight: '100svh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#fff', padding: '32px 24px', textAlign: 'center',
      }}>
        <MonetaLogo size="md" />
        <div style={{ marginTop: 40 }}>
          <div style={{
            width: 80, height: 80, borderRadius: '50%',
            background: 'linear-gradient(135deg, #059669, #047857)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: '0 8px 24px rgba(5,150,105,0.3)',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>
            Payment Complete
          </h2>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Returning to Moneta…
          </p>
        </div>
      </div>
    )
  }

  // ── WebView: full verification and wallet credit flow
  return (
    <div style={{
      minHeight: '100svh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#fff', padding: '32px 24px', textAlign: 'center',
    }}>
      <MonetaLogo size="md" />

      <div style={{ marginTop: 40 }}>
        {status === 'verifying' && (
          <>
            <div style={{
              width: 56, height: 56, borderRadius: '50%',
              border: '3px solid #d1fae5', borderTopColor: '#059669',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 20px',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Verifying payment…</p>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 6 }}>Please wait</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: orderFailed
                ? '#fef3c7'
                : 'linear-gradient(135deg, #059669, #047857)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: orderFailed ? 'none' : '0 8px 24px rgba(5,150,105,0.3)',
            }}>
              {orderFailed ? (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              ) : (
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>

            <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>
              {orderFailed ? 'Order Failed' : orderSymbol ? 'Order Placed!' : 'Payment Successful!'}
            </h2>
            <p style={{ fontSize: 28, fontWeight: 900, color: orderFailed ? '#d97706' : '#059669', marginBottom: 8 }}>
              ₦{amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32 }}>
              {orderFailed
                ? `Your payment was received but the ${orderSymbol ?? 'stock'} order could not be placed. Your funds are safe in your wallet — retry from Portfolio.`
                : orderSymbol
                  ? `Your ${orderSymbol} buy order has been placed successfully`
                  : 'Your wallet has been funded successfully'}
            </p>
            <button
              onClick={() => navigate('/portfolio')}
              style={{
                padding: '14px 32px', borderRadius: 'var(--radius)',
                background: 'linear-gradient(135deg, #059669, #047857)',
                color: '#fff', fontSize: 15, fontWeight: 700,
                border: 'none', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(5,150,105,0.3)',
              }}
            >
              View Portfolio
            </button>
          </>
        )}

        {status === 'failed' && (
          <>
            <div style={{
              width: 80, height: 80, borderRadius: '50%',
              background: '#fee2e2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>
              Payment Failed
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32 }}>{message}</p>
            <button
              onClick={() => navigate('/portfolio')}
              style={{
                padding: '14px 32px', borderRadius: 'var(--radius)',
                border: '1.5px solid var(--border)',
                background: '#fff', color: 'var(--text)',
                fontSize: 15, fontWeight: 700, cursor: 'pointer',
              }}
            >
              Go Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}
