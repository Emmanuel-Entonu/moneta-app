import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

type KYCStatus = 'pending' | 'submitted' | 'verified' | 'rejected'

interface ProfileData {
  full_name: string
  phone: string
  date_of_birth: string
  address: string
}

const KYC_CONFIG: Record<KYCStatus, { label: string; sub: string; color: string; dot: string; border: string; bg: string }> = {
  pending:   { label: 'KYC Required',  sub: 'Complete verification to unlock trading', color: '#92400e', dot: '#f59e0b', border: '#fde68a', bg: '#fffbeb' },
  submitted: { label: 'Under Review',  sub: 'Typically takes 1–2 business days',       color: '#1e40af', dot: '#3b82f6', border: '#bfdbfe', bg: '#eff6ff' },
  verified:  { label: 'Verified',      sub: 'Fully approved to trade on the NGX',      color: '#065f46', dot: '#059669', border: '#a7f3d0', bg: '#f0fdf4' },
  rejected:  { label: 'KYC Rejected',  sub: 'Please re-submit with valid documents',   color: '#991b1b', dot: '#dc2626', border: '#fecaca', bg: '#fff5f5' },
}

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

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      margin: '0 16px', background: '#fff',
      borderRadius: 18, border: '1px solid var(--border)', overflow: 'hidden',
    }}>
      {children}
    </div>
  )
}

function Row({
  icon, label, sub, right, onPress, danger, last,
}: {
  icon: React.ReactNode; label: string; sub?: string
  right?: React.ReactNode; onPress?: () => void; danger?: boolean; last?: boolean
}) {
  return (
    <button
      onClick={onPress}
      disabled={!onPress && right !== undefined}
      style={{
        width: '100%', textAlign: 'left', cursor: onPress ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px', background: 'none', border: 'none',
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

function ProfileField({ label, value, onChange, type = 'text', multiline, last, readOnly }: {
  label: string; value: string; onChange: (v: string) => void
  type?: string; multiline?: boolean; last?: boolean; readOnly?: boolean
}) {
  return (
    <div style={{
      borderBottom: last ? 'none' : '1px solid #f1f5f9',
      padding: '12px 18px',
      background: readOnly ? '#fff' : '#fafcff',
    }}>
      <p style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
        {label}
      </p>
      {readOnly ? (
        <p style={{ fontSize: 14, fontWeight: 500, color: value ? 'var(--text)' : 'var(--text-muted)' }}>
          {value || '—'}
        </p>
      ) : multiline ? (
        <textarea
          value={value} onChange={(e) => onChange(e.target.value)}
          rows={2}
          style={{ width: '100%', background: 'none', border: 'none', resize: 'none', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, color: 'var(--text)', outline: 'none' }}
        />
      ) : (
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          style={{ width: '100%', background: 'none', border: 'none', fontSize: 14, fontWeight: 500, color: 'var(--text)', outline: 'none' }}
        />
      )}
    </div>
  )
}

function read(key: string, fallback: boolean) {
  const v = localStorage.getItem(key)
  return v === null ? fallback : v === 'true'
}
function persist(key: string, v: boolean) { localStorage.setItem(key, String(v)) }

export default function Settings() {
  const navigate = useNavigate()
  const { user, kycStatus, signOut } = useAuthStore()

  const empty: ProfileData = { full_name: '', phone: '', date_of_birth: '', address: '' }
  const [profile, setProfile]       = useState<ProfileData>(empty)
  const [savedProfile, setSaved]    = useState<ProfileData>(empty)
  const [editing, setEditing]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [savedOk, setSavedOk]       = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) { setProfile(data as ProfileData); setSaved(data as ProfileData) }
      })
  }, [user])

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    await supabase.from('profiles').upsert({
      id: user.id,
      full_name: profile.full_name,
      phone: profile.phone,
      date_of_birth: profile.date_of_birth || null,
      address: profile.address,
    })
    setSaving(false)
    setSaved({ ...profile })
    setSavedOk(true)
    setEditing(false)
    setTimeout(() => setSavedOk(false), 2500)
  }

  const [notifPriceAlerts, setNotifPriceAlerts] = useState(() => read('moneta_notif_price_alerts', true))
  const [notifOrders,      setNotifOrders]       = useState(() => read('moneta_notif_orders', true))
  const [notifPortfolio,   setNotifPortfolio]    = useState(() => read('moneta_notif_portfolio', true))
  const [notifNews,        setNotifNews]         = useState(() => read('moneta_notif_news', false))
  const [confirmOrders,    setConfirmOrders]     = useState(() => read('moneta_pref_confirm_orders', true))

  const [changingPw, setChangingPw] = useState(false)
  const [pwEmail, setPwEmail]       = useState('')
  const [pwMsg, setPwMsg]           = useState<{ ok: boolean; text: string } | null>(null)

  const [showSignOut, setShowSignOut] = useState(false)

  function toggle(setter: (v: boolean) => void, key: string) {
    return (v: boolean) => { setter(v); persist(key, v) }
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
      : { ok: true, text: 'Reset link sent — check your email.' }
    )
  }

  async function handleSignOut() {
    await signOut()
    navigate('/login', { replace: true })
  }

  const cfg = KYC_CONFIG[kycStatus]
  const initials = profile.full_name
    ? profile.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'U'

  return (
    <div style={{ minHeight: '100svh', background: 'var(--bg-page)', display: 'flex', flexDirection: 'column', paddingBottom: 80 }}>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(160deg, #050e1a 0%, #0c1f2e 45%, #053d2a 80%, #065f3e 100%)',
        padding: 'calc(env(safe-area-inset-top,0px) + 20px) 24px 0',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(5,150,105,0.2) 0%, transparent 65%)' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        </div>

        <p style={{ fontSize: 13, fontWeight: 800, color: 'rgba(255,255,255,0.4)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 20, position: 'relative', zIndex: 1 }}>Account</p>

        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 24, position: 'relative', zIndex: 1 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 68, height: 68, borderRadius: 22,
              background: 'linear-gradient(135deg, #059669, #047857)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: -1,
              boxShadow: '0 8px 24px rgba(5,150,105,0.4)',
            }}>
              {initials}
            </div>
            <div style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 16, height: 16, borderRadius: '50%',
              background: cfg.dot, border: '3px solid #050e1a',
            }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 19, fontWeight: 900, color: '#fff', letterSpacing: -0.5, marginBottom: 3 }}>
              {profile.full_name || 'Your Name'}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </p>
          </div>
        </div>

        {/* KYC strip */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '14px 14px 0 0', padding: '12px 16px',
          position: 'relative', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, boxShadow: `0 0 8px ${cfg.dot}` }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{cfg.label}</p>
          </div>
          {(kycStatus === 'pending' || kycStatus === 'rejected') && (
            <button
              onClick={() => navigate('/kyc')}
              style={{ fontSize: 11, fontWeight: 700, color: '#34d399', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.25)', padding: '4px 12px', borderRadius: 20, cursor: 'pointer' }}
            >
              {kycStatus === 'rejected' ? 'Resubmit' : 'Verify Now'}
            </button>
          )}
          {(kycStatus === 'verified' || kycStatus === 'submitted') && (
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{cfg.sub}</p>
          )}
        </div>
      </div>

      {/* PERSONAL INFO */}
      <SectionHeader label="Personal Information" />
      <Card>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', borderBottom: '1px solid #f1f5f9',
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>Your details</p>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 20, background: '#f0fdf4', border: '1px solid #a7f3d0', color: '#059669', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
              Edit
            </button>
          ) : (
            <button
              onClick={() => { setProfile({ ...savedProfile }); setEditing(false) }}
              style={{ padding: '5px 12px', borderRadius: 20, background: '#f8fafc', border: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Cancel
            </button>
          )}
        </div>

        <ProfileField label="Full Legal Name" value={editing ? profile.full_name : savedProfile.full_name} readOnly={!editing} onChange={(v) => setProfile((p) => ({ ...p, full_name: v }))} />
        <ProfileField label="Phone Number" value={editing ? profile.phone : savedProfile.phone} type="tel" readOnly={!editing} onChange={(v) => setProfile((p) => ({ ...p, phone: v }))} />
        <ProfileField label="Date of Birth" value={editing ? profile.date_of_birth : savedProfile.date_of_birth} type="date" readOnly={!editing} onChange={(v) => setProfile((p) => ({ ...p, date_of_birth: v }))} />
        <ProfileField label="Residential Address" value={editing ? profile.address : savedProfile.address} multiline readOnly={!editing} last onChange={(v) => setProfile((p) => ({ ...p, address: v }))} />
      </Card>

      {editing && (
        <div style={{ margin: '10px 16px 0' }}>
          {savedOk && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', border: '1px solid #a7f3d0', borderRadius: 12, padding: '10px 14px', marginBottom: 10, color: '#065f46', fontSize: 13, fontWeight: 600 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Profile saved
            </div>
          )}
          <button
            onClick={saveProfile} disabled={saving}
            style={{
              width: '100%', padding: '15px', borderRadius: 14,
              background: saving ? '#f1f5f9' : 'linear-gradient(135deg,#059669,#047857)',
              color: saving ? '#94a3b8' : '#fff', fontWeight: 800, fontSize: 15,
              boxShadow: saving ? 'none' : '0 6px 20px rgba(5,150,105,0.3)',
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* SECURITY */}
      <SectionHeader label="Security" />
      <Card>
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
          label="Change Password"
          sub="Send a reset link to your email"
          onPress={() => setChangingPw((v) => !v)}
        />
        {changingPw && (
          <div style={{ padding: '0 16px 16px' }}>
            <input type="email" className="input-field" placeholder={user?.email ?? 'your@email.com'} value={pwEmail} onChange={(e) => setPwEmail(e.target.value)} style={{ marginBottom: 10 }} />
            {pwMsg && <p style={{ fontSize: 12, fontWeight: 600, color: pwMsg.ok ? '#059669' : '#dc2626', marginBottom: 10 }}>{pwMsg.text}</p>}
            <button onClick={sendResetEmail} style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff', fontWeight: 700, fontSize: 13, boxShadow: '0 4px 14px rgba(5,150,105,0.3)' }}>
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
      </Card>

      {/* NOTIFICATIONS */}
      <SectionHeader label="Notifications" />
      <Card>
        <Row icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>} label="Price Alerts" sub="Significant price moves" right={<Toggle on={notifPriceAlerts} onChange={toggle(setNotifPriceAlerts, 'moneta_notif_price_alerts')} />} />
        <Row icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} label="Order Updates" sub="Confirmations, fills, rejections" right={<Toggle on={notifOrders} onChange={toggle(setNotifOrders, 'moneta_notif_orders')} />} />
        <Row icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>} label="Portfolio Summary" sub="Daily P&L digest" right={<Toggle on={notifPortfolio} onChange={toggle(setNotifPortfolio, 'moneta_notif_portfolio')} />} />
        <Row icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v2"/><path d="M2 8l2 2 4-4"/></svg>} label="Market News" sub="NGX announcements & filings" right={<Toggle on={notifNews} onChange={toggle(setNotifNews, 'moneta_notif_news')} />} last />
      </Card>

      {/* TRADING PREFERENCES */}
      <SectionHeader label="Trading Preferences" />
      <Card>
        <Row icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>} label="Order Confirmation" sub="Review before submitting" right={<Toggle on={confirmOrders} onChange={toggle(setConfirmOrders, 'moneta_pref_confirm_orders')} />} last />
      </Card>

      {/* SUPPORT & LEGAL */}
      <SectionHeader label="Support & Legal" />
      <Card>
        <Row icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>} label="Help Center" sub="FAQs and guides" onPress={() => window.open('mailto:support@moneta.ng', '_blank')} />
        <Row icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>} label="Contact Support" sub="support@moneta.ng" onPress={() => window.open('mailto:support@moneta.ng', '_blank')} />
        <Row icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} label="Terms of Service" onPress={() => {}} />
        <Row icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>} label="Privacy Policy" onPress={() => {}} />
        <Row icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>} label="SEC Regulatory Disclosure" sub="Digital Sub-Broker · PAC Securities" onPress={() => {}} last />
      </Card>

      {/* ABOUT */}
      <SectionHeader label="About" />
      <Card>
        <Row icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>} label="App Version" sub="Moneta Alpha" right={<span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>v0.1.0</span>} last />
      </Card>

      {/* SIGN OUT */}
      <SectionHeader label="Account Actions" />
      <Card>
        <Row
          icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>}
          label="Sign Out" danger onPress={() => setShowSignOut(true)} last
        />
      </Card>

      {/* Sign out sheet */}
      {showSignOut && (
        <>
          <div onClick={() => setShowSignOut(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101, background: '#fff', borderRadius: '24px 24px 0 0', padding: '24px 20px calc(env(safe-area-inset-bottom,0px) + 28px)', maxWidth: 480, margin: '0 auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ width: 36, height: 4, background: '#e2e8f0', borderRadius: 2, margin: '0 auto 24px' }} />
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 56, height: 56, borderRadius: 18, background: '#fee2e2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              </div>
              <p style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Sign out?</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>You'll need to sign back in to access your portfolio and place trades.</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowSignOut(false)} style={{ flex: 1, padding: '14px', borderRadius: 14, background: '#f8fafc', border: '1.5px solid var(--border)', fontWeight: 700, fontSize: 15, color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSignOut} style={{ flex: 1, padding: '14px', borderRadius: 14, background: 'linear-gradient(135deg,#dc2626,#b91c1c)', fontWeight: 800, fontSize: 15, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 16px rgba(220,38,38,0.3)' }}>Sign Out</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
