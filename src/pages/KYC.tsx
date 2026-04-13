import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { createBrokerAccount } from '../lib/pacApi'
import { USE_MOCK_BROKER } from '../store/portfolioStore'
import MonetaLogo from '../components/MonetaLogo'
import { initBvnVerification, verifyBvnOtp, getBvnDetails } from '../lib/nibssApi'

type Step = 1 | 2 | 3

const ID_TYPES = [
  'National ID (NIN)',
  'International Passport',
  "Driver's Licence",
  "Voter's Card",
]

function StepIndicator({ current }: { current: Step }) {
  const steps = [
    { n: 1, label: 'Personal Info' },
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

  // Step 1
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [address, setAddress] = useState('')

  // Step 2
  const [bvn, setBvn] = useState('')
  const [nin, setNin] = useState('')
  const [idType, setIdType] = useState('')
  const [idNumber, setIdNumber] = useState('')

  // BVN verification flow
  type BvnState = 'idle' | 'sending' | 'otp' | 'verifying' | 'done' | 'error'
  const [bvnState, setBvnState] = useState<BvnState>('idle')
  const [bvnRef, setBvnRef] = useState('')
  const [bvnOtp, setBvnOtp] = useState('')
  const [bvnError, setBvnError] = useState<string | null>(null)

  async function sendBvnOtp() {
    setBvnState('sending')
    setBvnError(null)
    try {
      const ref = await initBvnVerification(bvn, phone || undefined)
      setBvnRef(ref)
      setBvnState('otp')
    } catch (e: unknown) {
      setBvnError((e as Error).message)
      setBvnState('error')
    }
  }

  async function confirmBvnOtp() {
    setBvnState('verifying')
    setBvnError(null)
    try {
      await verifyBvnOtp(bvnRef, bvnOtp)
      const profile = await getBvnDetails(bvnRef)
      // Pre-fill name and DOB from BVN if step 1 fields are empty
      if (!fullName.trim() && profile.firstName) setFullName(`${profile.firstName} ${profile.surname}`.trim())
      if (!dob && profile.dob) setDob(profile.dob)

      // BVN verified — immediately mark KYC as verified and provision broker account
      if (user) {
        await supabase.from('profiles').upsert({
          id: user.id,
          full_name: fullName || `${profile.firstName} ${profile.surname}`.trim(),
          kyc_status: 'verified',
        })

        // Provision broker account
        let pacAccountId: string
        if (USE_MOCK_BROKER) {
          pacAccountId = `PAC-${user.id.slice(0, 8).toUpperCase()}`
        } else {
          pacAccountId = await createBrokerAccount({
            fullName: fullName || `${profile.firstName} ${profile.surname}`.trim(),
            email: user.email ?? '',
            phone,
            bvn,
          })
        }
        await supabase.from('profiles').update({ pac_account_id: pacAccountId }).eq('id', user.id)
        await loadProfile()
      }

      setBvnState('done')

      // Navigate immediately — trading is now unlocked
      const dest = localStorage.getItem(`moneta_onboarded_${user?.id}`) ? '/market' : '/onboarding'
      navigate(dest)
    } catch (e: unknown) {
      setBvnError((e as Error).message)
      setBvnState('error')
    }
  }

  const [showSkipModal, setShowSkipModal] = useState(false)

  function confirmSkip() {
    localStorage.setItem(`moneta_kyc_skipped_${user?.id}`, '1')
    const dest = localStorage.getItem(`moneta_onboarded_${user?.id}`) ? '/market' : '/onboarding'
    navigate(dest)
  }

  function canProceedStep1() {
    return fullName.trim().length > 1 && phone.trim().length > 8 && dob && address.trim().length > 4
  }

  function canProceedStep2() {
    return bvnState === 'done' && idType && idNumber.trim().length > 3
  }

  async function handleSubmit() {
    if (!user) return
    setSaving(true); setError(null)
    try {
      // 1. Save KYC data to Supabase
      const { error: dbError } = await supabase.from('profiles').upsert({
        id: user.id,
        full_name: fullName,
        phone,
        date_of_birth: dob || null,
        address,
        bvn,
        kyc_status: bvnState === 'done' ? 'verified' : 'submitted',
      })
      if (dbError) throw new Error(dbError.message)

      // 2. Provision a broker account (mock or real)
      let pacAccountId: string
      if (USE_MOCK_BROKER) {
        // Deterministic fake ID so it's stable across sessions
        pacAccountId = `PAC-${user.id.slice(0, 8).toUpperCase()}`
      } else {
        pacAccountId = await createBrokerAccount({
          fullName,
          email: user.email ?? '',
          phone,
          bvn,
        })
      }

      // 3. Store the broker account ID in the user's profile
      await supabase.from('profiles').update({ pac_account_id: pacAccountId }).eq('id', user.id)

      // 4. Refresh auth store so pacAccountId is available immediately
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
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: '0 0 32px',
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
              <button
                onClick={() => setShowSkipModal(false)}
                style={{
                  flex: 1, padding: '14px', borderRadius: 'var(--radius)',
                  background: '#f8fafc', border: '1.5px solid #e2e8f0',
                  color: '#0f172a', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmSkip}
                style={{
                  flex: 1, padding: '14px', borderRadius: 'var(--radius)',
                  background: '#fff7ed', border: '1.5px solid #fed7aa',
                  color: '#c2410c', fontWeight: 700, fontSize: 15, cursor: 'pointer',
                }}
              >
                Skip anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div style={{ flex: 1, padding: '24px 20px 40px', overflowY: 'auto' }}>
        <StepIndicator current={step} />

        {/* Step 1 — Personal Info */}
        {step === 1 && (
          <div className="animate-in">
            <p style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Personal Information</p>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, fontWeight: 500 }}>
              Must match your government-issued ID exactly
            </p>

            <Field label="Full Legal Name" value={fullName} onChange={setFullName} placeholder="e.g. Adebayo Okafor" />
            <Field label="Phone Number" value={phone} onChange={setPhone} placeholder="+234 800 000 0000" type="tel" />
            <Field label="Date of Birth" value={dob} onChange={setDob} type="date" />
            <Field
              label="Residential Address"
              value={address}
              onChange={setAddress}
              placeholder="No. 12, Broad Street, Lagos Island"
              hint="Must be a verifiable Nigerian address"
            />

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

        {/* Step 2 — Identity */}
        {step === 2 && (
          <div className="animate-in">
            <p style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>Identity Verification</p>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, fontWeight: 500 }}>
              Your BVN links your banking identity. It is never shared with third parties.
            </p>

            {/* BVN Verification */}
            <div style={{ marginBottom: 16 }}>
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
                    if (bvnState !== 'idle') { setBvnState('idle'); setBvnError(null) }
                  }}
                  placeholder="11-digit BVN"
                  disabled={bvnState === 'done'}
                  style={{ flex: 1, opacity: bvnState === 'done' ? 0.7 : 1 }}
                />
                {bvnState === 'idle' || bvnState === 'error' ? (
                  <button
                    onClick={sendBvnOtp}
                    disabled={bvn.length !== 11}
                    style={{
                      padding: '0 16px', borderRadius: 12, border: 'none', cursor: bvn.length !== 11 ? 'not-allowed' : 'pointer',
                      background: bvn.length !== 11 ? '#f1f5f9' : 'linear-gradient(135deg,#059669,#047857)',
                      color: bvn.length !== 11 ? '#94a3b8' : '#fff',
                      fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                    }}
                  >
                    Send OTP
                  </button>
                ) : bvnState === 'sending' ? (
                  <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', fontSize: 12, color: '#059669', fontWeight: 600 }}>Sending…</div>
                ) : bvnState === 'done' ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', fontSize: 12, color: '#059669', fontWeight: 700 }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Verified
                  </div>
                ) : null}
              </div>
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>Dial *565*0# on any Nigerian network to retrieve your BVN</p>

              {/* OTP input */}
              {(bvnState === 'otp' || bvnState === 'verifying') && (
                <div style={{ marginTop: 10, padding: '14px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #a7f3d0' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#065f46', marginBottom: 10 }}>
                    OTP sent to your BVN-registered phone. Enter it below:
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      className="input-field"
                      type="tel"
                      value={bvnOtp}
                      onChange={(e) => setBvnOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit OTP"
                      maxLength={6}
                      style={{ flex: 1 }}
                    />
                    <button
                      onClick={confirmBvnOtp}
                      disabled={bvnOtp.length !== 6 || bvnState === 'verifying'}
                      style={{
                        padding: '0 16px', borderRadius: 12, border: 'none',
                        cursor: bvnOtp.length !== 6 || bvnState === 'verifying' ? 'not-allowed' : 'pointer',
                        background: bvnOtp.length !== 6 || bvnState === 'verifying' ? '#f1f5f9' : 'linear-gradient(135deg,#059669,#047857)',
                        color: bvnOtp.length !== 6 || bvnState === 'verifying' ? '#94a3b8' : '#fff',
                        fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap',
                      }}
                    >
                      {bvnState === 'verifying' ? 'Verifying…' : 'Confirm'}
                    </button>
                  </div>
                  {bvnState === 'verifying' && (
                    <p style={{ fontSize: 11, color: '#059669', marginTop: 8, fontWeight: 500 }}>
                      Retrieving BVN details, please wait…
                    </p>
                  )}
                </div>
              )}

              {/* Error */}
              {bvnError && (
                <div style={{ marginTop: 8, padding: '8px 12px', background: '#fff5f5', borderRadius: 8, border: '1px solid #fecaca', fontSize: 12, color: '#991b1b', fontWeight: 600 }}>
                  {bvnError}
                  <button onClick={() => { setBvnState('idle'); setBvnError(null) }} style={{ marginLeft: 8, textDecoration: 'underline', background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontSize: 12 }}>
                    Try again
                  </button>
                </div>
              )}
            </div>

            <Field
              label="NIN (Optional)"
              value={nin}
              onChange={(v) => setNin(v.replace(/\D/g, '').slice(0, 11))}
              placeholder="11-digit NIN"
              type="tel"
            />

            {/* ID Type selector */}
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

            {/* Upload area */}
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
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#065f46' }}>{docFile.name}</p>
                    <p style={{ fontSize: 11, color: '#059669' }}>{(docFile.size / 1024).toFixed(0)} KB · Tap to change</p>
                  </div>
                </>
              ) : (
                <>
                  <div style={{
                    width: 48, height: 48, borderRadius: 14,
                    background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
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

            {/* Security note */}
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
              <div style={{
                padding: '10px 14px', borderRadius: 10,
                background: '#fff5f5', border: '1px solid #fecaca',
                fontSize: 12, color: '#991b1b', fontWeight: 600, marginBottom: 14,
              }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(2)} style={secondaryBtn}>Back</button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                style={primaryBtn(saving)}
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
