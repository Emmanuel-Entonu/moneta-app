import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import MonetaLogo from '../components/MonetaLogo'
import { useAuthStore } from '../store/authStore'

const SLIDES = [
  {
    image: '/Track the nigerian stock exchange live.png',
    tag: 'Real-Time Data',
    title: 'Track the Nigerian Stock Exchange Live',
    body: 'Real-time prices, charts, and market movements for all NGX-listed equities — right in your pocket.',
    accent: '#059669',
    bg: 'linear-gradient(160deg, #050e1a 0%, #062a1e 60%, #07553a 100%)',
  },
  {
    image: '/Your Investments, All in One Place.png',
    tag: 'Portfolio',
    title: 'Your Investments, All in One Place',
    body: 'Monitor holdings, track unrealized gains and losses, and see exactly how your portfolio performs.',
    accent: '#059669',
    bg: 'linear-gradient(160deg, #050e1a 0%, #062a1e 60%, #07553a 100%)',
  },
  {
    image: '/Trade Nigerian Stocks Instantly.png',
    tag: 'Buy & Sell',
    title: 'Trade Nigerian Stocks Instantly',
    body: 'Place market and limit orders for any NGX-listed stock in seconds, powered by PAC Securities.',
    accent: '#059669',
    bg: 'linear-gradient(160deg, #050e1a 0%, #062a1e 60%, #07553a 100%)',
  },
  {
    image: '/Safe, Secure & Fully Compliant.png',
    tag: 'SEC Regulated',
    title: 'Safe, Secure & Fully Compliant',
    body: "Moneta operates under SEC Nigeria's Digital Sub-Broker framework with full KYC and fund protection.",
    accent: '#059669',
    bg: 'linear-gradient(160deg, #050e1a 0%, #062a1e 60%, #07553a 100%)',
  },
]

export default function Onboarding() {
  const [current, setCurrent] = useState(0)
  const [, setAnimDir] = useState<'next' | 'prev'>('next')
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    SLIDES.forEach((slide) => {
      const img = new Image()
      img.src = slide.image
    })
  }, [])

  function finish() {
    const key = user ? `moneta_onboarded_${user.id}` : 'moneta_onboarded'
    localStorage.setItem(key, '1')
    navigate('/market')
  }

  function next() {
    if (current < SLIDES.length - 1) {
      setAnimDir('next')
      setCurrent(current + 1)
    } else {
      finish()
    }
  }

  function prev() {
    if (current > 0) {
      setAnimDir('prev')
      setCurrent(current - 1)
    }
  }

  const slide = SLIDES[current]
  const isLast = current === SLIDES.length - 1
  const progress = ((current + 1) / SLIDES.length) * 100

  return (
    <div style={{
      minHeight: '100svh',
      display: 'flex',
      flexDirection: 'column',
      background: slide.bg,
      transition: 'background 0.5s ease',
      userSelect: 'none',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <div style={{
          position: 'absolute', top: -60, right: -60,
          width: 280, height: 280, borderRadius: '50%',
          background: `radial-gradient(circle, ${slide.accent}22 0%, transparent 65%)`,
          transition: 'background 0.5s',
        }} />
        <div style={{
          position: 'absolute', bottom: '35%', left: -40,
          width: 200, height: 200, borderRadius: '50%',
          background: `radial-gradient(circle, ${slide.accent}14 0%, transparent 65%)`,
          transition: 'background 0.5s',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
        }} />
      </div>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'calc(env(safe-area-inset-top, 0px) + 18px) 24px 0',
        position: 'relative', zIndex: 2,
      }}>
        <MonetaLogo size="sm" inverted />
        {!isLast && (
          <button
            onClick={finish}
            style={{
              fontSize: 13, fontWeight: 600,
              color: 'rgba(255,255,255,0.5)',
              padding: '6px 14px', borderRadius: 20,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            Skip
          </button>
        )}
      </div>

      {/* Slide content */}
      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '24px 32px 0',
        position: 'relative', zIndex: 2,
      }}>
        {/* Illustration in a glass card */}
        <div style={{
          width: 220, height: 220,
          borderRadius: 36,
          background: 'rgba(255,255,255,0.07)',
          border: '1px solid rgba(255,255,255,0.12)',
          backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 40,
          boxShadow: `0 20px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)`,
        }}>
          <img
            key={slide.image}
            src={slide.image}
            alt={slide.title}
            style={{ width: 170, height: 170, objectFit: 'contain' }}
          />
        </div>

        {/* Tag */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 10, fontWeight: 800,
          color: slide.accent,
          background: slide.accent + '22',
          border: `1px solid ${slide.accent}44`,
          padding: '5px 14px', borderRadius: 20,
          letterSpacing: 0.8, textTransform: 'uppercase',
          marginBottom: 20,
        }}>
          {slide.tag}
        </span>

        {/* Title */}
        <h2 style={{
          fontSize: 28, fontWeight: 900,
          color: '#fff', lineHeight: 1.2,
          letterSpacing: -0.7, marginBottom: 16,
          textAlign: 'center',
        }}>
          {slide.title}
        </h2>

        {/* Body */}
        <p style={{
          fontSize: 15, color: 'rgba(255,255,255,0.55)',
          lineHeight: 1.65, fontWeight: 500,
          maxWidth: 280, textAlign: 'center',
        }}>
          {slide.body}
        </p>
      </div>

      {/* Bottom controls */}
      <div style={{
        padding: '32px 24px calc(env(safe-area-inset-bottom, 0px) + 36px)',
        position: 'relative', zIndex: 2,
      }}>
        {/* Progress bar */}
        <div style={{
          height: 3, background: 'rgba(255,255,255,0.12)',
          borderRadius: 3, marginBottom: 28, overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', width: `${progress}%`,
            background: slide.accent,
            borderRadius: 3,
            transition: 'width 0.4s cubic-bezier(0.34,1.2,0.64,1)',
            boxShadow: `0 0 8px ${slide.accent}88`,
          }} />
        </div>

        {/* Slide counter */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20,
        }}>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
            {current + 1} of {SLIDES.length}
          </p>
          {/* Dot indicators */}
          <div style={{ display: 'flex', gap: 6 }}>
            {SLIDES.map((_, i) => (
              <div key={i} style={{
                width: i === current ? 20 : 6, height: 6, borderRadius: 3,
                background: i === current ? slide.accent : 'rgba(255,255,255,0.2)',
                transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
              }} />
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {current > 0 && (
            <button
              onClick={prev}
              style={{
                width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          )}

          <button
            onClick={next}
            style={{
              flex: 1, padding: '16px',
              borderRadius: 16,
              background: slide.accent,
              border: 'none', fontSize: 16, fontWeight: 800,
              color: '#fff', cursor: 'pointer',
              boxShadow: `0 8px 28px ${slide.accent}55`,
              transition: 'background 0.4s, box-shadow 0.4s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {isLast ? 'Start Trading' : 'Continue'}
            {!isLast && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </button>
        </div>

        {isLast && (
          <p style={{
            textAlign: 'center', marginTop: 18,
            fontSize: 11, color: 'rgba(255,255,255,0.3)',
            fontWeight: 500, lineHeight: 1.6,
          }}>
            Licensed Digital Sub-Broker · PAC Securities · SEC Nigeria
          </p>
        )}
      </div>
    </div>
  )
}
