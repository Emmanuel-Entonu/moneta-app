import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { MarketRowSkeleton } from '../components/Skeleton'
import { usePortfolioStore } from '../store/portfolioStore'
import { generateSparklineArea } from '../lib/sparkline'
import type { PacMarketData } from '../lib/pacApi'

const TICKER_COLORS: Record<string, string> = {
  DANGCEM: '#d97706', GTCO: '#dc2626', ZENITHBANK: '#7c3aed',
  MTNN: '#ca8a04', AIRTELAFRI: '#db2777', FBNH: '#2563eb',
  BUACEMENT: '#ea580c', ACCESS: '#059669', NESTLE: '#b45309', SEPLAT: '#1d4ed8',
}
const getColor = (s: string) => TICKER_COLORS[s] ?? '#059669'

const CATEGORIES = ['All', 'Gainers', 'Losers', 'Banking', 'Cement', 'Telecom', 'Energy']
const CATEGORY_MAP: Record<string, string[]> = {
  Banking:  ['GTCO', 'ZENITHBANK', 'FBNH', 'ACCESS'],
  Cement:   ['DANGCEM', 'BUACEMENT'],
  Telecom:  ['MTNN', 'AIRTELAFRI'],
  Energy:   ['SEPLAT'],
}

function fmt(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isMarketOpen() {
  const now = new Date()
  const day = now.getUTCDay()
  const hour = now.getUTCHours()
  const min = now.getUTCMinutes()
  const totalMin = hour * 60 + min
  // NGX: Mon–Fri 09:30–14:30 WAT = 08:30–13:30 UTC
  return day >= 1 && day <= 5 && totalMin >= 510 && totalMin < 810
}

function Sparkline({ symbol, isUp, width = 72, height = 32 }: { symbol: string; isUp: boolean; width?: number; height?: number }) {
  const id = `spark-${symbol}-${Math.random().toString(36).slice(2, 6)}`
  const { line, area } = generateSparklineArea(symbol, isUp, width, height)
  const color = isUp ? '#059669' : '#e03131'
  return (
    <svg width={width} height={height} style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function StockRow({ stock, onClick }: { stock: PacMarketData; onClick: () => void }) {
  const up = stock.changePercent >= 0
  const color = getColor(stock.symbol)

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center',
        padding: '12px 20px',
        background: '#0c1526', width: '100%', textAlign: 'left',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onPointerEnter={(e) => (e.currentTarget.style.background = '#111d30')}
      onPointerLeave={(e) => (e.currentTarget.style.background = '#0c1526')}
    >
      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: color + '1a',
        border: `1.5px solid ${color}35`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginRight: 12, flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, fontWeight: 900, color, letterSpacing: -0.5 }}>
          {stock.symbol.slice(0, 4)}
        </span>
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: '#fff', marginBottom: 3 }}>
          {stock.symbol}
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
          {stock.name}
        </p>
      </div>

      {/* Sparkline */}
      <Sparkline symbol={stock.symbol} isUp={up} />

      {/* Price + change */}
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 84, marginLeft: 10 }}>
        <p style={{ fontWeight: 800, fontSize: 14, color: '#fff', marginBottom: 4, letterSpacing: -0.3 }}>
          {fmt(stock.price)}
        </p>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
          fontSize: 11, fontWeight: 700,
          color: up ? '#34d399' : '#f87171',
          background: up ? 'rgba(5,150,105,0.18)' : 'rgba(239,68,68,0.15)',
          padding: '3px 8px', borderRadius: 20,
        }}>
          {up ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(2)}%
        </span>
      </div>
    </button>
  )
}

function TopMoversPanel({ topGainer, topLoser, mostActive, onNavigate }: {
  topGainer: PacMarketData; topLoser: PacMarketData; mostActive: PacMarketData
  onNavigate: (symbol: string) => void
}) {
  const cards = [
    { label: 'Top Gainer',   stock: topGainer,  up: true,  accent: '#059669', border: 'rgba(5,150,105,0.35)',  bg: 'rgba(5,150,105,0.08)'  },
    { label: 'Top Loser',    stock: topLoser,   up: false, accent: '#e03131', border: 'rgba(224,49,49,0.35)',   bg: 'rgba(224,49,49,0.08)'  },
    { label: 'Most Active',  stock: mostActive, up: mostActive.changePercent >= 0, accent: '#3b82f6', border: 'rgba(59,130,246,0.35)', bg: 'rgba(59,130,246,0.08)' },
  ]

  return (
    <div style={{ padding: '12px 16px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {cards.map(({ label, stock, up, accent, border, bg }) => (
        <button
          key={label}
          onClick={() => onNavigate(stock.symbol)}
          style={{
            display: 'flex', alignItems: 'center',
            background: bg,
            border: `1px solid ${border}`,
            borderRadius: 16,
            padding: '12px 16px',
            textAlign: 'left', cursor: 'pointer',
            transition: 'opacity 0.15s',
          }}
          onPointerEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
          onPointerLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          {/* Label + symbol */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 9, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>
              {label}
            </p>
            <p style={{ fontSize: 16, fontWeight: 900, color: '#fff', letterSpacing: -0.4, marginBottom: 2 }}>
              {stock.symbol}
            </p>
            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {stock.name.split(' ').slice(0, 3).join(' ')}
            </p>
          </div>

          {/* Sparkline */}
          <div style={{ margin: '0 16px' }}>
            <Sparkline symbol={stock.symbol} isUp={up} width={64} height={36} />
          </div>

          {/* Price + change */}
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: -0.3, marginBottom: 5 }}>
              ₦{stock.price.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </p>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: up ? '#34d399' : '#f87171',
              background: up ? 'rgba(5,150,105,0.2)' : 'rgba(239,68,68,0.18)',
              padding: '3px 9px', borderRadius: 20,
              display: 'inline-block',
            }}>
              {up ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(2)}%
            </span>
          </div>
        </button>
      ))}
    </div>
  )
}

export default function Market() {
  const { marketData, loadingMarket, loadMarketData } = usePortfolioStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const navigate = useNavigate()

  useEffect(() => { loadMarketData() }, [])

  const gainers = marketData.filter((s) => s.changePercent > 0)
  const losers  = marketData.filter((s) => s.changePercent < 0)
  const marketOpen = isMarketOpen()

  const nseChange = +(marketData.reduce((a, s) => a + s.changePercent, 0) / (marketData.length || 1)).toFixed(2)
  const nseUp = nseChange >= 0

  const gainerPct = marketData.length ? (gainers.length / marketData.length) * 100 : 50

  const filtered = marketData.filter((s) => {
    const matchSearch = s.symbol.toLowerCase().includes(search.toLowerCase()) ||
      s.name.toLowerCase().includes(search.toLowerCase())
    if (!matchSearch) return false
    if (category === 'All')     return true
    if (category === 'Gainers') return s.changePercent > 0
    if (category === 'Losers')  return s.changePercent < 0
    return (CATEGORY_MAP[category] ?? []).includes(s.symbol)
  })

  const topGainer  = [...marketData].sort((a, b) => b.changePercent - a.changePercent)[0]
  const topLoser   = [...marketData].sort((a, b) => a.changePercent - b.changePercent)[0]
  const mostActive = [...marketData].sort((a, b) => b.volume - a.volume)[0]

  return (
    <Layout
      title="Market"
      noPadTop
      rightAction={
        <button
          onClick={() => navigate('/compare')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '8px 14px', borderRadius: 20,
            background: 'rgba(255,255,255,0.12)',
            border: '1px solid rgba(255,255,255,0.18)',
            color: '#fff', fontSize: 12, fontWeight: 700,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Compare
        </button>
      }
    >
      {/* NSE Banner */}
      <div style={{
        background: 'linear-gradient(160deg, #050e1a 0%, #0c1f2e 50%, #053d2a 85%, #065f3e 100%)',
        padding: '18px 20px 16px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative blobs */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(5,150,105,0.18) 0%, transparent 65%)' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                NGX All-Share Index
              </p>
              {/* Market open/closed pill */}
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                color: marketOpen ? '#34d399' : 'rgba(255,255,255,0.4)',
                background: marketOpen ? 'rgba(5,150,105,0.18)' : 'rgba(255,255,255,0.07)',
                border: `1px solid ${marketOpen ? 'rgba(5,150,105,0.4)' : 'rgba(255,255,255,0.12)'}`,
                padding: '3px 8px', borderRadius: 20,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: marketOpen ? '#34d399' : 'rgba(255,255,255,0.3)',
                  boxShadow: marketOpen ? '0 0 6px #34d399' : 'none',
                  animation: marketOpen ? 'pulse-dot 2.4s ease-in-out infinite' : 'none',
                }} />
                {marketOpen ? 'OPEN' : 'CLOSED'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 26, fontWeight: 900, color: '#fff', letterSpacing: -1 }}>
                97,842.14
              </span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 3,
                fontSize: 12, fontWeight: 800,
                color: nseUp ? '#34d399' : '#f87171',
                background: nseUp ? 'rgba(5,150,105,0.2)' : 'rgba(239,68,68,0.18)',
                padding: '4px 10px', borderRadius: 20,
              }}>
                {nseUp ? '▲' : '▼'} {Math.abs(nseChange).toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Gainers / Losers counts */}
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>Up</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#34d399', letterSpacing: -0.5 }}>{gainers.length}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>Down</p>
              <p style={{ fontSize: 22, fontWeight: 900, color: '#f87171', letterSpacing: -0.5 }}>{losers.length}</p>
            </div>
          </div>
        </div>

        {/* Sentiment bar */}
        <div style={{ position: 'relative', zIndex: 1, marginTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: 0.5 }}>Bullish {gainers.length}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Market Sentiment</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: 0.5 }}>Bearish {losers.length}</span>
          </div>
          <div style={{ height: 5, borderRadius: 10, background: 'rgba(239,68,68,0.35)', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${gainerPct}%`,
              borderRadius: 10,
              background: 'linear-gradient(90deg, #059669, #34d399)',
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
      </div>

      {/* Top Movers */}
      {!loadingMarket && marketData.length > 0 && (
        <>
          <div style={{ padding: '16px 20px 4px' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.8 }}>Top Movers</p>
          </div>
          <TopMoversPanel
            topGainer={topGainer} topLoser={topLoser} mostActive={mostActive}
            onNavigate={(sym) => navigate(`/trade/${sym}`)}
          />
        </>
      )}

      {/* Search + filters */}
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'rgba(255,255,255,0.06)', border: '1.5px solid rgba(255,255,255,0.1)',
            borderRadius: 13, padding: '11px 14px', marginBottom: 12,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text" placeholder="Search stocks…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ background: 'none', color: '#fff', fontSize: 14, flex: 1, fontWeight: 500 }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.6)', fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            )}
          </div>
        </div>

        <div style={{
          display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 12,
          scrollbarWidth: 'none', paddingLeft: 16, paddingRight: 16,
        }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '7px 15px', borderRadius: 20, whiteSpace: 'nowrap',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: '1.5px solid',
                borderColor: category === cat ? 'transparent' : 'rgba(255,255,255,0.12)',
                background: category === cat ? 'linear-gradient(135deg,#059669,#047857)' : 'rgba(255,255,255,0.05)',
                color: category === cat ? '#fff' : 'rgba(255,255,255,0.45)',
                boxShadow: category === cat ? '0 3px 12px rgba(5,150,105,0.30)' : 'none',
                transition: 'all 0.15s', flexShrink: 0,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div style={{ padding: '10px 20px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: 0.7 }}>
          {category === 'All' ? 'All Equities' : category}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)' }}>
          {filtered.length} securities
        </span>
      </div>

      {/* List */}
      <div>
        {loadingMarket ? (
          Array.from({ length: 8 }).map((_, i) => <MarketRowSkeleton key={i} />)
        ) : (
          <div className="animate-in">
            {filtered.map((stock) => (
              <StockRow key={stock.symbol} stock={stock} onClick={() => navigate(`/trade/${stock.symbol}`)} />
            ))}
            {filtered.length === 0 && (
              <div style={{ padding: '64px 20px', textAlign: 'center' }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 20,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1.5px solid rgba(255,255,255,0.08)', margin: '0 auto 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
                  </svg>
                </div>
                <p style={{ fontWeight: 800, color: '#fff', marginBottom: 5, fontSize: 15 }}>No results</p>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  {search ? `No stocks match "${search}"` : `No stocks in ${category}`}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
      <div style={{ height: 100 }} />
    </Layout>
  )
}
