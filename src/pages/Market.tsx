import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { MarketRowSkeleton } from '../components/Skeleton'
import { usePortfolioStore } from '../store/portfolioStore'
import { generateSparklineArea } from '../lib/sparkline'
import type { PacMarketData } from '../lib/pacApi'

function TopMoverCard({ label, stock, onClick }: { label: string; stock: PacMarketData; onClick: () => void }) {
  const up = stock.changePercent >= 0
  const accent = label === 'Top Gainer' ? '#059669' : label === 'Top Loser' ? '#dc2626' : '#2563eb'
  const accentBg = label === 'Top Gainer' ? '#f0fdf4' : label === 'Top Loser' ? '#fff5f5' : '#eff6ff'
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, width: 142,
        background: '#fff',
        border: `1.5px solid ${accent}28`,
        borderRadius: 18, padding: '14px 14px 12px',
        cursor: 'pointer', textAlign: 'left',
        boxShadow: `0 2px 12px ${accent}0e`,
        transition: 'transform 0.15s, box-shadow 0.15s',
        position: 'relative', overflow: 'hidden',
      }}
      onPointerEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)'
        e.currentTarget.style.boxShadow = `0 6px 20px ${accent}22`
      }}
      onPointerLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)'
        e.currentTarget.style.boxShadow = `0 2px 12px ${accent}0e`
      }}
    >
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: 56, height: 56, borderRadius: '0 0 0 56px',
        background: accentBg,
      }} />
      <p style={{
        fontSize: 9, fontWeight: 800, color: accent,
        textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 8,
        display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <svg width="7" height="7" viewBox="0 0 8 8" fill={accent}>
          {label === 'Top Gainer' ? <polygon points="4,0 8,8 0,8" /> : label === 'Top Loser' ? <polygon points="0,0 8,0 4,8" /> : <rect width="8" height="8" rx="1"/>}
        </svg>
        {label}
      </p>
      <p style={{ fontSize: 15, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.4, marginBottom: 2 }}>
        {stock.symbol}
      </p>
      <p style={{
        fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {stock.name}
      </p>
      <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 6, letterSpacing: -0.3 }}>
        ₦{stock.price.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontSize: 10, fontWeight: 800,
        color: up ? '#065f46' : '#991b1b',
        background: up ? '#d1fae5' : '#fee2e2',
        padding: '3px 8px', borderRadius: 20,
      }}>
        <svg width="7" height="7" viewBox="0 0 8 8" fill={up ? '#065f46' : '#991b1b'}>
          {up ? <polygon points="4,0 8,8 0,8" /> : <polygon points="0,0 8,0 4,8" />}
        </svg>{Math.abs(stock.changePercent).toFixed(2)}%
      </span>
    </button>
  )
}

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

function Sparkline({ symbol, isUp }: { symbol: string; isUp: boolean }) {
  const id = `spark-${symbol}`
  const { line, area } = generateSparklineArea(symbol, isUp, 64, 30)
  const color = isUp ? '#059669' : '#dc2626'

  return (
    <svg width={64} height={30} style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
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
        padding: '13px 20px',
        background: '#fff', width: '100%',
        borderBottom: '1px solid #f1f5f9',
        cursor: 'pointer', textAlign: 'left',
        transition: 'background 0.1s',
        position: 'relative',
      }}
      onPointerEnter={(e) => (e.currentTarget.style.background = '#fafbfc')}
      onPointerLeave={(e) => (e.currentTarget.style.background = '#fff')}
    >
      {/* Left color accent */}
      <div style={{
        position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
        width: 3, height: 28, borderRadius: '0 4px 4px 0',
        background: color, opacity: 0,
        transition: 'opacity 0.1s',
      }} />

      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: `linear-gradient(135deg, ${color}1a, ${color}0a)`,
        border: `1.5px solid ${color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginRight: 12, flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, fontWeight: 900, color, letterSpacing: -0.5, lineHeight: 1 }}>
          {stock.symbol.length <= 4 ? stock.symbol : stock.symbol.slice(0, 4)}
        </span>
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 3, letterSpacing: -0.1 }}>
          {stock.symbol}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
          {stock.name}
        </p>
      </div>

      {/* Sparkline */}
      <div style={{ marginRight: 12 }}>
        <Sparkline symbol={stock.symbol} isUp={up} />
      </div>

      {/* Price & change */}
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 82 }}>
        <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 4, letterSpacing: -0.3 }}>
          {fmt(stock.price)}
        </p>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
          fontSize: 11, fontWeight: 700,
          color: up ? '#065f46' : '#991b1b',
          background: up ? '#d1fae5' : '#fee2e2',
          padding: '3px 7px', borderRadius: 20,
        }}>
          <svg width="7" height="7" viewBox="0 0 8 8" fill={up ? '#065f46' : '#991b1b'} style={{marginRight:2,verticalAlign:'middle'}}>
            {up ? <polygon points="4,0 8,8 0,8" /> : <polygon points="0,0 8,0 4,8" />}
          </svg>{Math.abs(stock.changePercent).toFixed(2)}%
        </span>
      </div>
    </button>
  )
}

export default function Market() {
  const { marketData, loadingMarket, loadMarketData } = usePortfolioStore()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const chipRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => { loadMarketData() }, [])

  const gainers = marketData.filter((s) => s.changePercent > 0)
  const losers  = marketData.filter((s) => s.changePercent < 0)

  const nseChange = +(marketData.reduce((a, s) => a + s.changePercent, 0) / (marketData.length || 1)).toFixed(2)
  const nseUp = nseChange >= 0

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
            cursor: 'pointer', color: '#fff',
            fontSize: 12, fontWeight: 700,
            backdropFilter: 'blur(8px)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Compare
        </button>
      }
    >
      {/* NSE Index banner */}
      <div style={{
        padding: '14px 20px',
        background: 'linear-gradient(135deg, #f0fdf4 0%, #f8fff8 100%)',
        borderBottom: '1px solid #e2f5eb',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{
            fontSize: 10, fontWeight: 700, color: '#059669',
            letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 4,
          }}>
            NSE All-Share Index
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.7 }}>
              97,842.14
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 12, fontWeight: 700,
              color: nseUp ? '#065f46' : '#991b1b',
              background: nseUp ? '#d1fae5' : '#fee2e2',
              padding: '4px 10px', borderRadius: 20,
            }}>
              <svg width="7" height="7" viewBox="0 0 8 8" fill={nseUp ? '#065f46' : '#991b1b'} style={{marginRight:2,verticalAlign:'middle'}}>
                {nseUp ? <polygon points="4,0 8,8 0,8" /> : <polygon points="0,0 8,0 4,8" />}
              </svg>{Math.abs(nseChange).toFixed(2)}%
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, color: '#059669', fontWeight: 700, marginBottom: 3, letterSpacing: 0.5, textTransform: 'uppercase' }}>Gainers</p>
            <p style={{ fontSize: 18, fontWeight: 900, color: '#059669', letterSpacing: -0.4 }}>{gainers.length}</p>
          </div>
          <div style={{ width: 1, background: '#e2f5eb' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, color: '#dc2626', fontWeight: 700, marginBottom: 3, letterSpacing: 0.5, textTransform: 'uppercase' }}>Losers</p>
            <p style={{ fontSize: 18, fontWeight: 900, color: '#dc2626', letterSpacing: -0.4 }}>{losers.length}</p>
          </div>
        </div>
      </div>

      {/* Top Movers strip */}
      {!loadingMarket && marketData.length > 0 && (
        <div style={{
          padding: '14px 20px 12px',
          background: '#fff',
          borderBottom: '1px solid var(--border)',
        }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 10 }}>
            Top Movers
          </p>
          <div style={{
            display: 'flex', gap: 10,
            overflowX: 'auto', scrollbarWidth: 'none',
            paddingBottom: 2,
          }}>
            <TopMoverCard label="Top Gainer" stock={topGainer} onClick={() => navigate(`/trade/${topGainer.symbol}`)} />
            <TopMoverCard label="Top Loser"  stock={topLoser}  onClick={() => navigate(`/trade/${topLoser.symbol}`)}  />
            <TopMoverCard label="Most Active" stock={mostActive} onClick={() => navigate(`/trade/${mostActive.symbol}`)} />
            <div style={{ width: 4, flexShrink: 0 }} />
          </div>
        </div>
      )}

      {/* Search + Category */}
      <div style={{ background: '#fff', borderBottom: '1px solid var(--border)' }}>
        {/* Search */}
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: '#f8fafc', border: '1.5px solid var(--border)',
            borderRadius: 13, padding: '11px 14px', marginBottom: 12,
            transition: 'border-color 0.15s',
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text" placeholder="Search stocks…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ background: 'none', color: 'var(--text)', fontSize: 14, flex: 1, fontWeight: 500 }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: '#e2e8f0', color: '#64748b',
                  fontSize: 14, lineHeight: '20px', textAlign: 'center',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            )}
          </div>
        </div>

        {/* Category chips */}
        <div ref={chipRef} style={{
          display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 12,
          scrollbarWidth: 'none', paddingLeft: 20, paddingRight: 20,
        }}>
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              style={{
                padding: '7px 14px', borderRadius: 20, whiteSpace: 'nowrap',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: '1.5px solid',
                borderColor: category === cat ? 'var(--primary)' : 'var(--border)',
                background: category === cat ? 'linear-gradient(135deg,#059669,#047857)' : '#fff',
                color: category === cat ? '#fff' : 'var(--text-muted)',
                boxShadow: category === cat ? '0 2px 10px rgba(5,150,105,0.25)' : 'none',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Count row */}
      <div style={{
        padding: '8px 20px',
        background: '#f8fafc', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {category === 'All' ? 'All Equities' : category}
        </span>
        <span style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
          background: '#fff', border: '1px solid var(--border)',
          padding: '3px 8px', borderRadius: 10,
        }}>
          {filtered.length}
        </span>
      </div>

      {/* List */}
      {loadingMarket ? (
        <div>
          {Array.from({ length: 8 }).map((_, i) => <MarketRowSkeleton key={i} />)}
        </div>
      ) : (
        <div className="animate-in">
          {filtered.map((stock) => (
            <StockRow key={stock.symbol} stock={stock} onClick={() => navigate(`/trade/${stock.symbol}`)} />
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '64px 20px', textAlign: 'center' }}>
              <div style={{
                width: 64, height: 64, borderRadius: 20,
                background: '#f8fafc', border: '1.5px solid var(--border)',
                margin: '0 auto 16px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                  <line x1="2" y1="20" x2="22" y2="20"/>
                </svg>
              </div>
              <p style={{ fontWeight: 800, color: 'var(--text)', marginBottom: 5, fontSize: 15 }}>No results</p>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                {search ? `No stocks match "${search}"` : `No stocks in ${category}`}
              </p>
            </div>
          )}
        </div>
      )}

      <div style={{ height: 100 }} />
    </Layout>
  )
}
