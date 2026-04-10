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
          background: 'linear-gradient(135deg, #0a1628 0%, #0f172a 60%, #064e3b22 100%)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: '1px solid rgba(5,150,105,0.15)',
          paddingTop: noPadTop
            ? 'calc(env(safe-area-inset-top, 0px) + 10px)'
            : 'calc(env(safe-area-inset-top, 0px) + 18px)',
          paddingBottom: 14,
          paddingLeft: 20,
          paddingRight: 20,
        }}>
          {/* Page title */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{
                fontSize: 26, fontWeight: 900, letterSpacing: -0.6, lineHeight: 1,
                background: 'linear-gradient(90deg, #059669 0%, #34d399 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                {title}
              </h1>
              {subtitle && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 4, fontWeight: 500 }}>
                  {subtitle}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {rightAction && <div>{rightAction}</div>}
              {/* Decorative green dot */}
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: '#059669',
                boxShadow: '0 0 8px rgba(5,150,105,0.8)',
              }} />
            </div>
          </div>

          {/* Green accent line */}
          <div style={{
            position: 'absolute', bottom: 0, left: 20, right: 20,
            height: 1,
            background: 'linear-gradient(90deg, #059669 0%, transparent 100%)',
            opacity: 0.4,
          }} />
        </header>
      )}

      <main style={{
        flex: 1,
        overflowY: 'auto',
        paddingBottom: hideNav ? 0 : 88,
      }}>
        {children}
      </main>

      {!hideNav && <BottomNav />}
    </div>
  )
}
