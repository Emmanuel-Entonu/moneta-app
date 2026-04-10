interface MonetaLogoProps {
  size?: 'sm' | 'md' | 'lg'
  inverted?: boolean
  iconOnly?: boolean
}

const sizes = {
  sm: { icon: 28, font: 18, gap: 7 },
  md: { icon: 36, font: 22, gap: 9 },
  lg: { icon: 48, font: 28, gap: 12 },
}

export default function MonetaLogo({ size = 'md', inverted = false, iconOnly = false }: MonetaLogoProps) {
  const s = sizes[size]
  const textColor = inverted ? '#ffffff' : 'var(--text)'

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: s.gap }}>
      {/* Icon */}
      <div style={{
        width: s.icon,
        height: s.icon,
        borderRadius: s.icon * 0.28,
        background: inverted
          ? 'rgba(255,255,255,0.18)'
          : 'linear-gradient(145deg, #059669, #047857)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: inverted
          ? '0 2px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.25)'
          : '0 4px 16px rgba(5,150,105,0.40)',
        flexShrink: 0,
        border: inverted ? '1.5px solid rgba(255,255,255,0.25)' : 'none',
      }}>
        <svg
          width={s.icon * 0.52}
          height={s.icon * 0.52}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        </svg>
      </div>

      {/* Wordmark */}
      {!iconOnly && (
        <span style={{
          fontSize: s.font,
          fontWeight: 800,
          color: textColor,
          letterSpacing: -0.6,
          lineHeight: 1,
        }}>
          Moneta
        </span>
      )}
    </div>
  )
}
