import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import MonetaLogo from '../components/MonetaLogo'

export default function Register() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const signUp = useAuthStore((s) => s.signUp)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) return setError('Passwords do not match.')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    setLoading(true)
    const err = await signUp(email, password, fullName)
    setLoading(false)
    if (err) setError(err)
    else navigate('/kyc')
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', background: '#fff' }}>

      {/* Compact dark header */}
      <div style={{
        background: 'linear-gradient(160deg, #050e1a 0%, #0c1f2e 40%, #064e3b 100%)',
        padding: 'calc(env(safe-area-inset-top,0px) + 22px) 20px 28px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        borderRadius: '0 0 32px 32px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
          pointerEvents: 'none',
        }} />
        <button
          onClick={() => navigate('/login')}
          style={{
            width: 40,
            height: 40,
            borderRadius: 13,
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            flexShrink: 0,
            position: 'relative',
            zIndex: 1,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <MonetaLogo size="sm" inverted />
        </div>
      </div>

      {/* Form */}
      <div style={{ flex: 1, padding: '28px 24px 40px' }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', marginBottom: 5, letterSpacing: -0.5 }}>
          Create your account
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28, fontWeight: 500 }}>
          Start investing on the NSE today
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: 'Full Name', type: 'text', value: fullName, setter: setFullName, placeholder: 'John Doe' },
            { label: 'Email Address', type: 'email', value: email, setter: setEmail, placeholder: 'you@example.com' },
            { label: 'Password', type: 'password', value: password, setter: setPassword, placeholder: 'Min. 8 characters' },
            { label: 'Confirm Password', type: 'password', value: confirm, setter: setConfirm, placeholder: 'Repeat password' },
          ].map(({ label, type, value, setter, placeholder }) => (
            <div key={label}>
              <label style={labelStyle}>{label}</label>
              <input
                className="input-field"
                type={type}
                value={value}
                onChange={(e) => setter(e.target.value)}
                placeholder={placeholder}
                required
              />
            </div>
          ))}

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              background: '#fff5f5',
              border: '1.5px solid #fecaca',
              borderRadius: 10,
              padding: '12px 14px',
              color: '#991b1b',
              fontSize: 13,
              fontWeight: 500,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6,
              padding: '16px',
              background: loading
                ? 'var(--bg-elevated)'
                : 'linear-gradient(135deg, #059669, #047857)',
              color: loading ? 'var(--text-muted)' : '#fff',
              borderRadius: 'var(--radius)',
              fontSize: 16,
              fontWeight: 800,
              boxShadow: loading ? 'none' : '0 6px 24px rgba(5,150,105,0.38)',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>

          <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.6 }}>
            By registering you agree to our Terms of Service. Your data is protected under SEC and NDPR regulations.
          </p>
        </form>

        <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>
            Sign In
          </Link>
        </p>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-secondary)',
  marginBottom: 8,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
}
