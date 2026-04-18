import type { ReactNode } from 'react'
import BottomNav from './BottomNav'

interface LayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string
  rightAction?: ReactNode
  hideNav?: boolean
  noPadTop?: boolean
}

export default function Layout({ children, title, subtitle, rightAction, hideNav, noPadTop }: LayoutProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100svh', background: 'var(--bg)' }}>
      {title && (
        <header style={{
          position: 'sticky',
          top: 0,
          zIndex: 40,
          background: 'linear-gradient(135deg, #050d1a 0%, #0c1526 65%, #022c22 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(5,150,105,0.2)',
          paddingTop: noPadTop
            ? 'calc(env(safe-area-inset-top, 0px) + 10px)'
            : 'calc(env(safe-area-inset-top, 0px) + 18px)',
          paddingBottom: 14,
          paddingLeft: 20,
          paddingRight: 20,
          overflow: 'hidden',
        }}>
          {/* Subtle mesh gradient overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'radial-gradient(ellipse 80% 60% at 100% 100%, rgba(5,150,105,0.12) 0%, transparent 60%)',
            pointerEvents: 'none',
          }} />

          {/* Page title row */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', position: 'relative' }}>
            <div>
              <h1 style={{
                fontSize: 27, fontWeight: 900, letterSpacing: -0.7, lineHeight: 1,
                background: 'linear-gradient(95deg, #34d399 0%, #059669 55%, #6ee7b7 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {title}
              </h1>
              {subtitle && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 4, fontWeight: 500 }}>
                  {subtitle}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {rightAction && <div>{rightAction}</div>}
              {/* Animated live dot */}
              <div style={{
                width: 9, height: 9, borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 0 3px rgba(16,185,129,0.25), 0 0 12px rgba(16,185,129,0.6)',
                animation: 'pulse-dot 2.4s ease-in-out infinite',
              }} />
            </div>
          </div>

          {/* Bottom gradient accent line */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 1.5,
            background: 'linear-gradient(90deg, transparent 0%, #059669 30%, #34d399 60%, transparent 100%)',
            opacity: 0.5,
          }} />
        </header>
      )}

      <main style={{
        flex: 1,
        overflowY: 'auto',
        paddingBottom: hideNav ? 0 : 72,
      }}>
        {children}
      </main>

      {!hideNav && <BottomNav />}
    </div>
  )
}
