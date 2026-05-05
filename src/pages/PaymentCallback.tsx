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

  // Read URL params once — these are stable for the component's lifetime
  const ref         = params.get('reference') ?? params.get('txnref') ?? params.get('ref_no') ?? ''
  const expectedStr = params.get('expected') ?? ''

  // isNativePlatform() = true  → we're in the Capacitor WebView → do full verification
  // isNativePlatform() = false → we're in Chrome Custom Tab or desktop browser
  //   If moneta_pending_ref exists in localStorage → desktop/web browser → do full verification
  //   If moneta_pending_ref is absent → Chrome Custom Tab (separate storage from WebView) → redirect to app
  const isInsideCustomTab = !Capacitor.isNativePlatform() && !localStorage.getItem('moneta_pending_ref')

  // Custom Tab: redirect to moneta:// scheme immediately → Android closes tab and opens app
  useEffect(() => {
    if (!isInsideCustomTab) return
    const returnUrl = `moneta://payment/callback?reference=${encodeURIComponent(ref)}&expected=${encodeURIComponent(expectedStr)}`
    window.location.href = returnUrl
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // WebView / web: full verification flow
  useEffect(() => {
    if (isInsideCustomTab) return
    if (authLoading) return
    if (!useAuthStore.getState().user) {
      setStatus('failed')
      setMessage('Session expired. Please sign in and use "Payment debited but wallet not updated?" on the Portfolio page to recover your funds.')
      return
    }
    if (ran.current) return
    ran.current = true

    if (!ref) { setStatus('failed'); setMessage('No payment reference found.'); return }

    // Claim amount — URL param takes priority (set by claimAndNavigate), else localStorage
    const savedAmount = parseFloat(expectedStr || localStorage.getItem('moneta_pending_amount') || '0')

    // Claim pending order NOW before any async work — prevents it executing on a future payment
    // if anything below throws (e.g. creditWallet fails due to network error)
    const pendingRaw = localStorage.getItem('moneta_pending_order')
    localStorage.removeItem('moneta_pending_order')
    localStorage.removeItem('moneta_pending_ref')
    localStorage.removeItem('moneta_pending_amount')

    async function verifyWithRetry(): Promise<Awaited<ReturnType<typeof verifyPayment>>> {
      let lastResult: Awaited<ReturnType<typeof verifyPayment>> | null = null
      let lastError: Error | null = null
      for (let i = 0; i < 5; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, 3000))
        try {
          const result = await verifyPayment(ref)
          if (result.success) return result
          lastResult = result
        } catch (e) {
          lastError = e as Error
        }
      }
      if (lastError) throw lastError
      return lastResult!
    }

    verifyWithRetry()
      .then(async (result) => {
        const resolvedAmount = savedAmount > 0 ? savedAmount : result.amountNaira
        if (!result.success || resolvedAmount === 0) {
          setStatus('failed')
          setMessage(
            result.success
              ? 'Payment was not completed — no funds were collected.'
              : 'Your payment could not be confirmed yet. If money was debited, use "Payment debited but wallet not updated?" on the Portfolio page to recover your funds.',
          )
          return
        }

        // Guard: user must be authenticated before crediting wallet
        const user = useAuthStore.getState().user
        if (!user) {
          setStatus('failed')
          setMessage('Session expired. Please contact support — your payment was received.')
          return
        }

        await creditWallet(resolvedAmount)

        if (pendingRaw) {
          try {
            const order = JSON.parse(pendingRaw) as PacOrderRequest
            setOrderSymbol(order.symbol)
            await usePortfolioStore.getState().placeOrder(order)
            const orderResult = usePortfolioStore.getState().orderResult
            if (orderResult?.success) {
              await debitWallet(resolvedAmount)
            } else {
              setOrderFailed(true)
            }
          } catch {
            setOrderFailed(true)
          }
        }

        setStatus('success')
        setAmount(resolvedAmount)
        setMessage(result.message)
      })
      .catch((e: Error) => {
        setStatus('failed')
        setMessage(e.message ?? 'Verification failed. Use "Payment debited but wallet not updated?" to recover.')
      })
  }, [authLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Custom Tab UI: "Returning to Moneta…" while moneta:// redirect fires
  if (isInsideCustomTab) {
    const returnUrl = `moneta://payment/callback?reference=${encodeURIComponent(ref)}&expected=${encodeURIComponent(expectedStr)}`
    return (
      <div style={{
        minHeight: '100svh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: '#fff', padding: '32px 24px', textAlign: 'center',
      }}>
        <MonetaLogo size="md" />
        <div style={{ marginTop: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            border: '3px solid #d1fae5', borderTopColor: '#059669',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 20px',
          }} />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>Returning to Moneta…</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>
            Close this browser tab to continue
          </p>
          <a
            href={returnUrl}
            style={{ display: 'block', marginTop: 16, color: '#059669', fontWeight: 600, fontSize: 13 }}
          >
            Or tap here to open Moneta
          </a>
        </div>
      </div>
    )
  }

  // ── WebView / web: verification UI
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
              animation: 'spin 0.8s linear infinite', margin: '0 auto 20px',
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
              background: orderFailed ? '#fef3c7' : 'linear-gradient(135deg, #059669, #047857)',
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
                ? `Your payment was received but the ${orderSymbol ?? 'stock'} order could not be placed. Your funds are safe in your wallet.`
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
              width: 80, height: 80, borderRadius: '50%', background: '#fee2e2',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 8 }}>Payment Failed</h2>
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
