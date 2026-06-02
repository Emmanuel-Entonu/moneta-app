import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

type CacsStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected'

const STEPS: { key: CacsStatus | 'submitted'; label: string; sub: string }[] = [
  { key: 'submitted', label: 'Form Submitted', sub: 'Your CACS form has been received' },
  { key: 'pending',   label: 'Under Review',   sub: 'Our team is verifying your details with PAC Securities' },
  { key: 'approved',  label: 'Account Activated', sub: 'Your NGX/CSCS trading account is live' },
]

function stepIndex(status: CacsStatus): number {
  if (status === 'not_submitted') return -1
  if (status === 'pending') return 1
  if (status === 'approved') return 2
  if (status === 'rejected') return -2
  return -1
}

export default function CacsStatus() {
  const navigate = useNavigate()
  const { cacsStatus, cacsDocUrl, cacsRejectionReason } = useAuthStore()
  const idx = stepIndex(cacsStatus)
  const isRejected = cacsStatus === 'rejected'

  return (
    <div style={{ minHeight: '100svh', background: '#070e1a', display: 'flex', flexDirection: 'column', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', paddingTop: 'calc(env(safe-area-inset-top,0px) + 14px)', background: '#050d1a', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <button onClick={() => navigate('/portfolio')} style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div>
          <p style={{ fontWeight: 900, fontSize: 17, color: '#fff', letterSpacing: -0.3 }}>Trading Account Status</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>CSCS / NGX Account</p>
        </div>
      </div>

      <div style={{ flex: 1, padding: '28px 20px', maxWidth: 560, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* Status badge */}
        {cacsStatus === 'approved' ? (
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#059669,#047857)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 0 48px rgba(5,150,105,0.5)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: -0.6, marginBottom: 6 }}>Trading Account Active</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Your NGX/CSCS account is live. You can now trade stocks on the exchange.</p>
          </div>
        ) : isRejected ? (
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#dc2626,#b91c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 0 40px rgba(220,38,38,0.4)' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: -0.6, marginBottom: 6 }}>Form Rejected</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 500, lineHeight: 1.6 }}>There was an issue with your submission. Please resubmit with a corrected, signed form.</p>
            {cacsRejectionReason && (
              <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 12, background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', textAlign: 'left' }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>Reason</p>
                <p style={{ fontSize: 14, fontWeight: 600, color: '#fff', lineHeight: 1.5 }}>{cacsRejectionReason}</p>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(251,191,36,0.15)', border: '3px solid rgba(251,191,36,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 0 40px rgba(251,191,36,0.2)' }}>
              <div style={{ width: 28, height: 28, border: '3px solid #fbbf24', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1.2s linear infinite' }} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: -0.6, marginBottom: 6 }}>Under Review</h2>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', fontWeight: 500, lineHeight: 1.6 }}>Your CACS form is being reviewed. This typically takes <strong style={{ color: '#fff' }}>1–3 business days</strong>.</p>
          </div>
        )}

        {/* Progress timeline */}
        {!isRejected && (
          <div style={{ background: '#0e1c2f', borderRadius: 20, padding: '24px 20px', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 20 }}>
            {STEPS.map((step, i) => {
              const done = idx >= i + 1
              const active = idx === i || (i === 0 && idx >= 1)
              const bgColor = done ? 'rgba(5,150,105,0.25)' : active ? 'rgba(5,150,105,0.15)' : 'rgba(255,255,255,0.05)'
              const borderColor = done || active ? 'rgba(5,150,105,0.5)' : 'rgba(255,255,255,0.1)'
              return (
                <div key={step.key} style={{ display: 'flex', gap: 14, position: 'relative' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: '50%', background: bgColor, border: `2px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
                      {done ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      ) : active ? (
                        <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#34d399', animation: 'pulse 1.5s ease infinite' }} />
                      ) : (
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.25)' }}>{i + 1}</span>
                      )}
                    </div>
                    {i < STEPS.length - 1 && (
                      <div style={{ width: 2, flex: 1, minHeight: 28, background: done ? 'rgba(5,150,105,0.5)' : 'rgba(255,255,255,0.08)', margin: '4px 0' }} />
                    )}
                  </div>
                  <div style={{ paddingBottom: i < STEPS.length - 1 ? 20 : 0, paddingTop: 6 }}>
                    <p style={{ fontSize: 14, fontWeight: 800, color: done || active ? '#fff' : 'rgba(255,255,255,0.3)', marginBottom: 3 }}>{step.label}</p>
                    <p style={{ fontSize: 12, color: done || active ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.2)', fontWeight: 500, lineHeight: 1.5 }}>{step.sub}</p>
                    {active && step.key === 'pending' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '4px 10px', borderRadius: 20, background: 'rgba(251,191,36,0.15)', border: '1px solid rgba(251,191,36,0.3)', fontSize: 11, fontWeight: 700, color: '#fbbf24' }}>
                        In Progress
                      </span>
                    )}
                    {done && step.key !== 'approved' && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6, padding: '4px 10px', borderRadius: 20, background: 'rgba(5,150,105,0.15)', border: '1px solid rgba(5,150,105,0.3)', fontSize: 11, fontWeight: 700, color: '#34d399' }}>
                        Complete
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Info box */}
        {cacsStatus === 'pending' && (
          <div style={{ background: 'rgba(59,130,246,0.08)', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(59,130,246,0.2)', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500, lineHeight: 1.6 }}>
              You can browse the market and explore stocks while your account is being reviewed. Trading will be enabled automatically once approved.
            </p>
          </div>
        )}

        {/* Submitted doc link */}
        {cacsDocUrl && (
          <div style={{ background: '#0e1c2f', borderRadius: 14, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.07)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2 }}>Submitted Document</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>CACS Form PDF</p>
            </div>
            <a href={cacsDocUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 700, color: '#60a5fa', textDecoration: 'none' }}>View</a>
          </div>
        )}

        {/* Action buttons */}
        {cacsStatus === 'approved' && (
          <button onClick={() => navigate('/market')} style={{ width: '100%', padding: '16px', borderRadius: 18, background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff', fontWeight: 900, fontSize: 16, cursor: 'pointer', boxShadow: '0 6px 24px rgba(5,150,105,0.38)', border: 'none' }}>
            Start Trading
          </button>
        )}
        {(cacsStatus === 'rejected' || cacsStatus === 'not_submitted') && (
          <button onClick={() => navigate('/cacs')} style={{ width: '100%', padding: '16px', borderRadius: 18, background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff', fontWeight: 900, fontSize: 16, cursor: 'pointer', boxShadow: '0 6px 24px rgba(5,150,105,0.38)', border: 'none' }}>
            {cacsStatus === 'rejected' ? 'Resubmit Form' : 'Submit Form'}
          </button>
        )}
        {cacsStatus === 'pending' && (
          <button onClick={() => navigate('/portfolio')} style={{ width: '100%', padding: '16px', borderRadius: 18, background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', fontWeight: 700, fontSize: 15, cursor: 'pointer', border: '1px solid rgba(255,255,255,0.12)' }}>
            Back to Portfolio
          </button>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(0.85); } }
      `}</style>
    </div>
  )
}
