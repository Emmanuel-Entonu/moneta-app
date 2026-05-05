import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { createBrokerAccount } from '../lib/pacApi'
import MonetaLogo from '../components/MonetaLogo'

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

  // BVN & personal data
  const [bvn, setBvn] = useState('')
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [dob, setDob] = useState('')
  const [address, setAddress] = useState('')

  // Step 2
  const [idType, setIdType] = useState('')
  const [idNumber, setIdNumber] = useState('')

  const [bvnDone, setBvnDone]         = useState(false)
  const [bvnLoading, setBvnLoading]   = useState(false)
  const [bvnError, setBvnError]       = useState<string | null>(null)
  const [bvnReference, setBvnReference] = useState<string | null>(null)
  const [otp, setOtp]                 = useState('')
  const [otpLoading, setOtpLoading]   = useState(false)

  const [showSkipModal, setShowSkipModal] = useState(false)

  function confirmSkip() {
    localStorage.setItem(`moneta_kyc_skipped_${user?.id}`, '1')
    const dest = localStorage.getItem(`moneta_onboarded_${user?.id}`) ? '/market' : '/onboarding'
    navigate(dest)
  }

  function isValidDob(v: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
    const d = new Date(v)
    if (isNaN(d.getTime())) return false
    const age = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    return age >= 18 && age <= 100
  }

  function canProceedStep1() {
    return (
      bvnDone &&
      fullName.trim().length > 1 &&
      address.trim().length > 4 &&
      phone.replace(/\D/g, '').length >= 10 &&
      isValidDob(dob)
    )
  }

  function canProceedStep2() {
    return !!idType && idNumber.trim().length > 3
  }

  async function handleSubmit() {
    if (!user) return
    setSaving(true); setError(null)
    try {
      // Final sanitization before any network call
      const cleanName    = fullName.trim().slice(0, 255)
      const cleanPhone   = phone.replace(/\D/g, '').replace(/^234/, '0').slice(0, 15)
      const cleanAddress = address.trim().slice(0, 255)
      const cleanBvn     = bvn.replace(/\D/g, '').slice(0, 11)
      const cleanIdNum   = idNumber.trim().replace(/[^a-zA-Z0-9\-\/]/g, '').slice(0, 50)
      if (!cleanName || cleanName.length < 2) throw new Error('Full name is too short')
      if (cleanPhone.length < 10) throw new Error('Phone number is invalid')
      if (!isValidDob(dob)) throw new Error('Date of birth must be YYYY-MM-DD and age must be 18–100')
      if (cleanBvn.length !== 11) throw new Error('BVN must be exactly 11 digits')
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
        full_name: cleanName,
        phone: cleanPhone,
        date_of_birth: dob || null,
        address: cleanAddress,
        bvn: cleanBvn,
        kyc_status: 'verified',
        kyc_doc_url: kycDocUrl,
      })
      if (dbError) throw new Error(dbError.message)

      let pacAccountId: string | null = null
      try {
        pacAccountId = await createBrokerAccount({
          fullName:  cleanName,
          email:     user.email ?? '',
          phone:     cleanPhone,
          bvn:       cleanBvn,
          dob,
          address:   cleanAddress,
          idType,
          idNumber:  cleanIdNum,
        })
      } catch (e) {
        console.warn('Broker account creation failed (will retry later):', e)
      }

      if (pacAccountId) {
        const { error: updateErr } = await supabase.from('profiles').update({ pac_account_id: pacAccountId }).eq('id', user.id)
        if (updateErr) throw new Error(`Failed to save broker account: ${updateErr.message}`)
      }

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

        {/* Step 1 — BVN + Personal Info */}
        {step === 1 && (
          <div className="animate-in">
            <p style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', marginBottom: 4 }}>BVN Verification</p>
            <p style={{ fontSize: 13, color: '#64748b', marginBottom: 20, fontWeight: 500 }}>
              Enter your BVN and fill in your personal details to continue.
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
                    const v = e.target.value.replace(/\D/g, '').slice(0, 11)
                    setBvn(v)
                    if (bvnDone && v.length !== 11) setBvnDone(false)
                  }}
                  placeholder="11-digit BVN"
                  disabled={bvnDone}
                  style={{ flex: 1, opacity: bvnDone ? 0.7 : 1 }}
                />
                {bvnDone ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 12px', fontSize: 13, color: '#059669', fontWeight: 700 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Verified
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      setBvnLoading(true); setBvnError(null)
                      try {
                        const res = await fetch('/api/nibss-bvn', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ bvn }),
                        })
                        const json = await res.json() as Record<string, unknown>
                        // Try multiple locations for the reference
                        const d = (json.data ?? json) as Record<string, unknown>
                        const ref = String(json.customer_reference ?? d.customer_reference ?? d.reference ?? '')
                        setBvnReference(ref || 'pending')  // show OTP input regardless
                      } catch {
                        setBvnReference('pending')  // still show OTP input, let user try
                      } finally {
                        setBvnLoading(false)
                      }
                    }}
                    disabled={bvn.length !== 11 || bvnLoading}
                    style={{
                      padding: '0 18px', borderRadius: 12, border: 'none',
                      cursor: bvn.length !== 11 || bvnLoading ? 'not-allowed' : 'pointer',
                      background: bvn.length !== 11 || bvnLoading ? '#f1f5f9' : 'linear-gradient(135deg,#059669,#047857)',
                      color: bvn.length !== 11 || bvnLoading ? '#94a3b8' : '#fff',
                      fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', minWidth: 80,
                    }}
                  >
                    {bvnLoading ? '…' : 'Send OTP'}
                  </button>
                )}
              </div>
              <p style={{ fontSize: 11, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>Dial *565*0# on any Nigerian network to retrieve your BVN</p>
              {bvnError && <p style={{ fontSize: 11, color: '#dc2626', marginTop: 4, fontWeight: 600 }}>{bvnError}</p>}

              {/* OTP input — shown after OTP is sent */}
              {bvnReference && !bvnDone && (
                <div style={{ marginTop: 12, padding: '14px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #a7f3d0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <p style={{ fontSize: 12, color: '#065f46', fontWeight: 700 }}>OTP sent to your BVN-linked number</p>
                    <button onClick={() => { setBvnDone(true); setBvnReference(null) }} style={{ fontSize: 11, color: '#059669', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Fill manually</button>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input
                      type="tel"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="Enter OTP"
                      style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid #a7f3d0', fontSize: 16, fontWeight: 700, letterSpacing: 4, color: '#065f46' }}
                    />
                    <button
                      onClick={async () => {
                        if (!otp || otp.length < 4) return
                        setOtpLoading(true); setBvnError(null)
                        try {
                          const res = await fetch('/api/nibss-bvn', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'verify-otp', reference: bvnReference, otp }),
                          })
                          const json = await res.json() as Record<string, unknown>
                          if (!res.ok) {
                            const msg = String((json as Record<string, unknown>).message ?? (json as Record<string, unknown>).error ?? 'Wrong OTP. Try again.')
                            setBvnError(msg)
                            return
                          }
                          const d = (json.data ?? json) as Record<string, unknown>
                          const name = String(d.full_name ?? d.fullName ?? d.firstName ?? '').trim()
                          const rawDob = String(d.date_of_birth ?? d.dob ?? d.dateOfBirth ?? '')
                          const rawPh  = String(d.phone_number ?? d.phone ?? d.phoneNumber ?? d.mobile ?? '')
                          if (name) setFullName(name)
                          if (rawDob) {
                            // Normalize to YYYY-MM-DD regardless of what format BVN returns
                            const parsed = new Date(rawDob)
                            const iso = isNaN(parsed.getTime()) ? rawDob : parsed.toISOString().split('T')[0]
                            setDob(iso)
                          }
                          if (rawPh) setPhone(rawPh.replace(/\D/g, '').replace(/^234/, '0'))
                          setBvnDone(true)
                        } catch {
                          setBvnError('OTP verification failed. Check your connection and try again.')
                        } finally {
                          setOtpLoading(false)
                        }
                      }}
                      disabled={otp.length < 4 || otpLoading}
                      style={{ padding: '10px 16px', borderRadius: 10, border: 'none', background: otp.length < 4 || otpLoading ? '#d1fae5' : 'linear-gradient(135deg,#059669,#047857)', color: otp.length < 4 || otpLoading ? '#6ee7b7' : '#fff', fontWeight: 700, fontSize: 13, cursor: otp.length < 4 ? 'not-allowed' : 'pointer' }}
                    >
                      {otpLoading ? '…' : 'Verify'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Personal details — shown after BVN confirmed */}
            {bvnDone && (
              <div className="animate-in">
                <Field label="Full Name" value={fullName} onChange={setFullName} placeholder="As it appears on your bank account" />
                <Field label="Phone Number" value={phone} onChange={setPhone} placeholder="08012345678" type="tel" />
                <Field label="Date of Birth" value={dob} onChange={setDob} placeholder="YYYY-MM-DD" hint="Format: 1990-12-31 · Must be 18 or older" />
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
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null
                  if (!f) return
                  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
                  if (!allowed.includes(f.type)) { setError('Only JPG, PNG, WEBP or PDF files are accepted.'); return }
                  if (f.size > 5 * 1024 * 1024) { setError('File must be under 5MB.'); return }
                  setError(null)
                  setDocFile(f)
                }}
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
