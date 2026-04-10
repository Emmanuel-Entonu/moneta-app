import { useState, useMemo, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Layout from '../components/Layout'
import { usePortfolioStore } from '../store/portfolioStore'
import type { PacMarketData } from '../lib/pacApi'

const COMPARE_COLORS = ['#059669', '#2563eb', '#f59e0b', '#9333ea']

function fmt(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtVol(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toString()
}

/** Generates n points that start at 0% and drift toward the stock's actual changePercent */
function getComparePoints(symbol: string, changePercent: number, n = 32): number[] {
  const seed = symbol.split('').reduce((a, c, i) => a + c.charCodeAt(0) * (i + 1), 0)
  const target = changePercent / 100
  const points: number[] = [0]
  let pct = 0

  for (let i = 1; i < n - 1; i++) {
    const r1 = ((seed * (i + 3) * 29 + i * 17) % 10000) / 10000
    const r2 = ((seed * (i + 7) * 13 + i * 41) % 10000) / 10000
    const noise = (r1 - 0.5) * 0.014 + (r2 - 0.5) * 0.006
    const remaining = target - pct
    pct += remaining / (n - i) + noise
    points.push(pct)
  }
  points.push(target)
  return points
}

function CompareChart({ stocks, colors }: { stocks: PacMarketData[]; colors: string[] }) {
  const W = 320, H = 130
  const PAD = { top: 12, bottom: 12, left: 4, right: 4 }

  const allSeries = useMemo(
    () => stocks.map((s) => getComparePoints(s.symbol, s.changePercent)),
    [stocks]
  )

  const allValues = allSeries.flat()
  const rawMin = Math.min(...allValues)
  const rawMax = Math.max(...allValues)
  const range = rawMax - rawMin || 0.001
  const yMin = rawMin - range * 0.1
  const yMax = rawMax + range * 0.1
  const yRange = yMax - yMin

  const n = allSeries[0]?.length ?? 32
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  function toX(i: number) { return PAD.left + (i / (n - 1)) * chartW }
  function toY(v: number) { return PAD.top + ((yMax - v) / yRange) * chartH }

  // Zero line
  const zeroY = toY(0)

  function makePath(pts: number[]) {
    let d = `M ${toX(0).toFixed(1)} ${toY(pts[0]).toFixed(1)}`
    for (let i = 1; i < pts.length; i++) {
      const x0 = toX(i - 1), x1 = toX(i)
      const cpx = ((x0 + x1) / 2).toFixed(1)
      d += ` Q ${cpx} ${toY(pts[i - 1]).toFixed(1)} ${x1.toFixed(1)} ${toY(pts[i]).toFixed(1)}`
    }
    return d
  }

  return (
    <svg width={W} height={H} style={{ overflow: 'visible' }}>
      {/* Grid lines */}
      {[-0.02, -0.01, 0, 0.01, 0.02].map((v) => {
        const y = toY(v)
        if (y < PAD.top - 2 || y > H - PAD.bottom + 2) return null
        return (
          <g key={v}>
            <line
              x1={PAD.left} y1={y} x2={W - PAD.right} y2={y}
              stroke={v === 0 ? '#94a3b8' : '#f1f5f9'}
              strokeWidth={v === 0 ? 1.5 : 1}
              strokeDasharray={v === 0 ? '4 3' : undefined}
            />
            <text x={PAD.left - 2} y={y + 3.5} fontSize={8} fill="#94a3b8" textAnchor="end">
              {v > 0 ? '+' : ''}{(v * 100).toFixed(1)}%
            </text>
          </g>
        )
      })}

      {/* Zero base dot */}
      <circle cx={toX(0)} cy={zeroY} r={3} fill="#94a3b8" />

      {/* Stock paths */}
      {allSeries.map((pts, idx) => {
        const color = colors[idx]
        const path = makePath(pts)
        const endX = toX(n - 1)
        const endY = toY(pts[n - 1])

        return (
          <g key={idx}>
            <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            <circle cx={endX} cy={endY} r={3.5} fill={color} />
          </g>
        )
      })}
    </svg>
  )
}

function StockChip({
  stock, selected, color, onToggle, disabled,
}: {
  stock: PacMarketData
  selected: boolean
  color: string | null
  onToggle: () => void
  disabled: boolean
}) {
  const up = stock.changePercent >= 0
  return (
    <button
      onClick={onToggle}
      disabled={disabled && !selected}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 14px',
        borderRadius: 14,
        border: `2px solid ${selected ? color! : 'var(--border)'}`,
        background: selected ? color! + '15' : '#fff',
        cursor: disabled && !selected ? 'not-allowed' : 'pointer',
        opacity: disabled && !selected ? 0.45 : 1,
        transition: 'all 0.15s',
        textAlign: 'left',
        width: '100%',
      }}
    >
      {/* Color dot */}
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: selected ? color! : '#e2e8f0',
        flexShrink: 0,
        transition: 'background 0.15s',
      }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', letterSpacing: -0.2 }}>{stock.symbol}</p>
        <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {stock.name}
        </p>
      </div>

      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{fmt(stock.price)}</p>
        <p style={{ fontSize: 10, fontWeight: 700, color: up ? '#059669' : '#dc2626', display: 'flex', alignItems: 'center', gap: 2 }}>
          <svg width="7" height="7" viewBox="0 0 8 8" fill={up ? '#059669' : '#dc2626'}>
            {up ? <polygon points="4,0 8,8 0,8" /> : <polygon points="0,0 8,0 4,8" />}
          </svg>
          {Math.abs(stock.changePercent).toFixed(2)}%
        </p>
      </div>

      {selected && (
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color!} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )}
    </button>
  )
}

const STAT_ROWS = [
  { key: 'price',         label: 'Price',    fmt: (s: PacMarketData) => fmt(s.price) },
  { key: 'change',        label: 'Change',   fmt: (s: PacMarketData) => `${s.changePercent >= 0 ? '+' : ''}${s.changePercent.toFixed(2)}%` },
  { key: 'volume',        label: 'Volume',   fmt: (s: PacMarketData) => fmtVol(s.volume) },
  { key: 'high',          label: 'High',     fmt: (s: PacMarketData) => fmt(s.high) },
  { key: 'low',           label: 'Low',      fmt: (s: PacMarketData) => fmt(s.low) },
  { key: 'open',          label: 'Open',     fmt: (s: PacMarketData) => fmt(s.open) },
]

export default function Compare() {
  const { marketData } = usePortfolioStore()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [selected, setSelected] = useState<string[]>([])

  // Pre-select stock when navigating from a trade page (?with=SYMBOL)
  useEffect(() => {
    const withSymbol = searchParams.get('with')
    if (withSymbol && marketData.find((s) => s.symbol === withSymbol)) {
      setSelected((prev) => prev.includes(withSymbol) ? prev : [withSymbol, ...prev])
    }
  }, [searchParams, marketData])

  function toggle(symbol: string) {
    setSelected((prev) =>
      prev.includes(symbol)
        ? prev.filter((s) => s !== symbol)
        : prev.length < 4
        ? [...prev, symbol]
        : prev
    )
  }

  const selectedStocks = selected
    .map((sym) => marketData.find((s) => s.symbol === sym))
    .filter(Boolean) as PacMarketData[]

  const colors = selectedStocks.map((_, i) => COMPARE_COLORS[i])

  return (
    <Layout
      title="Compare"
      subtitle="Select up to 4 stocks"
      noPadTop
      rightAction={
        selected.length > 0 ? (
          <button
            onClick={() => setSelected([])}
            style={{
              fontSize: 12, fontWeight: 700, color: '#dc2626',
              background: '#fee2e2', border: 'none',
              padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
            }}
          >
            Clear
          </button>
        ) : null
      }
    >
      {/* Compare Chart — sticky when stocks selected */}
      {selectedStocks.length >= 2 && (
        <div style={{
          position: 'sticky', top: 0, zIndex: 30,
          background: '#fff',
          borderBottom: '1px solid var(--border)',
          padding: '16px 20px 12px',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
            Intraday Performance
          </p>

          <div style={{ overflowX: 'auto' }}>
            <CompareChart stocks={selectedStocks} colors={colors} />
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
            {selectedStocks.map((s, i) => {
              const up = s.changePercent >= 0
              return (
                <div key={s.symbol} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: colors[i] }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{s.symbol}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700,
                    color: up ? '#059669' : '#dc2626',
                    background: up ? '#d1fae5' : '#fee2e2',
                    padding: '2px 6px', borderRadius: 10,
                  }}>
                    {up ? '+' : ''}{s.changePercent.toFixed(2)}%
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Stats Table */}
      {selectedStocks.length >= 2 && (
        <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12 }}>
            Stats Comparison
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 280 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', paddingBottom: 8, paddingRight: 16 }}>
                    &nbsp;
                  </th>
                  {selectedStocks.map((s, i) => (
                    <th key={s.symbol} style={{ textAlign: 'right', paddingBottom: 8, paddingLeft: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 5 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[i] }} />
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text)' }}>{s.symbol}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {STAT_ROWS.map((row) => (
                  <tr key={row.key} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', padding: '8px 16px 8px 0', whiteSpace: 'nowrap' }}>
                      {row.label}
                    </td>
                    {selectedStocks.map((s) => {
                      const isChange = row.key === 'change'
                      const up = s.changePercent >= 0
                      return (
                        <td key={s.symbol} style={{
                          fontSize: 12, fontWeight: 700, paddingLeft: 12, paddingTop: 8, paddingBottom: 8,
                          textAlign: 'right',
                          color: isChange ? (up ? '#059669' : '#dc2626') : 'var(--text)',
                        }}>
                          {row.fmt(s)}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {selectedStocks.length < 2 && (
        <div style={{
          margin: '20px',
          padding: '20px',
          background: 'linear-gradient(135deg, #f0fdf4, #fff)',
          border: '1.5px solid #d1fae5',
          borderRadius: 16,
          textAlign: 'center',
        }}>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#a7f3d0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
              <line x1="2" y1="20" x2="22" y2="20"/>
            </svg>
          </div>
          <p style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14, marginBottom: 4 }}>
            {selected.length === 0 ? 'Select at least 2 stocks' : 'Select one more stock'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {selected.length === 0
              ? 'Tap stocks below to compare their performance side by side'
              : `${selected[0]} selected — add one more to start comparing`}
          </p>
        </div>
      )}

      {/* Stock selector */}
      <div style={{ padding: '0 20px 16px' }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, paddingTop: 16, marginBottom: 10 }}>
          {selected.length}/4 Selected
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {marketData.map((stock) => {
            const selIdx = selected.indexOf(stock.symbol)
            const isSelected = selIdx !== -1
            const color = isSelected ? COMPARE_COLORS[selIdx] : null
            return (
              <StockChip
                key={stock.symbol}
                stock={stock}
                selected={isSelected}
                color={color}
                onToggle={() => toggle(stock.symbol)}
                disabled={selected.length >= 4}
              />
            )
          })}
        </div>
      </div>

      {/* Trade shortcut */}
      {selectedStocks.length >= 1 && (
        <div style={{ padding: '0 20px 20px' }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
            Quick Trade
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {selectedStocks.map((s, i) => (
              <button
                key={s.symbol}
                onClick={() => navigate(`/trade/${s.symbol}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 16px', borderRadius: 20,
                  background: colors[i],
                  border: 'none', cursor: 'pointer', color: '#fff',
                  fontSize: 12, fontWeight: 700,
                }}
              >
                Trade {s.symbol}
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ height: 100 }} />
    </Layout>
  )
}
