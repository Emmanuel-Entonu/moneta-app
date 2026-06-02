import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'

export default function CacsRequest() {
  const navigate = useNavigate()
  const { user, pacAccountId, loadProfile } = useAuthStore()
  const fileRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null
    setError(null)
    if (!file) { setSelectedFile(null); return }
    if (file.type !== 'application/pdf') { setError('Only PDF files are accepted.'); return }
    if (file.size > 10 * 1024 * 1024) { setError('File must be under 10 MB.'); return }
    setSelectedFile(file)
  }

  async function handleSubmit() {
    if (!selectedFile || !user) return
    setUploading(true)
    setError(null)

    try {
      const ext = 'pdf'
      const path = `${user.id}/cacs-form.${ext}`

      const { error: uploadErr } = await supabase.storage
        .from('cacs-docs')
        .upload(path, selectedFile, { upsert: true, contentType: 'application/pdf' })

      if (uploadErr) throw new Error(uploadErr.message)

      const { data: urlData } = supabase.storage.from('cacs-docs').getPublicUrl(path)

      const { error: dbErr } = await supabase
        .from('profiles')
        .update({ cacs_status: 'pending', cacs_doc_url: urlData.publicUrl, cacs_rejection_reason: null })
        .eq('id', user.id)

      if (dbErr) throw new Error(dbErr.message)

      await loadProfile()
      navigate('/cacs-status')
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div style={{ minHeight: '100svh', background: '#070e1a', display: 'flex', flexDirection: 'column', paddingBottom: 40 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', paddingTop: 'calc(env(safe-area-inset-top,0px) + 14px)', background: '#050d1a', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        <button onClick={() => navigate(-1)} style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div>
          <p style={{ fontWeight: 900, fontSize: 17, color: '#fff', letterSpacing: -0.3 }}>Request Trading Account</p>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>CACS Form Submission</p>
        </div>
      </div>

      <div style={{ flex: 1, padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>

        {/* What is this */}
        <div style={{ background: '#0e1c2f', borderRadius: 20, padding: '20px', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(5,150,105,0.18)', border: '1px solid rgba(5,150,105,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div>
              <p style={{ fontWeight: 800, fontSize: 15, color: '#fff', marginBottom: 2 }}>NGX Trading Account</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>Required to place buy & sell orders</p>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, fontWeight: 500 }}>
            The <strong style={{ color: '#fff' }}>Client Account Creation System (CACS)</strong> form registers you with the Nigerian Exchange Group (NGX) and assigns your CSCS trading account number. This is a regulatory requirement for stock trading in Nigeria.
          </p>
        </div>

        {/* Your reference info */}
        {pacAccountId && (
          <div style={{ background: '#0e1c2f', borderRadius: 16, padding: '16px', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Your Reference Details</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>Email</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{user?.email ?? '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>PAC Account ID</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#34d399', fontFamily: 'monospace' }}>{pacAccountId}</span>
              </div>
            </div>
          </div>
        )}

        {/* Steps */}
        <div style={{ background: '#0e1c2f', borderRadius: 20, padding: '20px', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 16 }}>How It Works</p>
          {[
            { n: '1', title: 'Download the CACS form', desc: 'Get the official NGX Client Account Creation System PDF form below.' },
            { n: '2', title: 'Fill it out completely', desc: 'Use your legal name exactly as it appears on your BVN. Include your PAC Account ID in the designated field.' },
            { n: '3', title: 'Upload the signed form', desc: 'Scan or photograph the completed form and upload it as a PDF. Clear, legible copies only.' },
            { n: '4', title: 'Wait for approval', desc: 'Our team reviews your form and activates your NGX/CSCS trading account, usually within 1–3 business days.' },
          ].map(({ n, title, desc }) => (
            <div key={n} style={{ display: 'flex', gap: 14, marginBottom: 16 }}>
              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(5,150,105,0.2)', border: '1px solid rgba(5,150,105,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 900, color: '#34d399' }}>{n}</span>
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{title}</p>
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, fontWeight: 500 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Download */}
        <div
          onClick={async () => {
            const url = 'https://moneta-app-ten.vercel.app/account-opening-form.pdf'
            if (Capacitor.isNativePlatform()) {
              await Browser.open({ url })
            } else {
              window.open(url, '_blank')
            }
          }}
          style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: 'rgba(29,78,216,0.15)', border: '1.5px solid rgba(59,130,246,0.35)', borderRadius: 18, textDecoration: 'none', cursor: 'pointer' }}
        >
          <div style={{ width: 44, height: 44, borderRadius: 14, background: 'rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#60a5fa', marginBottom: 2 }}>Download CACS Form</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Official NGX PDF · Fill out before uploading</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(96,165,250,0.6)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </div>

        {/* Upload */}
        <div style={{ background: '#0e1c2f', borderRadius: 20, padding: '20px', border: '1px solid rgba(255,255,255,0.07)' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4 }}>Upload Completed Form</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500, marginBottom: 16 }}>PDF only · Max 10 MB · Must be signed</p>

          <div
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${selectedFile ? 'rgba(5,150,105,0.6)' : 'rgba(255,255,255,0.15)'}`, borderRadius: 14, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', background: selectedFile ? 'rgba(5,150,105,0.08)' : 'rgba(255,255,255,0.03)', transition: 'all 0.2s' }}
          >
            {selectedFile ? (
              <>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(5,150,105,0.2)', border: '1px solid rgba(5,150,105,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: '#34d399', marginBottom: 4 }}>{selectedFile.name}</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>{(selectedFile.size / 1024).toFixed(0)} KB · Tap to change</p>
              </>
            ) : (
              <>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>Tap to select PDF</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 500 }}>Your form will be uploaded securely</p>
              </>
            )}
          </div>
          <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={handleFileChange} />
        </div>

        {error && (
          <div style={{ padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 13, color: '#f87171', fontWeight: 600 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={!selectedFile || uploading}
          style={{ padding: '16px', borderRadius: 18, background: !selectedFile || uploading ? 'rgba(255,255,255,0.08)' : 'linear-gradient(135deg,#059669,#047857)', color: !selectedFile || uploading ? 'rgba(255,255,255,0.25)' : '#fff', fontWeight: 900, fontSize: 16, cursor: !selectedFile || uploading ? 'not-allowed' : 'pointer', boxShadow: !selectedFile || uploading ? 'none' : '0 6px 24px rgba(5,150,105,0.38)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}
        >
          {uploading && <div style={{ width: 18, height: 18, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />}
          {uploading ? 'Submitting…' : 'Submit Form for Review'}
        </button>

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', textAlign: 'center', lineHeight: 1.6, fontWeight: 500 }}>
          By submitting, you confirm the information on the form is accurate and matches your BVN records. Your document is stored securely and only reviewed by authorized Moneta staff.
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
