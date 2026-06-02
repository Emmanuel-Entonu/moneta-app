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
          ? 'linear-gradient(145deg, #10b981, #059669)'
          : 'linear-gradient(145deg, #059669, #047857)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: inverted
          ? '0 4px 20px rgba(16,185,129,0.45), inset 0 1px 0 rgba(255,255,255,0.2)'
          : '0 4px 16px rgba(5,150,105,0.40)',
        flexShrink: 0,
      }}>
        <svg
          width={s.icon * 0.54}
          height={s.icon * 0.54}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Geometric M — two sharp peaks */}
          <polyline points="2 20 2 4 12 14 22 4 22 20" />
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
