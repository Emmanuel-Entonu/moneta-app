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
          padding: noPadTop ? '12px 20px 12px' : '20px 20px 12px',
          paddingTop: noPadTop ? 12 : 'calc(env(safe-area-inset-top, 0px) + 20px)',
          background: '#fff',
          position: 'sticky',
          top: 0,
          zIndex: 40,
          borderBottom: '1px solid var(--border)',
        }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', lineHeight: 1, letterSpacing: -0.3 }}>
              {title}
            </h1>
            {subtitle && (
              <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3, fontWeight: 500 }}>
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
