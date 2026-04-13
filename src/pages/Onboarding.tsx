import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import MonetaLogo from '../components/MonetaLogo'
import { useAuthStore } from '../store/authStore'

const SLIDES = [
  {
    image: '/Track the nigerian stock exchange live.png',
    tag: 'Real-Time Market Data',
    title: 'Track the Nigerian Stock Exchange Live',
    body: 'Get real-time prices, charts, and market movements for all NGX-listed equities — right in your pocket.',
  },
  {
    image: '/Your Investments, All in One Place.png',
    tag: 'Portfolio Management',
    title: 'Your Investments, All in One Place',
    body: 'Monitor your holdings, track unrealized gains and losses, and see exactly how your portfolio is performing.',
  },
  {
    image: '/Trade Nigerian Stocks Instantly.png',
    tag: 'Buy & Sell',
    title: 'Trade Nigerian Stocks Instantly',
    body: 'Place market and limit orders for any NGX-listed stock in seconds, powered by PAC Securities — a licensed Nigerian broker.',
  },
  {
    image: '/Safe, Secure & Fully Compliant.png',
    tag: 'SEC Regulated',
    title: 'Safe, Secure & Fully Compliant',
    body: 'Moneta operates under SEC Nigeria\'s Digital Sub-Broker framework. Your identity is verified through KYC and your funds are protected.',
  },
]

export default function Onboarding() {
  const [current, setCurrent] = useState(0)
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  function finish() {
    const key = user ? `moneta_onboarded_${user.id}` : 'moneta_onboarded'
    localStorage.setItem(key, '1')
    navigate('/market')
  }

  function next() {
    if (current < SLIDES.length - 1) setCurrent(current + 1)
    else finish()
  }

  function prev() {
    if (current > 0) setCurrent(current - 1)
  }

  const slide = SLIDES[current]
  const isLast = current === SLIDES.length - 1

  return (
    <div style={{
      minHeight: '100svh',
      display: 'flex',
      flexDirection: 'column',
      background: '#fff',
      userSelect: 'none',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 16px',
      }}>
        <MonetaLogo size="sm" />
        {!isLast && (
          <button
            onClick={finish}
            style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', padding: '6px 12px' }}
          >
            Skip
          </button>
        )}
      </div>

      {/* Slide area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 32px',
        textAlign: 'center',
      }}>
        {/* Illustration */}
        <img
          src={slide.image}
          alt={slide.title}
          style={{
            width: 220,
            height: 220,
            objectFit: 'contain',
            marginBottom: 36,
          }}
        />

        {/* Tag */}
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11,
          fontWeight: 800,
          color: '#059669',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          padding: '5px 12px',
          borderRadius: 20,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          marginBottom: 18,
        }}>
          {slide.tag}
        </span>

        {/* Title */}
        <h2 style={{
          fontSize: 26,
          fontWeight: 900,
          color: 'var(--text)',
          lineHeight: 1.2,
          letterSpacing: -0.5,
          marginBottom: 14,
        }}>
          {slide.title}
        </h2>

        {/* Body */}
        <p style={{
          fontSize: 15,
          color: 'var(--text-muted)',
          lineHeight: 1.65,
          fontWeight: 500,
          maxWidth: 300,
        }}>
          {slide.body}
        </p>
      </div>

      {/* Bottom controls */}
      <div style={{
        padding: '24px 24px calc(env(safe-area-inset-bottom, 0px) + 32px)',
      }}>
        {/* Dots */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          marginBottom: 28,
        }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              style={{
                width: i === current ? 24 : 8,
                height: 8,
                borderRadius: 4,
                background: i === current ? '#059669' : '#d1fae5',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                padding: 0,
              }}
            />
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          {current > 0 && (
            <button
              onClick={prev}
              style={{
                flex: 1,
                padding: '15px',
                borderRadius: 'var(--radius)',
                border: '1.5px solid var(--border)',
                background: '#fff',
                fontSize: 15,
                fontWeight: 700,
                color: 'var(--text)',
                cursor: 'pointer',
              }}
            >
              Back
            </button>
          )}

          <button
            onClick={next}
            style={{
              flex: current > 0 ? 2 : 1,
              padding: '15px',
              borderRadius: 'var(--radius)',
              background: 'linear-gradient(135deg, #059669, #047857)',
              border: 'none',
              fontSize: 15,
              fontWeight: 700,
              color: '#fff',
              cursor: 'pointer',
              boxShadow: '0 4px 20px rgba(5,150,105,0.35)',
              transition: 'all 0.2s',
            }}
          >
            {isLast ? 'Start Trading' : 'Next'}
          </button>
        </div>

        {/* SEC badge on last slide */}
        {isLast && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            marginTop: 20,
            color: 'var(--text-muted)',
            fontSize: 11,
            fontWeight: 500,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Licensed Digital Sub-Broker · PAC Securities · SEC Nigeria
          </div>
        )}
      </div>
    </div>
  )
}
