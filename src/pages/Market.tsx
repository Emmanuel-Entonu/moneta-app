import { useEffect, useRef, useState } from 'react'
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

function Sparkline({ symbol, isUp }: { symbol: string; isUp: boolean }) {
  const id = `spark-${symbol}-${Math.random().toString(36).slice(2,6)}`
  const { line, area } = generateSparklineArea(symbol, isUp, 72, 32)
  const color = isUp ? '#059669' : '#e03131'
  return (
    <svg width={72} height={32} style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
        background: '#fff', width: '100%', textAlign: 'left',
        borderBottom: '1px solid #f1f5f9',
        cursor: 'pointer',
        transition: 'background 0.1s',
      }}
      onPointerEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
      onPointerLeave={(e) => (e.currentTarget.style.background = '#fff')}
    >
      {/* Avatar */}
      <div style={{
        width: 44, height: 44, borderRadius: '50%',
        background: color + '18',
        border: `1.5px solid ${color}28`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginRight: 12, flexShrink: 0,
      }}>
        <span style={{ fontSize: 9, fontWeight: 900, color, letterSpacing: -0.5 }}>
          {stock.symbol.slice(0, 4)}
        </span>
      </div>

      {/* Name */}
      <div style={{ flex: 1, minWidth: 0, marginRight: 8 }}>
        <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 3 }}>
          {stock.symbol}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }}>
          {stock.name}
        </p>
      </div>

      {/* Sparkline */}
      <Sparkline symbol={stock.symbol} isUp={up} />

      {/* Price + change */}
      <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 84, marginLeft: 10 }}>
        <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 4, letterSpacing: -0.3 }}>
          {fmt(stock.price)}
        </p>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
          fontSize: 11, fontWeight: 700,
          color: up ? '#065f46' : '#991b1b',
          background: up ? '#d1fae5' : '#fee2e2',
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
  const cols = [
    { label: 'Top Gainer', stock: topGainer, up: true,  color: '#059669' },
    { label: 'Top Loser',  stock: topLoser,  up: false, color: '#e03131' },
    { label: 'Most Active', stock: mostActive, up: mostActive.changePercent >= 0, color: '#2563eb' },
  ]
  return (
    <div style={{
      margin: '12px 16px',
      background: '#fff',
      borderRadius: 16,
      border: '1px solid var(--border)',
      boxShadow: '0 2px 8px rgba(10,22,40,0.06)',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 16px 8px',
        borderBottom: '1px solid var(--border)',
      }}>
        <p style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: 0.8, textTransform: 'uppercase' }}>
          Top Movers
        </p>
      </div>
      <div style={{ display: 'flex' }}>
        {cols.map(({ label, stock, up, color }, i) => (
          <button
            key={label}
            onClick={() => onNavigate(stock.symbol)}
            style={{
              flex: 1, padding: '12px 12px 14px',
              textAlign: 'left', cursor: 'pointer',
              borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
              background: 'none',
              transition: 'background 0.12s',
            }}
            onPointerEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
            onPointerLeave={(e) => (e.currentTarget.style.background = 'none')}
          >
            <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>
              {label}
            </p>
            <p style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)', letterSpacing: -0.3, marginBottom: 2 }}>
              {stock.symbol}
            </p>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500, marginBottom: 8,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {stock.name.split(' ').slice(0, 2).join(' ')}
            </p>
            <p style={{ fontSize: 12, fontWeight: 800, color: 'var(--text)', marginBottom: 5, letterSpacing: -0.2 }}>
              ₦{stock.price.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
            </p>
            <span style={{
              fontSize: 11, fontWeight: 700,
              color: up ? '#059669' : '#e03131',
            }}>
              {up ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(2)}%
            </span>
          </button>
        ))}
      </div>
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
      {/* NSE dark stats banner */}
      <div style={{
        padding: '16px 20px',
        background: 'linear-gradient(135deg, #0a1628, #0f1f38)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 6 }}>
            NSE All-Share Index
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 900, color: '#fff', letterSpacing: -0.8 }}>
              97,842.14
            </span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              fontSize: 12, fontWeight: 800,
              color: '#fff',
              background: nseUp ? '#059669' : '#e03131',
              padding: '4px 10px', borderRadius: 20,
            }}>
              {nseUp ? '▲' : '▼'} {Math.abs(nseChange).toFixed(2)}%
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>Gainers</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#10b981', letterSpacing: -0.5 }}>{gainers.length}</p>
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', fontWeight: 700, marginBottom: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>Losers</p>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#fc5c65', letterSpacing: -0.5 }}>{losers.length}</p>
          </div>
        </div>
      </div>

      {/* Top Movers panel */}
      {!loadingMarket && marketData.length > 0 && (
        <TopMoversPanel
          topGainer={topGainer} topLoser={topLoser} mostActive={mostActive}
          onNavigate={(sym) => navigate(`/trade/${sym}`)}
        />
      )}

      {/* Search + filters */}
      <div style={{ background: '#fff', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>
        <div style={{ padding: '12px 16px 0' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--bg-page)', border: '1.5px solid var(--border)',
            borderRadius: 13, padding: '11px 14px', marginBottom: 12,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#8fa3be" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                  background: '#e2e8f0', color: '#64748b', fontSize: 14,
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
                borderColor: category === cat ? 'transparent' : 'var(--border)',
                background: category === cat ? 'linear-gradient(135deg,#059669,#047857)' : '#fff',
                color: category === cat ? '#fff' : 'var(--text-muted)',
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
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.7 }}>
          {category === 'All' ? 'All Equities' : category}
        </span>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>
          {filtered.length} securities
        </span>
      </div>

      {/* List */}
      <div style={{ background: '#fff' }}>
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
                  width: 64, height: 64, borderRadius: 20, background: '#f8fafc',
                  border: '1.5px solid var(--border)', margin: '0 auto 16px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c8d4e0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/>
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
      </div>
      <div style={{ height: 100 }} />
    </Layout>
  )
}
