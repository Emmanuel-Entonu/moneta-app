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
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 20px 12px',
          paddingTop: noPadTop
            ? 'calc(env(safe-area-inset-top, 0px) + 12px)'
            : 'calc(env(safe-area-inset-top, 0px) + 20px)',
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#059669', lineHeight: 1, letterSpacing: -0.3 }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 3, fontWeight: 500 }}>
                {subtitle}
              </p>
            )}
          </div>
          {rightAction && <div>{rightAction}</div>}
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
