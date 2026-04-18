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
    <div style={{
      minHeight: '100svh',
      background: 'linear-gradient(160deg, #050e1a 0%, #071a2e 40%, #062a1e 75%, #074d36 100%)',
      display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: '8%', left: '50%', transform: 'translateX(-50%)',
          width: 360, height: 360, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(5,150,105,0.18) 0%, transparent 65%)',
        }} />
        <div style={{
          position: 'absolute', bottom: '30%', right: -60,
          width: 240, height: 240, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(52,211,153,0.1) 0%, transparent 65%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        {/* Floating ticker dots */}
        {[
          { top: '18%', left: '12%', size: 5, opacity: 0.3 },
          { top: '28%', right: '14%', size: 3, opacity: 0.2 },
          { top: '42%', left: '8%', size: 4, opacity: 0.25 },
          { top: '55%', right: '10%', size: 6, opacity: 0.15 },
        ].map((dot, i) => (
          <div key={i} style={{
            position: 'absolute', ...dot as React.CSSProperties,
            width: dot.size, height: dot.size, borderRadius: '50%',
            background: '#10b981', opacity: dot.opacity,
          }} />
        ))}
      </div>

      {/* Top hero area */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 'calc(env(safe-area-inset-top,0px) + 48px) 32px 32px',
        position: 'relative', zIndex: 1,
      }}>
        <MonetaLogo size="lg" inverted />

        <h1 style={{
          marginTop: 20,
          fontSize: 32, fontWeight: 900, color: '#fff',
          letterSpacing: -1, lineHeight: 1.1, textAlign: 'center',
        }}>
          Invest in the
          <br />
          <span style={{
            background: 'linear-gradient(90deg, #34d399, #10b981)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>Nigerian Market</span>
        </h1>
        <p style={{
          marginTop: 12, fontSize: 14, color: 'rgba(255,255,255,0.5)',
          textAlign: 'center', fontWeight: 500, lineHeight: 1.6, maxWidth: 260,
        }}>
          Real-time NGX prices, instant order placement, SEC-regulated
        </p>

      </div>

      {/* Frosted glass form card */}
      <div style={{
        background: 'rgba(255,255,255,0.96)',
        borderRadius: '32px 32px 0 0',
        padding: '32px 24px calc(env(safe-area-inset-bottom,0px) + 40px)',
        boxShadow: '0 -8px 48px rgba(0,0,0,0.28)',
        position: 'relative', zIndex: 2,
      }}>
        {/* Handle */}
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e2e8f0', margin: '0 auto 28px' }} />

        <h2 style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginBottom: 6, letterSpacing: -0.5 }}>
          Welcome back
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24, fontWeight: 500 }}>
          Sign in to your Moneta account
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={labelStyle}>Email</label>
            <input
              className="input-field"
              type="email" value={email}
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
                style={{ paddingRight: 56 }}
              />
              <button
                type="button" onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  color: showPass ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
                }}
              >
                {showPass ? 'HIDE' : 'SHOW'}
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              background: '#fff5f5', border: '1.5px solid #fecaca',
              borderRadius: 10, padding: '11px 14px',
              color: '#b91c1c', fontSize: 13, fontWeight: 500,
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0,marginTop:1}}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              marginTop: 4, padding: '16px',
              background: loading ? '#f1f5f9' : 'linear-gradient(135deg, #059669, #047857)',
              color: loading ? '#94a3b8' : '#fff',
              borderRadius: 'var(--radius)', fontSize: 16, fontWeight: 800,
              letterSpacing: 0.2,
              boxShadow: loading ? 'none' : '0 8px 28px rgba(5,150,105,0.40)',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
          Don't have an account?{' '}
          <Link to="/register" style={{ color: 'var(--primary)', fontWeight: 700, textDecoration: 'none' }}>
            Create Account
          </Link>
        </p>

        <div style={{
          marginTop: 24,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          padding: '9px 16px', borderRadius: 20,
          background: '#f0fdf4', border: '1px solid #bbf7d0',
          color: '#065f46', fontSize: 11, fontWeight: 600,
          width: 'fit-content', margin: '24px auto 0',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
          SEC-Registered Digital Sub-Broker · PAC Securities
        </div>
      </div>
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'var(--text-secondary)', marginBottom: 8,
  letterSpacing: 0.5, textTransform: 'uppercase',
}
