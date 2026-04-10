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
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0, width: 138,
        background: '#fff',
        border: `1.5px solid ${accent}22`,
        borderRadius: 16, padding: '12px 14px',
        cursor: 'pointer', textAlign: 'left',
        boxShadow: `0 2px 8px ${accent}10`,
        transition: 'box-shadow 0.15s',
      }}
      onPointerEnter={(e) => (e.currentTarget.style.boxShadow = `0 4px 16px ${accent}22`)}
      onPointerLeave={(e) => (e.currentTarget.style.boxShadow = `0 2px 8px ${accent}10`)}
    >
      <p style={{ fontSize: 9, fontWeight: 800, color: accent, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
        {label}
      </p>
      <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.3, marginBottom: 2 }}>
        {stock.symbol}
      </p>
      <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 6,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {stock.name}
      </p>
      <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)', marginBottom: 4, letterSpacing: -0.3 }}>
        ₦{stock.price.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </p>
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        fontSize: 10, fontWeight: 800,
        color: up ? '#065f46' : '#991b1b',
        background: up ? '#d1fae5' : '#fee2e2',
        padding: '2px 7px', borderRadius: 20,
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
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
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
        transition: 'background 0.12s',
      }}
      onPointerEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
      onPointerLeave={(e) => (e.currentTarget.style.background = '#fff')}
    >
      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: color + '15',
        border: `1.5px solid ${color}28`,
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
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 80 }}>
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

  // NSE index mock (sum of top stocks)
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
            padding: '7px 13px', borderRadius: 20,
            background: 'linear-gradient(135deg, #059669, #047857)',
            border: 'none', cursor: 'pointer', color: '#fff',
            fontSize: 12, fontWeight: 700,
            boxShadow: '0 2px 8px rgba(5,150,105,0.30)',
          }}
        >
          <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
          Compare
        </button>
      }
    >
      {/* NSE Index banner */}
      <div style={{
        padding: '14px 20px',
        background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 100%)',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 3 }}>
            NSE All-Share Index
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.5 }}>
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
        <div style={{ textAlign: 'right' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>GAINERS</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#059669' }}>{gainers.length}</p>
            </div>
            <div>
              <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 2 }}>LOSERS</p>
              <p style={{ fontSize: 16, fontWeight: 800, color: '#dc2626' }}>{losers.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Top Movers strip */}
      {!loadingMarket && marketData.length > 0 && (
        <div style={{
          padding: '12px 20px',
          background: '#f8fafc',
          borderBottom: '1px solid var(--border)',
          display: 'flex', gap: 10,
          overflowX: 'auto', scrollbarWidth: 'none',
        }}>
          <TopMoverCard label="Top Gainer" stock={topGainer} onClick={() => navigate(`/trade/${topGainer.symbol}`)} />
          <TopMoverCard label="Top Loser"  stock={topLoser}  onClick={() => navigate(`/trade/${topLoser.symbol}`)}  />
          <TopMoverCard label="Most Active" stock={mostActive} onClick={() => navigate(`/trade/${mostActive.symbol}`)} />
          <div style={{ width: 4, flexShrink: 0 }} />
        </div>
      )}

      {/* Search */}
      <div style={{ padding: '12px 20px 0', background: '#fff', borderBottom: '1px solid var(--border)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: '#f8fafc', border: '1.5px solid var(--border)',
          borderRadius: 12, padding: '10px 14px', marginBottom: 12,
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
            <button onClick={() => setSearch('')} style={{ color: '#94a3b8', fontSize: 20, lineHeight: 1, fontWeight: 300 }}>×</button>
          )}
        </div>

        {/* Category chips */}
        <div ref={chipRef} style={{
          display: 'flex', gap: 7, overflowX: 'auto', paddingBottom: 12,
          scrollbarWidth: 'none',
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
                boxShadow: category === cat ? '0 2px 8px rgba(5,150,105,0.25)' : 'none',
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <div style={{
        padding: '9px 20px',
        background: '#f8fafc', borderBottom: '1px solid var(--border)',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6 }}>
          {category === 'All' ? 'All Equities' : category}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
          {filtered.length} securities
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
            <div style={{ padding: '60px 20px', textAlign: 'center' }}>
              <div style={{ marginBottom: 12 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                  <line x1="2" y1="20" x2="22" y2="20"/>
                </svg>
              </div>
              <p style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>No results</p>
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
