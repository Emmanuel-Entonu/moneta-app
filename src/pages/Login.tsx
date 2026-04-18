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

      {/* Hero section */}
      <div style={{
        background: 'linear-gradient(160deg, #050e1a 0%, #0c1f2e 35%, #064e3b 75%, #059669 100%)',
        padding: 'calc(env(safe-area-inset-top,0px) + 52px) 32px 52px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        borderRadius: '0 0 40px 40px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorative orbs */}
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(5,150,105,0.22) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -20, left: -20,
          width: 140, height: 140, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(52,211,153,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        {/* Grid pattern */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <MonetaLogo size="lg" inverted />
          <p style={{
            color: 'rgba(255,255,255,0.6)',
            fontSize: 13,
            marginTop: 12,
            letterSpacing: 0.3,
            textAlign: 'center',
            fontWeight: 500,
          }}>
            Your gateway to the Nigerian Stock Exchange
          </p>

          {/* Stats chips */}
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            {[
              { label: 'NGX Listed', val: '200+' },
              { label: 'Live Prices', val: 'Real-time' },
            ].map(({ label, val }) => (
              <div key={label} style={{
                padding: '7px 14px', borderRadius: 20,
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                backdropFilter: 'blur(8px)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
              }}>
                <span style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: -0.3 }}>{val}</span>
                <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form section */}
      <div style={{ flex: 1, padding: '32px 24px 40px' }}>
        <h2 style={{ fontSize: 24, fontWeight: 900, color: 'var(--text)', marginBottom: 6, letterSpacing: -0.5 }}>
          Welcome back
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28, fontWeight: 500 }}>
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
                style={{ paddingRight: 52 }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  right: 14,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: showPass ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 0.4,
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
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
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
              letterSpacing: 0.2,
              boxShadow: loading ? 'none' : '0 6px 24px rgba(5,150,105,0.38)',
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
          padding: '10px 18px',
          borderRadius: 20,
          background: '#f0fdf4',
          border: '1px solid #a7f3d0',
          color: '#065f46',
          fontSize: 11,
          fontWeight: 600,
          width: 'fit-content',
          margin: '36px auto 0',
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text-secondary)',
  marginBottom: 8,
  letterSpacing: 0.4,
  textTransform: 'uppercase',
}
