import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 46, height: 26, borderRadius: 13, flexShrink: 0,
        background: on ? '#059669' : '#e2e8f0',
        position: 'relative', border: 'none', cursor: 'pointer',
        transition: 'background 0.2s',
      }}
    >
      <div style={{
        position: 'absolute', top: 3,
        left: on ? 23 : 3,
        width: 20, height: 20, borderRadius: '50%',
        background: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
        transition: 'left 0.2s cubic-bezier(0.34,1.56,0.64,1)',
      }} />
    </button>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 800, color: '#94a3b8',
      textTransform: 'uppercase', letterSpacing: 1,
      padding: '20px 20px 8px',
    }}>
      {label}
    </p>
  )
}

function SettingsCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      margin: '0 16px',
      background: '#fff',
      borderRadius: 18,
      border: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      {children}
    </div>
  )
}

function Row({
  icon, label, sub, right, onPress, danger, last,
}: {
  icon: React.ReactNode
  label: string
  sub?: string
  right?: React.ReactNode
  onPress?: () => void
  danger?: boolean
  last?: boolean
}) {
  return (
    <button
      onClick={onPress}
      disabled={!onPress && !right}
      style={{
        width: '100%', textAlign: 'left', cursor: onPress ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px',
        background: 'none', border: 'none',
        borderBottom: last ? 'none' : '1px solid #f1f5f9',
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
        background: danger ? '#fff5f5' : '#f0fdf4',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 700, color: danger ? '#dc2626' : 'var(--text)', lineHeight: 1.2 }}>{label}</p>
        {sub && <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, marginTop: 2 }}>{sub}</p>}
      </div>
      {right ?? (onPress && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      ))}
    </button>
  )
}

function read(key: string, fallback: boolean) {
  const v = localStorage.getItem(key)
  return v === null ? fallback : v === 'true'
}
function save(key: string, v: boolean) { localStorage.setItem(key, String(v)) }

export default function Settings() {
  const navigate = useNavigate()
  const { user, kycStatus, signOut } = useAuthStore()

  const [notifPriceAlerts,  setNotifPriceAlerts]  = useState(() => read('moneta_notif_price_alerts', true))
  const [notifOrders,       setNotifOrders]        = useState(() => read('moneta_notif_orders', true))
  const [notifPortfolio,    setNotifPortfolio]     = useState(() => read('moneta_notif_portfolio', true))
  const [notifNews,         setNotifNews]          = useState(() => read('moneta_notif_news', false))
  const [confirmOrders,     setConfirmOrders]      = useState(() => read('moneta_pref_confirm_orders', true))

  const [changingPw, setChangingPw] = useState(false)
  const [pwEmail, setPwEmail]       = useState('')
  const [pwMsg, setPwMsg]           = useState<{ ok: boolean; text: string } | null>(null)

  const [showSignOut, setShowSignOut] = useState(false)

  function toggle(setter: (v: boolean) => void, key: string) {
    return (v: boolean) => { setter(v); save(key, v) }
  }

  async function sendResetEmail() {
    if (!pwEmail.trim()) return
    setChangingPw(true); setPwMsg(null)
    const { error } = await supabase.auth.resetPasswordForEmail(pwEmail.trim(), {
      redirectTo: `${window.location.origin}/login`,
    })
    setChangingPw(false)
    setPwMsg(error
      ? { ok: false, text: error.message }
      : { ok: true, text: 'Password reset link sent — check your email.' }
    )
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const kycLabel = { pending: 'Pending', submitted: 'Under Review', verified: 'Verified', rejected: 'Rejected' }[kycStatus]
  const kycColor = { pending: '#f59e0b', submitted: '#3b82f6', verified: '#059669', rejected: '#dc2626' }[kycStatus]

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #050d1a 0%, #0c1526 65%, #022c22 100%)',
        padding: 'calc(env(safe-area-inset-top,0px) + 14px) 20px 18px',
        display: 'flex', alignItems: 'center', gap: 14,
        position: 'sticky', top: 0, zIndex: 40,
        borderBottom: '1px solid rgba(5,150,105,0.2)',
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0,
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div>
          <p style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: -0.4 }}>Settings</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{user?.email}</p>
        </div>
      </div>

      {/* ACCOUNT */}
      <SectionHeader label="Account" />
      <SettingsCard>
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
          label="My Profile"
          sub="Edit personal information"
          onPress={() => navigate('/profile')}
        />
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
          label="KYC Verification"
          sub={`Status: ${kycLabel}`}
          onPress={() => navigate('/kyc')}
          right={
            <span style={{ fontSize: 11, fontWeight: 700, color: kycColor, background: kycColor + '18', padding: '3px 10px', borderRadius: 20 }}>
              {kycLabel}
            </span>
          }
          last
        />
      </SettingsCard>

      {/* SECURITY */}
      <SectionHeader label="Security" />
      <SettingsCard>
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
          label="Change Password"
          sub="Send a reset link to your email"
          onPress={() => setChangingPw((v) => !v)}
        />
        {changingPw && (
          <div style={{ padding: '0 16px 16px' }}>
            <input
              type="email"
              className="input-field"
              placeholder={user?.email ?? 'your@email.com'}
              value={pwEmail}
              onChange={(e) => setPwEmail(e.target.value)}
              style={{ marginBottom: 10 }}
            />
            {pwMsg && (
              <p style={{ fontSize: 12, fontWeight: 600, color: pwMsg.ok ? '#059669' : '#dc2626', marginBottom: 10 }}>
                {pwMsg.text}
              </p>
            )}
            <button
              onClick={sendResetEmail}
              style={{
                width: '100%', padding: '12px', borderRadius: 12,
                background: 'linear-gradient(135deg,#059669,#047857)',
                color: '#fff', fontWeight: 700, fontSize: 13,
                boxShadow: '0 4px 14px rgba(5,150,105,0.3)',
              }}
            >
              Send Reset Link
            </button>
          </div>
        )}
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>}
          label="Two-Factor Authentication"
          sub="Coming soon"
          right={<span style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', background: '#f1f5f9', padding: '3px 10px', borderRadius: 20 }}>Soon</span>}
          last
        />
      </SettingsCard>

      {/* NOTIFICATIONS */}
      <SectionHeader label="Notifications" />
      <SettingsCard>
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
          label="Price Alerts"
          sub="Get notified on significant price moves"
          right={<Toggle on={notifPriceAlerts} onChange={toggle(setNotifPriceAlerts, 'moneta_notif_price_alerts')} />}
        />
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
          label="Order Updates"
          sub="Confirmations, fills, and rejections"
          right={<Toggle on={notifOrders} onChange={toggle(setNotifOrders, 'moneta_notif_orders')} />}
        />
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>}
          label="Portfolio Summary"
          sub="Daily P&L and performance digest"
          right={<Toggle on={notifPortfolio} onChange={toggle(setNotifPortfolio, 'moneta_notif_portfolio')} />}
        />
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2"/><path d="M2 8l2 2 4-4"/></svg>}
          label="Market News"
          sub="NGX announcements and company filings"
          right={<Toggle on={notifNews} onChange={toggle(setNotifNews, 'moneta_notif_news')} />}
          last
        />
      </SettingsCard>

      {/* TRADING PREFERENCES */}
      <SectionHeader label="Trading Preferences" />
      <SettingsCard>
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
          label="Order Confirmation Modal"
          sub="Review order details before submitting"
          right={<Toggle on={confirmOrders} onChange={toggle(setConfirmOrders, 'moneta_pref_confirm_orders')} />}
          last
        />
      </SettingsCard>

      {/* SUPPORT & LEGAL */}
      <SectionHeader label="Support & Legal" />
      <SettingsCard>
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>}
          label="Help Center"
          sub="FAQs, guides, and tutorials"
          onPress={() => window.open('mailto:support@moneta.ng', '_blank')}
        />
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>}
          label="Contact Support"
          sub="support@moneta.ng"
          onPress={() => window.open('mailto:support@moneta.ng', '_blank')}
        />
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
          label="Terms of Service"
          onPress={() => {}}
        />
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>}
          label="Privacy Policy"
          onPress={() => {}}
        />
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>}
          label="SEC Regulatory Disclosure"
          sub="Digital Sub-Broker · PAC Securities"
          onPress={() => {}}
          last
        />
      </SettingsCard>

      {/* ABOUT */}
      <SectionHeader label="About" />
      <SettingsCard>
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>}
          label="App Version"
          sub="Moneta Alpha 0.1.0"
          right={<span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>v0.1.0</span>}
          last
        />
      </SettingsCard>

      {/* SIGN OUT */}
      <SectionHeader label="Account Actions" />
      <SettingsCard>
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
          label="Sign Out"
          danger
          onPress={() => setShowSignOut(true)}
          last
        />
      </SettingsCard>

      {/* Sign out confirm sheet */}
      {showSignOut && (
        <>
          <div
            onClick={() => setShowSignOut(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, backdropFilter: 'blur(4px)' }}
          />
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101,
            background: '#fff', borderRadius: '24px 24px 0 0',
            padding: '24px 20px calc(env(safe-area-inset-bottom,0px) + 28px)',
            maxWidth: 480, margin: '0 auto',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
          }}>
            <div style={{ width: 36, height: 4, background: '#e2e8f0', borderRadius: 2, margin: '0 auto 24px' }} />
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 18, background: '#fee2e2',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px',
              }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </div>
              <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Sign out?</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                You'll need to sign back in to access your portfolio and place trades.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setShowSignOut(false)}
                style={{ flex: 1, padding: '14px', borderRadius: 14, background: '#f8fafc', border: '1.5px solid var(--border)', fontWeight: 700, fontSize: 15, color: 'var(--text)', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleSignOut}
                style={{ flex: 1, padding: '14px', borderRadius: 14, background: 'linear-gradient(135deg,#dc2626,#b91c1c)', fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 16px rgba(220,38,38,0.3)' }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
