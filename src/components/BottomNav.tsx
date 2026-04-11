import { NavLink } from 'react-router-dom'

const tabs = [
  {
    to: '/market',
    label: 'Market',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#fff' : '#94a3b8'}
        strokeWidth={active ? 2.5 : 2}
        strokeLinecap="round" strokeLinejoin="round"
      >
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    to: '/portfolio',
    label: 'Portfolio',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#fff' : '#94a3b8'}
        strokeWidth={active ? 2.5 : 2}
        strokeLinecap="round" strokeLinejoin="round"
      >
        <rect x="1" y="6" width="22" height="14" rx="3" />
        <path d="M16 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill={active ? '#fff' : '#94a3b8'} stroke="none" />
        <path d="M1 10h22" />
      </svg>
    ),
  },
  {
    to: '/profile',
    label: 'Profile',
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#fff' : '#94a3b8'}
        strokeWidth={active ? 2.5 : 2}
        strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  return (
    <div style={{
      position: 'fixed',
      bottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
    }}>
      <nav style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        background: 'rgba(15, 23, 42, 0.92)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRadius: 40,
        padding: '6px 8px',
        border: '1px solid rgba(255,255,255,0.10)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18), 0 2px 8px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.06)',
      }}>
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} style={{ textDecoration: 'none' }}>
            {({ isActive }) => (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: isActive ? 8 : 0,
                padding: isActive ? '10px 18px 10px 14px' : '10px 14px',
                borderRadius: 32,
                background: isActive ? 'linear-gradient(135deg, #059669, #047857)' : 'transparent',
                boxShadow: isActive ? '0 4px 16px rgba(5,150,105,0.40)' : 'none',
                transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                overflow: 'hidden',
                cursor: 'pointer',
              }}>
                {tab.icon(isActive)}
                <span style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#fff',
                  letterSpacing: 0.1,
                  maxWidth: isActive ? 60 : 0,
                  opacity: isActive ? 1 : 0,
                  transition: 'max-width 0.25s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}>
                  {tab.label}
                </span>
              </div>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
