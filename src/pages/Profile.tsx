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

const KYC_CONFIG: Record<KYCStatus, { label: string; sub: string; color: string; bg: string; border: string; dot: string }> = {
  pending:   { label: 'KYC Required',  sub: 'Complete verification to unlock trading', color: '#92400e', bg: '#fffbeb', border: '#fde68a', dot: '#f59e0b' },
  submitted: { label: 'Under Review',  sub: 'Typically takes 1–2 business days',       color: '#1e40af', bg: '#eff6ff', border: '#bfdbfe', dot: '#3b82f6' },
  verified:  { label: 'Verified',      sub: 'Fully approved to trade on the NGX',      color: '#065f46', bg: '#f0fdf4', border: '#a7f3d0', dot: '#059669' },
  rejected:  { label: 'KYC Rejected',  sub: 'Please re-submit with valid documents',   color: '#991b1b', bg: '#fff5f5', border: '#fecaca', dot: '#e03131' },
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, kycStatus } = useAuthStore()
  const empty: ProfileData = { full_name: '', phone: '', date_of_birth: '', address: '', bvn: '', kyc_status: 'pending' }
  const [profile, setProfile] = useState<ProfileData>(empty)
  const [savedProfile, setSavedProfile] = useState<ProfileData>(empty)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [tab, setTab] = useState<'profile' | 'kyc'>('profile')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('*').eq('id', user.id).single()
      .then(({ data }) => {
        if (data) {
          setProfile(data as ProfileData)
          setSavedProfile(data as ProfileData)
        }
      })
  }, [user])

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    setSaveError(null)
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: profile.full_name,
      phone: profile.phone,
      date_of_birth: profile.date_of_birth || null,
      address: profile.address,
    })
    setSaving(false)
    if (error) {
      setSaveError(error.message)
      return
    }
    setSavedProfile({ ...profile })
    setSaved(true)
    setEditing(false)
    setTimeout(() => setSaved(false), 2500)
  }

  const cfg = KYC_CONFIG[kycStatus]
  const initials = profile.full_name
    ? profile.full_name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? 'U'

  return (
    <Layout title="Profile">
      {/* Hero */}
      <div style={{
        background: 'linear-gradient(160deg, #050e1a 0%, #0c1f2e 45%, #053d2a 80%, #065f3e 100%)',
        padding: '24px 24px 0',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute', top: -50, right: -50, width: 200, height: 200, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(5,150,105,0.2) 0%, transparent 65%)',
          }} />
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }} />
        </div>

        {/* Settings icon */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, position: 'relative', zIndex: 1 }}>
          <button
            onClick={() => navigate('/settings')}
            style={{
              width: 38, height: 38, borderRadius: 12,
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
        </div>

        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 24, position: 'relative', zIndex: 1 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 24,
              background: 'linear-gradient(135deg, #059669, #047857)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: -1,
              boxShadow: '0 8px 24px rgba(5,150,105,0.4)',
            }}>
              {initials}
            </div>
            {/* KYC status dot */}
            <div style={{
              position: 'absolute', bottom: -2, right: -2,
              width: 18, height: 18, borderRadius: '50%',
              background: cfg.dot,
              border: '3px solid #050e1a',
            }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: -0.5, marginBottom: 4 }}>
              {profile.full_name || 'Your Name'}
            </p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.email}
            </p>
          </div>
        </div>

        {/* KYC status strip — sits at bottom of hero */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '14px 14px 0 0',
          padding: '12px 16px',
          position: 'relative', zIndex: 1,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: cfg.dot,
              boxShadow: `0 0 8px ${cfg.dot}`,
            }} />
            <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.8)' }}>{cfg.label}</p>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{cfg.sub}</p>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex',
        background: '#fff',
        borderBottom: '1px solid var(--border)',
      }}>
        {(['profile', 'kyc'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '15px 0',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
              color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
              borderBottom: `2.5px solid ${tab === t ? 'var(--primary)' : 'transparent'}`,
              background: 'none', transition: 'all 0.15s', letterSpacing: 0.1,
            }}
          >
            {t === 'profile' ? 'Personal Info' : 'KYC Verification'}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'profile' ? (
        <div style={{ padding: '20px 16px 40px' }} className="animate-in">

          {/* Info card */}
          <div style={{
            background: '#fff', borderRadius: 18,
            border: '1px solid var(--border)',
            boxShadow: '0 2px 8px rgba(10,22,40,0.06)',
            overflow: 'hidden', marginBottom: 14,
          }}>
            {/* Card header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px',
              borderBottom: '1px solid var(--border)',
            }}>
              <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                Personal Information
              </p>
              {!editing ? (
                <button
                  onClick={() => setEditing(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 12px', borderRadius: 20,
                    background: '#f0fdf4', border: '1px solid #a7f3d0',
                    color: '#059669', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                  Edit
                </button>
              ) : (
                <button
                  onClick={() => { setProfile({ ...savedProfile }); setEditing(false) }}
                  style={{
                    padding: '6px 12px', borderRadius: 20,
                    background: '#f8fafc', border: '1px solid var(--border)',
                    color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              )}
            </div>

            <SectionRow label="Full Legal Name" value={editing ? profile.full_name : (savedProfile.full_name || '—')}
              placeholder="John Doe" readOnly={!editing}
              onChange={(v) => setProfile((p) => ({ ...p, full_name: v }))} />
            <SectionRow label="Phone Number" value={editing ? profile.phone : (savedProfile.phone || '—')}
              placeholder="+234 800 000 0000" type="tel" readOnly={!editing}
              onChange={(v) => setProfile((p) => ({ ...p, phone: v }))} />
            <SectionRow label="Date of Birth" value={editing ? profile.date_of_birth : (savedProfile.date_of_birth || '—')}
              type="date" readOnly={!editing}
              onChange={(v) => setProfile((p) => ({ ...p, date_of_birth: v }))} />
            <SectionRow label="Residential Address" value={editing ? profile.address : (savedProfile.address || '—')}
              placeholder="123 Marina Street, Lagos Island" multiline readOnly={!editing}
              onChange={(v) => setProfile((p) => ({ ...p, address: v }))} last />
          </div>

          {saved && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#f0fdf4', border: '1.5px solid #a7f3d0',
              borderRadius: 12, padding: '12px 16px', marginBottom: 14,
              color: '#065f46', fontSize: 13, fontWeight: 600,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              Profile saved successfully
            </div>
          )}

          {saveError && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: '#fff5f5', border: '1.5px solid #fecaca',
              borderRadius: 12, padding: '12px 16px', marginBottom: 14,
              color: '#991b1b', fontSize: 13, fontWeight: 600,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {saveError}
            </div>
          )}

          {editing && (
            <button
              onClick={saveProfile}
              disabled={saving}
              style={{
                width: '100%', padding: '16px',
                background: saving ? 'var(--bg-elevated)' : 'linear-gradient(135deg,#059669,#047857)',
                color: saving ? 'var(--text-muted)' : '#fff',
                borderRadius: 16, fontSize: 16, fontWeight: 800,
                boxShadow: saving ? 'none' : '0 6px 24px rgba(5,150,105,0.35)',
                transition: 'all 0.2s', cursor: saving ? 'not-allowed' : 'pointer',
                marginBottom: 14,
              }}
            >
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          )}

          {/* Sign out */}
          <button
            onClick={() => useAuthStore.getState().signOut()}
            style={{
              width: '100%', padding: '15px',
              background: '#fff5f5', border: '1.5px solid #fecaca',
              borderRadius: 16, color: '#dc2626', fontWeight: 700, fontSize: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
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
      ) : (
        <div style={{ padding: '20px 16px 40px' }} className="animate-in">
          {kycStatus === 'verified' && (
            <div style={{
              background: '#fff', borderRadius: 18,
              border: '1.5px solid #a7f3d0',
              boxShadow: '0 2px 8px rgba(10,22,40,0.06)',
              padding: '24px 20px', textAlign: 'center',
              marginBottom: 14,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'linear-gradient(135deg, #059669, #047857)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 8px 24px rgba(5,150,105,0.35)',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p style={{ fontSize: 18, fontWeight: 900, color: '#065f46', marginBottom: 6, letterSpacing: -0.3 }}>Identity Verified</p>
              <p style={{ fontSize: 13, color: '#059669', fontWeight: 500, lineHeight: 1.5 }}>
                You are fully approved to trade on the Nigerian Stock Exchange
              </p>
            </div>
          )}

          {kycStatus === 'submitted' && (
            <div style={{
              background: '#fff', borderRadius: 18,
              border: '1.5px solid #bfdbfe',
              boxShadow: '0 2px 8px rgba(10,22,40,0.06)',
              padding: '24px 20px', textAlign: 'center',
              marginBottom: 14,
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#2563eb',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 8px 24px rgba(37,99,235,0.35)',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
              </div>
              <p style={{ fontSize: 18, fontWeight: 900, color: '#1e40af', marginBottom: 6, letterSpacing: -0.3 }}>Under Review</p>
              <p style={{ fontSize: 13, color: '#3b82f6', fontWeight: 500, lineHeight: 1.5 }}>
                Your documents are being reviewed. This typically takes 1–2 business days.
              </p>
            </div>
          )}

          {(kycStatus === 'pending' || kycStatus === 'rejected') && (
            <>
              <div style={{
                background: '#fff', borderRadius: 18,
                border: '1.5px solid var(--border)',
                boxShadow: '0 2px 8px rgba(10,22,40,0.06)',
                padding: '24px 20px', textAlign: 'center',
                marginBottom: 14,
              }}>
                <div style={{
                  width: 64, height: 64, borderRadius: '50%',
                  background: kycStatus === 'rejected' ? '#fee2e2' : '#f0fdf4',
                  border: `2px solid ${kycStatus === 'rejected' ? '#fecaca' : '#a7f3d0'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
                    stroke={kycStatus === 'rejected' ? '#dc2626' : '#059669'}
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <p style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', marginBottom: 8, letterSpacing: -0.3 }}>
                  {kycStatus === 'rejected' ? 'Verification Failed' : 'Identity Not Verified'}
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500, lineHeight: 1.6 }}>
                  {kycStatus === 'rejected'
                    ? 'Your documents were rejected. Please re-submit with clear, valid ID documents.'
                    : 'You need to verify your identity before placing trades. This is required by the SEC.'}
                </p>
              </div>

              <button
                onClick={() => navigate('/kyc')}
                style={{
                  width: '100%', padding: '16px',
                  background: 'linear-gradient(135deg, #059669, #047857)',
                  color: '#fff', borderRadius: 16, border: 'none',
                  fontSize: 15, fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 6px 24px rgba(5,150,105,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                {kycStatus === 'rejected' ? 'Resubmit KYC' : 'Complete Verification'}
              </button>
            </>
          )}
        </div>
      )}
    </Layout>
  )
}

function SectionRow({ label, value, onChange, placeholder, type = 'text', multiline, last, readOnly }: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; multiline?: boolean; last?: boolean; readOnly?: boolean
}) {
  const textColor = readOnly ? 'var(--text)' : 'var(--text)'
  const emptyColor = 'var(--text-muted)'
  const displayValue = readOnly && !value ? '—' : value

  return (
    <div style={{
      borderBottom: last ? 'none' : '1px solid var(--border)',
      padding: '13px 18px',
      background: readOnly ? '#fff' : '#fafcff',
      transition: 'background 0.15s',
    }}>
      <label style={{
        display: 'block', fontSize: 10, fontWeight: 700,
        color: 'var(--text-muted)', letterSpacing: 0.6,
        textTransform: 'uppercase', marginBottom: 5,
      }}>
        {label}
      </label>
      {readOnly ? (
        <p style={{
          fontSize: 15, fontWeight: 500,
          color: displayValue === '—' ? emptyColor : textColor,
          lineHeight: 1.5,
        }}>
          {displayValue}
        </p>
      ) : multiline ? (
        <textarea
          value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder} rows={3}
          style={{
            width: '100%', background: 'none', border: 'none', resize: 'none',
            fontFamily: 'inherit', fontSize: 15, fontWeight: 500,
            color: textColor, outline: 'none',
          }}
        />
      ) : (
        <input
          type={type} value={value} onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={{
            width: '100%', background: 'none', border: 'none',
            fontSize: 15, fontWeight: 500, color: textColor, outline: 'none',
          }}
        />
      )}
    </div>
  )
}
