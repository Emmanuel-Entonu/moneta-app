import type { CSSProperties } from 'react'

interface SkeletonProps {
  width?: string | number
  height?: string | number
  radius?: string | number
  style?: CSSProperties
}

export function Skeleton({ width = '100%', height = 16, radius = 8, style }: SkeletonProps) {
  return (
    <div style={{
      width,
      height,
      borderRadius: radius,
      background: 'linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.4s ease-in-out infinite',
      ...style,
    }} />
  )
}

export function MarketRowSkeleton() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '14px 20px', borderBottom: '1px solid var(--border)',
    }}>
      <Skeleton width={44} height={44} radius={14} style={{ marginRight: 14, flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <Skeleton width={80} height={14} radius={6} style={{ marginBottom: 7 }} />
        <Skeleton width={130} height={11} radius={5} />
      </div>
      <div style={{ textAlign: 'right' }}>
        <Skeleton width={70} height={14} radius={6} style={{ marginBottom: 7, marginLeft: 'auto' }} />
        <Skeleton width={52} height={20} radius={20} style={{ marginLeft: 'auto' }} />
      </div>
    </div>
  )
}

export function PortfolioCardSkeleton() {
  return (
    <div style={{
      border: '1.5px solid var(--border)', borderRadius: 18,
      padding: '16px 18px', marginBottom: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Skeleton width={42} height={42} radius={13} />
          <div>
            <Skeleton width={70} height={14} radius={5} style={{ marginBottom: 6 }} />
            <Skeleton width={44} height={11} radius={4} />
          </div>
        </div>
        <div>
          <Skeleton width={80} height={14} radius={5} style={{ marginBottom: 6, marginLeft: 'auto' }} />
          <Skeleton width={52} height={20} radius={20} style={{ marginLeft: 'auto' }} />
        </div>
      </div>
      <Skeleton width="100%" height={42} radius={10} />
    </div>
  )
}

// Inject keyframe CSS once
const styleId = 'skeleton-shimmer'
if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `@keyframes shimmer {
    0%   { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }`
  document.head.appendChild(style)
}
