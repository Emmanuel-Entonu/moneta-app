import { NavLink } from 'react-router-dom'

const tabs = [
  {
    to: '/market',
    label: 'Market',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#fff' : 'rgba(255,255,255,0.45)'}
        strokeWidth={active ? 2.5 : 2}
        strokeLinecap="round" strokeLinejoin="round"
      >
        <rect x="3" y="12" width="4" height="9" rx="1" />
        <rect x="10" y="7" width="4" height="14" rx="1" />
        <rect x="17" y="3" width="4" height="18" rx="1" />
      </svg>
    ),
  },
  {
    to: '/portfolio',
    label: 'Portfolio',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#fff' : 'rgba(255,255,255,0.45)'}
        strokeWidth={active ? 2.5 : 2}
        strokeLinecap="round" strokeLinejoin="round"
      >
        <rect x="1" y="6" width="22" height="14" rx="3" />
        <path d="M16 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" fill={active ? '#fff' : 'rgba(255,255,255,0.45)'} stroke="none" />
        <path d="M1 10h22" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Account',
    icon: (active: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke={active ? '#fff' : 'rgba(255,255,255,0.45)'}
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
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 50,
      background: 'rgba(8, 14, 26, 0.97)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderTop: '1px solid rgba(255,255,255,0.07)',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      boxShadow: '0 -4px 32px rgba(0,0,0,0.32)',
    }}>
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 1,
        background: 'linear-gradient(90deg, transparent 0%, rgba(5,150,105,0.5) 30%, rgba(52,211,153,0.6) 60%, transparent 100%)',
      }} />

      <div style={{ display: 'flex', alignItems: 'stretch' }}>
        {tabs.map((tab) => (
          <NavLink key={tab.to} to={tab.to} style={{ flex: 1, textDecoration: 'none' }}>
            {({ isActive }) => (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '8px 0 6px',
                position: 'relative',
                cursor: 'pointer',
              }}>
                {/* Active indicator dot */}
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 28,
                    height: 2.5,
                    borderRadius: '0 0 3px 3px',
                    background: 'linear-gradient(90deg, #059669, #34d399)',
                    boxShadow: '0 0 10px rgba(5,150,105,0.7)',
                  }} />
                )}

                {/* Icon container */}
                <div style={{
                  width: 38,
                  height: 28,
                  borderRadius: 12,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isActive ? 'rgba(5,150,105,0.15)' : 'transparent',
                  transition: 'background 0.2s ease',
                }}>
                  {tab.icon(isActive)}
                </div>

                <span style={{
                  fontSize: 10,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#34d399' : 'rgba(255,255,255,0.38)',
                  letterSpacing: 0.2,
                  transition: 'color 0.2s ease',
                }}>
                  {tab.label}
                </span>
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
