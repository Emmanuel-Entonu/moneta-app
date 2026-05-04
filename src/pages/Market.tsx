import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import Aurora from '../components/Aurora'
import StockLogo from '../components/StockLogo'
import { usePortfolioStore } from '../store/portfolioStore'
import { generateSparklineArea } from '../lib/sparkline'
import type { PacMarketData } from '../lib/pacApi'

const CATEGORIES = ['All', 'Gainers', 'Losers', 'Banking', 'Cement', 'Telecom', 'Energy', 'Consumer']
const CATEGORY_MAP: Record<string, string[]> = {
  Banking:  ['GTCO', 'ZENITHBANK', 'FBNH', 'ACCESS', 'UBA', 'STANBIC', 'FCMB', 'FIDELITYBK', 'WEMABANK', 'STERLINGBANK', 'JAIZBANK'],
  Cement:   ['DANGCEM', 'BUACEMENT', 'LAFARGE'],
  Telecom:  ['MTNN', 'AIRTELAFRI'],
  Energy:   ['SEPLAT', 'OANDO', 'TOTAL', 'ARDOVA'],
  Consumer: ['NESTLE', 'CADBURY', 'UNILEVER', 'FLOURMILL', 'DANGSUGAR', 'NB', 'VITAFOAM'],
}

function fmt(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function isMarketOpen() {
  const now = new Date()
  const day = now.getUTCDay()
  const total = now.getUTCHours() * 60 + now.getUTCMinutes()
  return day >= 1 && day <= 5 && total >= 510 && total < 810
}

function Sparkline({ symbol, isUp, w = 72, h = 32 }: { symbol: string; isUp: boolean; w?: number; h?: number }) {
  const id = `sp-${symbol}-${isUp ? 'u' : 'd'}`
  const { line, area } = generateSparklineArea(symbol, isUp, w, h)
  const color = isUp ? '#10b981' : '#ef4444'
  return (
    <svg width={w} height={h}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MoverCard({ label, stock, accent, onPress }: {
  label: string; stock: PacMarketData; accent: string; onPress: () => void
}) {
  const up = stock.changePercent >= 0
  return (
    <button
      onClick={onPress}
      style={{
        flexShrink: 0, width: 170,
        background: '#0e1c2f',
        border: `1.5px solid ${accent}50`,
        borderRadius: 20,
        padding: '14px 14px 12px',
        textAlign: 'left', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: '50%', background: `radial-gradient(circle, ${accent}25 0%, transparent 70%)`, pointerEvents: 'none' }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <StockLogo symbol={stock.symbol} size={28} radius={8} />
        <p style={{ fontSize: 9, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</p>
      </div>
      <p style={{ fontSize: 18, fontWeight: 900, color: '#ffffff', letterSpacing: -0.6, marginBottom: 1 }}>{stock.symbol}</p>
      <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 500, marginBottom: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {stock.name.split(' ').slice(0, 3).join(' ')}
      </p>
      <Sparkline symbol={stock.symbol} isUp={up} w={142} h={40} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <p style={{ fontSize: 13, fontWeight: 800, color: '#ffffff', letterSpacing: -0.3 }}>{fmt(stock.price)}</p>
        <span style={{
          fontSize: 11, fontWeight: 700,
          color: up ? '#34d399' : '#f87171',
          background: up ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.18)',
          padding: '3px 8px', borderRadius: 20,
        }}>
          {up ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(2)}%
        </span>
      </div>
    </button>
  )
}

function StockRow({ stock, isLast, onClick }: { stock: PacMarketData; isLast: boolean; onClick: () => void }) {
  const pct = stock.changePercent
  const up = pct > 0
  const flat = pct === 0
  return (
    <button
      onClick={onClick}
      style={{
        background: 'transparent',
        padding: '13px 16px',
        display: 'flex', alignItems: 'center', gap: 13,
        borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
        width: '100%', textAlign: 'left', cursor: 'pointer',
        transition: 'background 0.12s',
      }}
      onPointerEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
      onPointerLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <StockLogo symbol={stock.symbol} size={46} radius={14} />

      {/* Symbol + name */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', letterSpacing: -0.3, marginBottom: 3 }}>
          {stock.symbol}
        </p>
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.36)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {stock.name}
        </p>
      </div>

      {/* Mini sparkline */}
      <Sparkline symbol={stock.symbol} isUp={flat ? true : up} w={58} h={30} />

      {/* Price + % */}
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 78 }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: '#ffffff', letterSpacing: -0.3, marginBottom: 5 }}>
          {fmt(stock.price)}
        </p>
        <span style={{
          fontSize: 10, fontWeight: 700,
          color: flat ? 'rgba(255,255,255,0.35)' : up ? '#34d399' : '#f87171',
          background: flat ? 'rgba(255,255,255,0.06)' : up ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
          padding: '2px 8px', borderRadius: 20, display: 'inline-block',
        }}>
          {flat ? '–' : up ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
        </span>
      </div>
    </button>
  )
}

function SkeletonRow() {
  return (
    <div style={{ padding: '13px 16px', display: 'flex', alignItems: 'center', gap: 13, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div style={{ width: 46, height: 46, borderRadius: 14, background: 'rgba(255,255,255,0.07)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ width: 72, height: 13, borderRadius: 6, background: 'rgba(255,255,255,0.08)', marginBottom: 7 }} />
        <div style={{ width: 110, height: 9, borderRadius: 6, background: 'rgba(255,255,255,0.04)' }} />
      </div>
      <div style={{ width: 58, height: 30, borderRadius: 6, background: 'rgba(255,255,255,0.04)' }} />
      <div style={{ textAlign: 'right', minWidth: 78 }}>
        <div style={{ width: 72, height: 13, borderRadius: 6, background: 'rgba(255,255,255,0.08)', marginBottom: 7 }} />
        <div style={{ width: 54, height: 20, borderRadius: 20, background: 'rgba(255,255,255,0.06)' }} />
      </div>
    </div>
  )
}

export default function Market() {
  const { marketData, loadingMarket, loadMarketData, apiStatus } = usePortfolioStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const navigate = useNavigate()

  useEffect(() => { loadMarketData() }, [])

  const gainers = marketData.filter((s) => s.changePercent > 0)
  const losers  = marketData.filter((s) => s.changePercent < 0)
  const neutral = marketData.filter((s) => s.changePercent === 0)
  const marketOpen = isMarketOpen()
  const nseChange = +(marketData.reduce((a, s) => a + s.changePercent, 0) / (marketData.length || 1)).toFixed(2)
  const nseUp = nseChange >= 0
  const gainerPct = marketData.length ? (gainers.length / marketData.length) * 100 : 50

  const filtered = marketData.filter((s) => {
    const q = search.toLowerCase()
    if (!s.symbol.toLowerCase().includes(q) && !s.name.toLowerCase().includes(q)) return false
    if (category === 'All')     return true
    if (category === 'Gainers') return s.changePercent > 0
    if (category === 'Losers')  return s.changePercent < 0
    return (CATEGORY_MAP[category] ?? []).includes(s.symbol)
  })

  const topGainer  = [...marketData].sort((a, b) => b.changePercent - a.changePercent)[0]
  const topLoser   = [...marketData].sort((a, b) => a.changePercent - b.changePercent)[0]
  const mostActive = [...marketData].sort((a, b) => b.volume - a.volume)[0]

  return (
    <Layout noBorder>

      {/* ── HERO ── */}
      <div style={{
        background: 'linear-gradient(160deg, #050e1a 0%, #0c1f2e 50%, #053d2a 85%, #065f3e 100%)',
        padding: 'calc(env(safe-area-inset-top, 0px) + 18px) 20px 22px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Aurora background */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 0 }}>
          <Aurora colorStops={['#059669', '#34d399', '#047857']} amplitude={1.2} blend={0.6} speed={0.4} />
        </div>
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}>
          <div style={{ position: 'absolute', top: -60, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(5,150,105,0.18) 0%, transparent 65%)' }} />
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
        </div>

        {/* Title + Compare */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22, position: 'relative', zIndex: 2 }}>
          <p style={{
            fontSize: 27, fontWeight: 900, letterSpacing: -0.7,
            background: 'linear-gradient(95deg, #34d399 0%, #059669 55%, #6ee7b7 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>Market</p>
          <button
            onClick={() => navigate('/compare')}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 20,
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)',
              color: '#ffffff', fontSize: 12, fontWeight: 700,
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
            Compare
          </button>
        </div>

        {/* NGX Stats */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, position: 'relative', zIndex: 1 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: 0.8, textTransform: 'uppercase' }}>NGX All-Share Index</p>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                color: marketOpen ? '#34d399' : 'rgba(255,255,255,0.38)',
                background: marketOpen ? 'rgba(5,150,105,0.18)' : 'rgba(255,255,255,0.07)',
                border: `1px solid ${marketOpen ? 'rgba(5,150,105,0.4)' : 'rgba(255,255,255,0.1)'}`,
                padding: '3px 8px', borderRadius: 20,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: marketOpen ? '#34d399' : 'rgba(255,255,255,0.28)', boxShadow: marketOpen ? '0 0 6px #34d399' : 'none', animation: marketOpen ? 'pulse-dot 2.4s ease-in-out infinite' : 'none' }} />
                {marketOpen ? 'OPEN' : 'CLOSED'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 28, fontWeight: 900, color: '#ffffff', letterSpacing: -1 }}>97,842.14</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 12, fontWeight: 800, color: nseUp ? '#34d399' : '#f87171', background: nseUp ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.15)', padding: '4px 10px', borderRadius: 20 }}>
                {nseUp ? '▲' : '▼'} {Math.abs(nseChange).toFixed(2)}%
              </span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16 }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>Up</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: '#34d399', letterSpacing: -0.5 }}>{gainers.length}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>Flat</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: 'rgba(255,255,255,0.4)', letterSpacing: -0.5 }}>{neutral.length}</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', fontWeight: 700, marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>Down</p>
              <p style={{ fontSize: 24, fontWeight: 900, color: '#f87171', letterSpacing: -0.5 }}>{losers.length}</p>
            </div>
          </div>
        </div>

        {/* Sentiment bar */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: 0.5 }}>Bullish {gainers.length}</span>
            <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.25)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Market Sentiment</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: 0.5 }}>Bearish {losers.length}</span>
          </div>
          <div style={{ height: 4, borderRadius: 10, background: 'rgba(239,68,68,0.28)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${gainerPct}%`, borderRadius: 10, background: 'linear-gradient(90deg, #059669, #34d399)', transition: 'width 0.6s ease' }} />
          </div>
        </div>
      </div>

      {/* ── DARK BODY ── */}
      <div style={{ background: '#ffffff', minHeight: 'calc(100% - 300px)', paddingBottom: 100 }}>

        {/* API error banner */}
        {apiStatus && (
          <div style={{ margin: '16px 12px 0', padding: '12px 14px', background: '#fff5f5', border: '1px solid #fecaca', borderRadius: 12, fontSize: 12, color: '#991b1b', fontWeight: 600 }}>
            {apiStatus}
          </div>
        )}

        {/* Top Movers section */}
        {!loadingMarket && topGainer && topLoser && mostActive && (
          <div style={{ padding: '20px 0 0' }}>
            <p style={{ fontSize: 10, fontWeight: 800, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', letterSpacing: 1, paddingLeft: 16, marginBottom: 12 }}>Top Movers</p>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingLeft: 16, paddingRight: 16, paddingBottom: 4, scrollbarWidth: 'none' }}>
              <MoverCard label="Top Gainer"  stock={topGainer}  accent="#10b981" onPress={() => navigate(`/trade/${topGainer.symbol}`)} />
              <MoverCard label="Top Loser"   stock={topLoser}   accent="#ef4444" onPress={() => navigate(`/trade/${topLoser.symbol}`)} />
              <MoverCard label="Most Active" stock={mostActive} accent="#3b82f6" onPress={() => navigate(`/trade/${mostActive.symbol}`)} />
            </div>
          </div>
        )}

        {/* Search + Filter — floating card */}
        <div style={{ margin: '20px 12px 0', background: '#0d1a2b', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, padding: '14px 14px 12px' }}>
          {/* Search input */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 13, padding: '10px 14px', marginBottom: 12 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text" placeholder="Search stocks…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ background: 'none', color: '#ffffff', fontSize: 14, flex: 1, fontWeight: 500 }}
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.5)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            )}
          </div>
          {/* Category pills */}
          <div style={{ display: 'flex', gap: 7, overflowX: 'auto', scrollbarWidth: 'none' }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                style={{
                  padding: '6px 14px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  border: '1px solid',
                  borderColor: category === cat ? 'transparent' : 'rgba(255,255,255,0.09)',
                  background: category === cat ? 'linear-gradient(135deg, #059669, #047857)' : 'rgba(255,255,255,0.04)',
                  color: category === cat ? '#ffffff' : 'rgba(255,255,255,0.38)',
                  boxShadow: category === cat ? '0 4px 14px rgba(5,150,105,0.35)' : 'none',
                  transition: 'all 0.15s',
                }}
              >{cat}</button>
            ))}
          </div>
        </div>

        {/* Stock count */}
        <div style={{ padding: '14px 20px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase', letterSpacing: 0.7 }}>
            {category === 'All' ? 'All Equities' : category}
          </span>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(0,0,0,0.35)' }}>{filtered.length} {filtered.length === 1 ? 'security' : 'securities'}</span>
        </div>

        {/* Stock list — floating card */}
        <div style={{ margin: '0 12px', background: '#0d1a2b', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 20, overflow: 'hidden' }}>
          {loadingMarket ? (
            <>
              {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)}
            </>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '56px 20px', textAlign: 'center' }}>
              <div style={{ width: 60, height: 60, borderRadius: 18, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', margin: '0 auto 14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
                </svg>
              </div>
              <p style={{ fontWeight: 800, color: '#ffffff', marginBottom: 4, fontSize: 15 }}>No results</p>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
                {search ? `No stocks match "${search}"` : `No stocks in ${category}`}
              </p>
            </div>
          ) : (
            <>
              {filtered.map((stock, i) => (
                <StockRow
                  key={stock.symbol}
                  stock={stock}
                  isLast={i === filtered.length - 1}
                  onClick={() => navigate(`/trade/${stock.symbol}`)}
                />
              ))}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}
