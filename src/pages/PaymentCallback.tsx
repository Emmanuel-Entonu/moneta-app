import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { verifyPayment } from '../lib/monetaApi'
import { useAuthStore } from '../store/authStore'
import MonetaLogo from '../components/MonetaLogo'

export default function PaymentCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'verifying' | 'success' | 'failed'>('verifying')
  const [message, setMessage] = useState('')
  const [amount, setAmount] = useState(0)
  const creditWallet = useAuthStore((s) => s.creditWallet)

  useEffect(() => {
    const ref = params.get('reference') ?? params.get('txnref') ?? params.get('ref_no') ?? ''
    if (!ref) { setStatus('failed'); setMessage('No payment reference found.'); return }

    verifyPayment(ref)
      .then(async (result) => {
        if (result.success) {
          // Credit the real wallet balance in Supabase
          await creditWallet(result.amountNaira)
          setStatus('success')
          setAmount(result.amountNaira)
          setMessage(result.message)
        } else {
          setStatus('failed')
          setMessage(result.message)
        }
      })
      .catch((e: Error) => {
        setStatus('failed')
        setMessage(e.message)
      })
  }, [])

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
              Payment Successful!
            </h2>
            <p style={{ fontSize: 28, fontWeight: 900, color: '#059669', marginBottom: 8 }}>
              ₦{amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </p>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32 }}>
              Your wallet has been funded successfully
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
