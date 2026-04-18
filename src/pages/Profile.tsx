import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'

type KYCStatus = 'pending' | 'submitted' | 'verified' | 'rejected'

interface ProfileData {
  full_name: string
  phone: string
  date_of_birth: string
  address: string
  bvn: string
  kyc_status: KYCStatus
}

const KYC_CONFIG: Record<KYCStatus, { label: string; sub: string; color: string; bg: string; border: string; iconType: 'clock' | 'eye' | 'check' | 'x' }> = {
  pending:   { label: 'KYC Required',   sub: 'Complete verification to unlock trading',    color: '#92400e', bg: '#fffbeb', border: '#fde68a', iconType: 'clock' },
  submitted: { label: 'Under Review',   sub: 'Typically takes 1–2 business days',          color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe', iconType: 'eye'   },
  verified:  { label: 'KYC Verified',   sub: 'You are fully approved to trade',            color: '#065f46', bg: '#f0fdf4', border: '#a7f3d0', iconType: 'check' },
  rejected:  { label: 'KYC Rejected',   sub: 'Please re-submit with valid documents',      color: '#991b1b', bg: '#fff5f5', border: '#fecaca', iconType: 'x'     },
}

function KYCStatusIcon({ type, color }: { type: 'clock' | 'eye' | 'check' | 'x'; color: string }) {
  const props = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (type === 'clock') return <svg {...props}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
  if (type === 'eye')   return <svg {...props}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
  if (type === 'check') return <svg {...props}><polyline points="20 6 9 17 4 12"/></svg>
  return <svg {...props}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, kycStatus } = useAuthStore()
  const [profile, setProfile] = useState<ProfileData>({
    full_name: '', phone: '', date_of_birth: '', address: '', bvn: '', kyc_status: 'pending',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState<'profile' | 'kyc'>('profile')

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => { if (data) setProfile(data as ProfileData) })
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
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const cfg = KYC_CONFIG[kycStatus]
  const initials = profile.full_name
    ? profile.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'U'

  return (
    <Layout title="Profile">
      {/* User hero */}
      <div style={{
        padding: '20px 20px 0',
        background: 'linear-gradient(160deg, #050e1a 0%, #0c1f2e 40%, #064e3b 80%, #059669 100%)',
        margin: 0,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative orbs */}
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 150, height: 150, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(5,150,105,0.2) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          pointerEvents: 'none',
        }} />

        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '0 0 20px',
          position: 'relative', zIndex: 1,
        }}>
          {/* Avatar */}
          <div style={{
            width: 64, height: 64, borderRadius: 22,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.2), rgba(255,255,255,0.1))',
            border: '2px solid rgba(255,255,255,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: -1,
            flexShrink: 0,
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
          }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 19, fontWeight: 900, color: '#fff', marginBottom: 3, letterSpacing: -0.4 }}>
              {profile.full_name || 'Complete your profile'}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
              {user?.email}
            </p>
          </div>
        </div>

        {/* KYC status banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: cfg.bg, border: `1.5px solid ${cfg.border}`,
          borderRadius: '14px 14px 0 0', padding: '14px 16px',
          margin: '0 -0px',
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: cfg.color + '18',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <KYCStatusIcon type={cfg.iconType} color={cfg.color} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, color: cfg.color, marginBottom: 2 }}>{cfg.label}</p>
            <p style={{ fontSize: 11, color: cfg.color, opacity: 0.75, fontWeight: 500 }}>{cfg.sub}</p>
          </div>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'flex', background: '#fff',
        borderBottom: '1px solid var(--border)',
      }}>
        {(['profile', 'kyc'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '14px 0',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: `2.5px solid ${tab === t ? 'var(--primary)' : 'transparent'}`,
              background: 'none', transition: 'all 0.15s',
              letterSpacing: 0.2,
            }}
          >
            {t === 'profile' ? 'Personal Info' : 'KYC Verification'}
          </button>
        ))}
      </div>

      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 14 }} className="animate-in">
        {tab === 'profile' ? (
          <>
            <Field label="Full Legal Name" value={profile.full_name} onChange={(v) => setProfile((p) => ({ ...p, full_name: v }))} placeholder="John Doe" />
            <Field label="Phone Number" value={profile.phone} onChange={(v) => setProfile((p) => ({ ...p, phone: v }))} placeholder="+234 800 000 0000" type="tel" />
            <Field label="Date of Birth" value={profile.date_of_birth} onChange={(v) => setProfile((p) => ({ ...p, date_of_birth: v }))} type="date" />
            <Field label="Residential Address" value={profile.address} onChange={(v) => setProfile((p) => ({ ...p, address: v }))} placeholder="123 Marina Street, Lagos Island" multiline />

            {saved && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--up-dim)', borderLeft: '3px solid var(--up)',
                borderRadius: 8, padding: '11px 14px',
                color: 'var(--up-text)', fontSize: 13, fontWeight: 600,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Profile saved successfully
              </div>
            )}

            <button onClick={saveProfile} disabled={saving} style={primaryBtn(saving)}>
              {saving ? 'Saving…' : 'Save Profile'}
            </button>
          </>
        ) : (
          <>
            {/* Status card */}
            {kycStatus === 'verified' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: '#f0fdf4', border: '1.5px solid #a7f3d0',
                borderRadius: 16, padding: '18px 16px',
              }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#059669,#047857)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#065f46' }}>Identity Verified</p>
                  <p style={{ fontSize: 12, color: '#059669', fontWeight: 500 }}>You are fully approved to trade on the NGX</p>
                </div>
              </div>
            )}

            {kycStatus === 'submitted' && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: '#eff6ff', border: '1.5px solid #bfdbfe',
                borderRadius: 16, padding: '18px 16px',
              }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 800, color: '#1e40af' }}>Under Review</p>
                  <p style={{ fontSize: 12, color: '#3b82f6', fontWeight: 500 }}>Typically takes 1–2 business days to complete</p>
                </div>
              </div>
            )}

            {(kycStatus === 'pending' || kycStatus === 'rejected') && (
              <>
                <div style={{
                  background: '#fff5f5', border: '1.5px solid #fecaca',
                  borderRadius: 16, padding: '18px 16px',
                  display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 4,
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 800, color: '#991b1b', marginBottom: 4 }}>
                      {kycStatus === 'rejected' ? 'KYC Rejected — Please resubmit' : 'Identity not verified'}
                    </p>
                    <p style={{ fontSize: 12, color: '#dc2626', fontWeight: 500, lineHeight: 1.5 }}>
                      You cannot place trades until your identity is verified. This is required by the SEC.
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => navigate('/kyc')}
                  style={{
                    width: '100%', padding: '15px',
                    background: 'linear-gradient(135deg,#059669,#047857)',
                    color: '#fff', borderRadius: 'var(--radius)', border: 'none',
                    fontSize: 15, fontWeight: 800, cursor: 'pointer',
                    boxShadow: '0 4px 16px rgba(5,150,105,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                  {kycStatus === 'rejected' ? 'Resubmit KYC' : 'Complete KYC Verification'}
                </button>
              </>
            )}
          </>
        )}
      </div>

      {/* Sign out */}
      <div style={{ padding: '8px 20px 48px' }}>
        <button
          onClick={() => useAuthStore.getState().signOut()}
          style={{
            width: '100%', padding: '14px',
            background: '#fff5f5',
            border: '1.5px solid #fecaca',
            borderRadius: 'var(--radius)',
            color: '#dc2626', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'all 0.15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Sign Out
        </button>
      </div>
    </Layout>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function Field({ label, value, onChange, placeholder, type = 'text', multiline, maxLength, disabled, hint }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; multiline?: boolean
  maxLength?: number; disabled?: boolean; hint?: string
}) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', letterSpacing: 0.3, textTransform: 'uppercase' }}>
          {label}
        </label>
        {hint && <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>{hint}</span>}
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          disabled={disabled}
          className="input-field"
          style={{ resize: 'none', fontFamily: 'inherit', opacity: disabled ? 0.5 : 1 }}
        />
      ) : (
        <input
          className="input-field"
          type={type} value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          disabled={disabled}
          style={{ opacity: disabled ? 0.5 : 1 }}
        />
      )}
    </div>
  )
}


const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  padding: '15px', width: '100%', cursor: disabled ? 'not-allowed' : 'pointer',
  background: disabled ? 'var(--bg-elevated)' : 'linear-gradient(135deg,#059669,#047857)',
  color: disabled ? 'var(--text-muted)' : '#fff',
  borderRadius: 'var(--radius)', fontSize: 16, fontWeight: 800,
  boxShadow: disabled ? 'none' : '0 4px 20px rgba(5,150,105,0.32)',
  transition: 'all 0.2s',
})
