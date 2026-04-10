import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import MonetaLogo from '../components/MonetaLogo'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const signIn = useAuthStore((s) => s.signIn)
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const err = await signIn(email, password)
    setLoading(false)
    if (err) setError(err)
    else navigate('/market')
  }

  return (
    <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', background: '#fff' }}>

      {/* Top green hero */}
      <div style={{
        background: 'linear-gradient(160deg, #064e3b 0%, #059669 60%, #10b981 100%)',
        padding: '56px 32px 48px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        borderRadius: '0 0 36px 36px',
      }}>
        <MonetaLogo size="lg" inverted />
        <p style={{
          color: 'rgba(255,255,255,0.75)',
          fontSize: 14,
          marginTop: 10,
          letterSpacing: 0.2,
          textAlign: 'center',
        }}>
          Your gateway to the Nigerian Stock Exchange
        </p>
      </div>

      {/* Form card */}
      <div style={{ flex: 1, padding: '32px 24px 40px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
          Welcome back
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28 }}>
          Sign in to your Moneta account
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={labelStyle}>Email Address</label>
            <input
              className="input-field"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label style={labelStyle}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="input-field"
                type={showPass ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your password"
                required
                style={{ paddingRight: 48 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  right: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: 0.3,
                }}
              >
                {showPass ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 10,
              background: 'var(--down-dim)',
              borderLeft: '3px solid var(--down)',
              borderRadius: 8,
              padding: '12px 14px',
              color: 'var(--down-text)',
              fontSize: 13,
              fontWeight: 500,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 4,
              padding: '15px',
              background: loading
                ? 'var(--bg-elevated)'
                : 'linear-gradient(135deg, #059669, #047857)',
              color: loading ? 'var(--text-muted)' : '#fff',
              borderRadius: 'var(--radius)',
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 0.2,
              boxShadow: loading ? 'none' : '0 4px 20px rgba(5,150,105,0.35)',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 28, fontSize: 14, color: 'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>
            Create Account
          </Link>
        </p>

        {/* SEC badge */}
        <div style={{
          marginTop: 36,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: 'var(--text-muted)',
          fontSize: 11,
          fontWeight: 500,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          SEC-Registered Digital Sub-Broker · PAC Securities
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: 7,
  letterSpacing: 0.3,
  textTransform: 'uppercase',
}

