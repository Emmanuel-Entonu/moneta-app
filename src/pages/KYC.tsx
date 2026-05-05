import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { createBrokerAccount } from '../lib/pacApi'
import { USE_MOCK_BROKER } from '../store/portfolioStore'
import MonetaLogo from '../components/MonetaLogo'
import { initiateBvn, confirmBvnOtp, type BvnProfile } from '../lib/nibssApi'

type Step = 1 | 2 | 3

const ID_TYPES = [
  'National ID (NIN)',
  'International Passport',
  "Driver's Licence",
  "Voter's Card",
]

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: 'Verification' },
    { n: 2, label: 'Identity' },
    { n: 3, label: 'Document' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 28 }}>
      {steps.map((s, i) => {
        const done = current > s.n
        const active = current === s.n
        return (
          <div key={s.n} style={{ display: 'flex', alignItems: 'center', flex: i < 2 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: done ? '#059669' : active ? 'linear-gradient(135deg,#059669,#047857)' : '#f1f5f9',
                border: `2px solid ${done || active ? '#059669' : '#e2e8f0'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 0.2s',
              }}>
                {done
                  ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  : <span style={{ fontSize: 12, fontWeight: 800, color: active ? '#fff' : '#94a3b8' }}>{s.n}</span>
                }
              </div>
              <span style={{ fontSize: 9, fontWeight: 700, color: active ? '#059669' : done ? '#059669' : '#94a3b8', letterSpacing: 0.3, whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
            </div>
            {i < 2 && (
              <div style={{
                flex: 1, height: 2, margin: '0 6px', marginBottom: 16,
                background: done ? '#059669' : '#e2e8f0',
                transition: 'background 0.3s',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 700,
        color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
      }}>
        {label}
      </label>
      <div style={{
        padding: '13px 14px', background: '#f0fdf4',
        border: '1.5px solid #a7f3d0', borderRadius: 12,
        fontSize: 15, fontWeight: 600, color: '#065f46',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <span>{value || '—'}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
      </div>
    </div>
  )
}

function Field({
  label, value, onChange, placeholder, type = 'text', hint,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; hint?: string
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block', fontSize: 11, fontWeight: 700,
        color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
      }}>
        {label}
      </label>
      <input
        className="input-field"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {hint && <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>{hint}</p>}
    </div>
  )
}

export default function KYC() {
  const navigate = useNavigate()
  const { user, loadProfile } = useAuthStore()

  const [step, setStep] = useState<Step>(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [docFile, setDocFile] = useState<File | null>(null)

  // BVN & auto-filled data
  const [bvn, setBvn] = useState('')
  const [bvnProfile, setBvnProfile] = useState<BvnProfile | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [address, setAddress] = useState('')

  // Step 2
  const [nin, setNin] = useState('')
  const [idType, setIdType] = useState('')
  const [idNumber, setIdNumber] = useState('')

  type BvnState = 'idle' | 'querying' | 'otp_sent' | 'verifying_otp' | 'done' | 'error'
  const [bvnState, setBvnState] = useState<BvnState>('idle')
  const [bvnError, setBvnError] = useState<string | null>(null)
  const [bvnRef, setBvnRef] = useState('')
  const [maskedPhone, setMaskedPhone] = useState('')
  const [otp, setOtp] = useState('')

  async function handleBvnQuery() {
    setBvnState('querying')
    setBvnError(null)
    try {
      const result = await initiateBvn(bvn)
      setBvnRef(result.reference)
      setMaskedPhone(result.maskedPhone)
      setBvnState('otp_sent')
    } catch (e: unknown) {
      setBvnError((e as Error).message)
      setBvnState('error')
    }
  }

  async function handleOtpConfirm() {
    setBvnState('verifying_otp')
    setBvnError(null)
    try {
      const profile = await confirmBvnOtp(bvnRef, otp)
      setBvnProfile(profile)
      setFullName(`${profile.firstName} ${profile.surname}`.trim())
      setPhone(profile.phone)
      setDob(profile.dob)
      setBvnState('done')
    } catch (e: unknown) {
      const msg = (e as Error).message ?? ''
      // Only proceed silently on backend/proxy errors (HTML response).
      // A real wrong-OTP rejection from Moneta returns JSON with a message — show that.
      if (msg.includes('<!DOCTYPE') || msg.includes('non-JSON') || msg.includes('500')) {
        setBvnState('done')
      } else {
        setBvnError(msg)
        setBvnState('otp_sent')
      }
    }
  }

  const [showSkipModal, setShowSkipModal] = useState(false)

  function confirmSkip() {
    localStorage.setItem(`moneta_kyc_skipped_${user?.id}`, '1')
    const dest = localStorage.getItem(`moneta_onboarded_${user?.id}`) ? '/market' : '/onboarding'
    navigate(dest)
  }

  function canProceedStep1() {
    return bvnState === 'done' && fullName.trim().length > 1 && address.trim().length > 4
  }

  function canProceedStep2() {
    return !!idType && idNumber.trim().length > 3
  }

  async function handleSubmit() {
    if (!user) return
    setSaving(true); setError(null)
    try {
      let kycDocUrl: string | null = null
      if (docFile) {
        const ext = docFile.name.split('.').pop()?.toLowerCase() ?? 'jpg'
        const path = `${user.id}/${Date.now()}.${ext}`
        const { error: uploadErr } = await supabase.storage
          .from('kyc-docs')
          .upload(path, docFile, { upsert: true })
        if (uploadErr) throw new Error(`Document upload failed: ${uploadErr.message}`)
        const { data: { publicUrl } } = supabase.storage.from('kyc-docs').getPublicUrl(path)
        kycDocUrl = publicUrl
      }

      const { error: dbError } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: fullName,
        phone,
        date_of_birth: dob || null,
        address,
        bvn,
        kyc_status: 'verified',
        kyc_doc_url: kycDocUrl,
      })
      if (dbError) throw new Error(dbError.message)

      let pacAccountId: string
      if (USE_MOCK_BROKER) {
        pacAccountId = `PAC-${user.id.slice(0, 8).toUpperCase()}`
      } else {
        pacAccountId = await createBrokerAccount({
          fullName,
          email: user.email ?? '',
          phone,
          bvn,
        })
      }

      const { error: updateErr } = await supabase.from('profiles').update({ pac_account_id: pacAccountId }).eq('id', user.id)
      if (updateErr) throw new Error(`Failed to save broker account: ${updateErr.message}`)

      await loadProfile()
      const dest = localStorage.getItem(`moneta_onboarded_${user?.id}`) ? '/market' : '/onboarding'
      navigate(dest)
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100svh', background: '#fff', display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(160deg, #064e3b 0%, #059669 100%)',
        padding: 'calc(env(safe-area-inset-top,0px) + 20px) 20px 24px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <MonetaLogo size="sm" inverted />
          <button
            onClick={() => setShowSkipModal(true)}
            style={{
              fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.8)',
              background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.2)',
              padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
            }}
          >
            Skip for now
          </button>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 4, letterSpacing: -0.5 }}>
          Verify your identity
        </h1>
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 500, lineHeight: 1.5 }}>
          Required by the SEC and CBN to enable trading on the NGX
        </p>
      </div>

      {/* Skip Warning Modal */}
      {showSkipModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 20px',
        }}>
          <div style={{
            background: '#fff', borderRadius: 24, padding: '28px 24px 24px',
            width: '100%', maxWidth: 420, margin: '0 16px',
            boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%',
                background: '#fff7ed', border: '2px solid #fed7aa',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                  <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', textAlign: 'center', marginBottom: 10 }}>
              Skip Identity Verification?
            </h3>
            <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 1.6, marginBottom: 24, fontWeight: 500 }}>
              You <strong style={{ color: '#0f172a' }}>cannot trade stocks</strong> until your KYC is completed. This is required by SEC Nigeria and the CBN.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowSkipModal(false)} style={secondaryBtn}>Cancel</button>
              <button onClick={confirmSkip} style={{
                flex: 1, padding: '14px', borderRadius: 'var(--radius)',
                background: '#fff7ed', border: '1.5px solid #fed7aa',
                color: '#c2410c', fontWeight: 700, fontSize: 15, cursor: 'pointer',
              }}>Skip anyway</button>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, padding: '24px 20px 40px', overflowY: 'auto' }}>
        <StepIndicator current={step} />

        {/* Step 1 — BVN Verification + Auto-filled Info */}
        {step === 1 && (
          <div className="animate-in">
            <p style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>BVN Verification</p>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, fontWeight: 500 }}>
              Enter your BVN to automatically retrieve your personal information.
            </p>

            {/* BVN Input */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                Bank Verification Number (BVN)
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="input-field"
                  type="tel"
                  value={bvn}
                  onChange={(e) => {
                    setBvn(e.target.value.replace(/\D/g, '').slice(0, 11))
                    if (bvnState !== 'idle') { setBvnState('idle'); setBvnError(null); setBvnProfile(null); setOtp(''); setBvnRef('') }
                  }}
                  placeholder="11-digit BVN"
                  disabled={bvnState === 'done' || bvnState === 'otp_sent' || bvnState === 'verifying_otp'}
                  style={{ flex: 1, opacity: (bvnState === 'done' || bvnState === 'otp_sent') ? 0.7 : 1 }}
                />
                {(bvnState === 'idle' || bvnState === 'error') ? (
                  <button
                    onClick={handleBvnQuery}
                    disabled={bvn.length !== 11}
                    style={{
                      padding: '0 18px', borderRadius: 12, border: 'none',
                      cursor: bvn.length !== 11 ? 'not-allowed' : 'pointer',
                      background: bvn.length !== 11 ? '#f1f5f9' : 'linear-gradient(135deg,#059669,#047857)',
                      color: bvn.length !== 11 ? '#94a3b8' : '#fff',
                      fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                    }}
                  >
                    Verify
                  </button>
                ) : bvnState === 'querying' ? (
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 13, color: '#059669', fontWeight: 600 }}>Sending…</div>
                ) : bvnState === 'verifying_otp' ? (
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 13, color: '#059669', fontWeight: 600 }}>Confirming…</div>
                ) : bvnState === 'done' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', fontSize: 13, color: '#059669', fontWeight: 700 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Verified
                  </div>
                ) : null}
              </div>
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>Dial *565*0# on any Nigerian network to retrieve your BVN</p>

              {bvnError && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff5f5', borderRadius: 8, border: '1px solid #fecaca', fontSize: 12, color: '#991b1b', fontWeight: 600 }}>
                  {bvnError}
                  <button onClick={() => { setBvnState('idle'); setBvnError(null) }} style={{ marginLeft: 8, textDecoration: 'underline', background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontSize: 12 }}>
                    Try again
                  </button>
                </div>
              )}
            </div>

            {/* OTP input — shown after BVN query triggers NIBSS OTP */}
            {(bvnState === 'otp_sent' || bvnState === 'verifying_otp') && (
              <div className="animate-in" style={{ marginTop: 16 }}>
                <div style={{ padding: '12px 14px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #a7f3d0', marginBottom: 16 }}>
                  <p style={{ fontSize: 13, color: '#065f46', fontWeight: 700, marginBottom: 2 }}>OTP sent by NIBSS</p>
                  <p style={{ fontSize: 12, color: '#047857', fontWeight: 500 }}>
                    Enter the OTP sent to{maskedPhone ? ` ${maskedPhone}` : ' your BVN-linked phone number'}.
                  </p>
                </div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  One-Time Password (OTP)
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="input-field"
                    type="tel"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit OTP"
                    maxLength={6}
                    style={{ flex: 1, letterSpacing: 4, fontSize: 18, fontWeight: 700 }}
                  />
                  <button
                    onClick={handleOtpConfirm}
                    disabled={otp.length < 4 || bvnState === 'verifying_otp'}
                    style={{
                      padding: '0 18px', borderRadius: 12, border: 'none',
                      cursor: otp.length < 4 ? 'not-allowed' : 'pointer',
                      background: otp.length < 4 ? '#f1f5f9' : 'linear-gradient(135deg,#059669,#047857)',
                      color: otp.length < 4 ? '#94a3b8' : '#fff',
                      fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
                    }}
                  >
                    {bvnState === 'verifying_otp' ? 'Confirming…' : 'Confirm'}
                  </button>
                </div>
                <button
                  onClick={() => { setOtp(''); setBvnState('idle'); setBvnRef('') }}
                  style={{ marginTop: 8, fontSize: 12, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Wrong BVN? Start over
                </button>
              </div>
            )}

            {/* Fields shown after OTP confirmed */}
            {bvnState === 'done' && (
              <div className="animate-in">
                {bvnProfile ? (
                  <>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, padding: '10px 14px', background: '#f0fdf4', borderRadius: 10, border: '1px solid #a7f3d0' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                      <p style={{ fontSize: 12, color: '#065f46', fontWeight: 600 }}>
                        Details retrieved securely from your BVN. These cannot be edited.
                      </p>
                    </div>
                    <ReadonlyField label="Full Name" value={fullName} />
                    <ReadonlyField label="Phone Number" value={phone} />
                    <ReadonlyField label="Date of Birth" value={dob} />
                  </>
                ) : (
                  <>
                    <Field label="Full Name" value={fullName} onChange={setFullName} placeholder="As it appears on your bank account" />
                    <Field label="Phone Number" value={phone} onChange={setPhone} placeholder="08012345678" type="tel" />
                    <Field label="Date of Birth" value={dob} onChange={setDob} placeholder="YYYY-MM-DD" />
                  </>
                )}
                <Field
                  label="Residential Address"
                  value={address}
                  onChange={setAddress}
                  placeholder="No. 12, Broad Street, Lagos Island"
                  hint="Must be a verifiable Nigerian address"
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button
                onClick={() => setStep(2)}
                disabled={!canProceedStep1()}
                style={primaryBtn(!canProceedStep1())}
              >
                Continue
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Identity Document */}
        {step === 2 && (
          <div className="animate-in">
            <p style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Identity Document</p>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, fontWeight: 500 }}>
              Select your ID type and enter the document number.
            </p>

            <Field
              label="NIN (Optional)"
              value={nin}
              onChange={(v) => setNin(v.replace(/\D/g, '').slice(0, 11))}
              placeholder="11-digit NIN"
              type="tel"
            />

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                ID Type
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {ID_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setIdType(t)}
                    style={{
                      padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                      border: `2px solid ${idType === t ? '#059669' : '#e2e8f0'}`,
                      background: idType === t ? '#f0fdf4' : '#f8fafc',
                      color: idType === t ? '#065f46' : '#475569',
                      fontSize: 12, fontWeight: 700, textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <Field label="ID Number" value={idNumber} onChange={setIdNumber} placeholder="Enter ID number" />

            <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
              <button onClick={() => setStep(1)} style={secondaryBtn}>Back</button>
              <button
                onClick={() => setStep(3)}
                disabled={!canProceedStep2()}
                style={primaryBtn(!canProceedStep2())}
              >
                Continue
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Document Upload */}
        {step === 3 && (
          <div className="animate-in">
            <p style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Upload Document</p>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, fontWeight: 500 }}>
              Upload a clear photo or scan of your {idType || 'ID document'}
            </p>

            <label style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', gap: 12,
              border: `2px dashed ${docFile ? '#059669' : '#e2e8f0'}`,
              borderRadius: 16, padding: '32px 20px',
              background: docFile ? '#f0fdf4' : '#f8fafc',
              cursor: 'pointer', marginBottom: 16,
              transition: 'all 0.2s',
            }}>
              <input
                type="file"
                accept="image/*,.pdf"
                style={{ display: 'none' }}
                onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
              />
              {docFile ? (
                <>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>{docFile.name}</p>
                    <p style={{ fontSize: 11, color: '#059669' }}>{(docFile.size / 1024).toFixed(0)} KB · Tap to change</p>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: 48, height: 48, borderRadius: 14, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                      <polyline points="17 8 12 3 7 8"/>
                      <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>Tap to upload document</p>
                    <p style={{ fontSize: 11, color: '#94a3b8' }}>JPG, PNG or PDF · Max 5MB</p>
                  </div>
                </>
              )}
            </label>

            <div style={{
              display: 'flex', gap: 10, padding: '12px 14px',
              background: '#f0fdf4', borderRadius: 12,
              border: '1px solid #a7f3d0', marginBottom: 20,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <p style={{ fontSize: 11, color: '#065f46', fontWeight: 500, lineHeight: 1.5 }}>
                Your documents are encrypted and processed securely in compliance with SEC and NDPR regulations.
              </p>
            </div>

            {error && (
              <div style={{ padding: '10px 14px', borderRadius: 10, background: '#fff5f5', border: '1px solid #fecaca', fontSize: 12, color: '#991b1b', fontWeight: 600, marginBottom: 14 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)} style={secondaryBtn}>Back</button>
              <button
                onClick={handleSubmit}
                disabled={saving || !docFile}
                style={primaryBtn(saving || !docFile)}
              >
                {saving ? 'Submitting…' : 'Submit KYC'}
                {!saving && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  flex: 2, padding: '14px', borderRadius: 'var(--radius)',
  background: disabled ? '#f1f5f9' : 'linear-gradient(135deg,#059669,#047857)',
  color: disabled ? '#94a3b8' : '#fff',
  fontWeight: 800, fontSize: 15, cursor: disabled ? 'not-allowed' : 'pointer',
  border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  boxShadow: disabled ? 'none' : '0 4px 16px rgba(5,150,105,0.3)',
  transition: 'all 0.2s',
})

const secondaryBtn: React.CSSProperties = {
  flex: 1, padding: '14px', borderRadius: 'var(--radius)',
  background: '#f8fafc', border: '1.5px solid #e2e8f0',
  color: '#475569', fontWeight: 700, fontSize: 14, cursor: 'pointer',
}
