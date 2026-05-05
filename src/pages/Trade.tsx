import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { usePortfolioStore } from '../store/portfolioStore'
import { useAuthStore } from '../store/authStore'
import { generateIntradayChart } from '../lib/sparkline'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { initializePayment } from '../lib/monetaApi'
import { validateOrder, type PacValidationResult } from '../lib/pacApi'

type Side = 'BUY' | 'SELL'
type OrderType = 'MARKET' | 'LIMIT'
type Period = '1D' | '1W' | '1M' | '3M'

function fmt(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function PriceChart({ symbol, price, isUp }: { symbol: string; price: number; isUp: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dims, setDims] = useState({ w: 340, h: 150 })
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [period, setPeriod] = useState<Period>('1D')

  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setDims({ w: entry.contentRect.width, h: 150 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const { line, area, points } = generateIntradayChart(symbol + period, price, isUp, dims.w, dims.h)
  const color = isUp ? '#10b981' : '#ef4444'
  const chartId = `chart-${symbol}`
  const n = points.length
  const hoverPrice = hoverIdx !== null ? points[hoverIdx] : null

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    setHoverIdx(Math.max(0, Math.min(n - 1, Math.round((x / dims.w) * (n - 1)))))
  }

  const hoverX = hoverIdx !== null ? (hoverIdx / (n - 1)) * dims.w : null
  const periods: Period[] = ['1D', '1W', '1M', '3M']

  return (
    <div>
      <div style={{ position: 'relative' }}>
        {hoverPrice !== null && (
          <div style={{ position: 'absolute', top: 10, left: 16, zIndex: 10, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)', borderRadius: 10, padding: '6px 12px', color: '#fff', fontSize: 14, fontWeight: 800, letterSpacing: -0.3 }}>
            {fmt(hoverPrice)}
          </div>
        )}
        <svg ref={svgRef} width="100%" height={dims.h} style={{ display: 'block', cursor: 'crosshair', userSelect: 'none' }} onMouseMove={handleMouseMove} onMouseLeave={() => setHoverIdx(null)}>
          <defs>
            <linearGradient id={chartId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.28" />
              <stop offset="85%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={area} fill={`url(#${chartId})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          {hoverX !== null && hoverIdx !== null && (() => {
            const pad = dims.h * 0.12
            const pts2 = points.map((p, i) => {
              const minP = Math.min(...points), maxP = Math.max(...points), range = maxP - minP || 1
              return [(i / (n - 1)) * dims.w, pad + ((maxP - p) / range) * (dims.h - pad * 2)] as [number, number]
            })
            const [, hy] = pts2[hoverIdx]
            return (
              <g>
                <line x1={hoverX} y1={0} x2={hoverX} y2={dims.h} stroke={color} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
                <circle cx={hoverX} cy={hy} r="5" fill={color} />
                <circle cx={hoverX} cy={hy} r="9" fill={color} opacity="0.2" />
              </g>
            )
          })()}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 16px 8px', pointerEvents: 'none' }}>
          {['9:30', '11:30', '13:30', '15:30'].map((t) => (
            <span key={t} style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{t}</span>
          ))}
        </div>
      </div>

      {/* Period selector */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '8px 20px 12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {periods.map((p) => (
          <button key={p} onClick={() => setPeriod(p)} style={{ padding: '6px 16px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: period === p ? (isUp ? 'linear-gradient(135deg,#059669,#047857)' : 'linear-gradient(135deg,#dc2626,#b91c1c)') : 'rgba(255,255,255,0.06)', color: period === p ? '#fff' : 'rgba(255,255,255,0.38)', boxShadow: period === p ? `0 2px 10px ${isUp ? 'rgba(5,150,105,0.30)' : 'rgba(220,38,38,0.25)'}` : 'none', transition: 'all 0.15s' }}>
            {p}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function Trade() {
  const { symbol } = useParams<{ symbol: string }>()
  const navigate = useNavigate()
  const { marketData, positions, orderLoading, orderResult, placeOrder, clearOrderResult, loadMarketData } = usePortfolioStore()
  const { pacAccountId } = useAuthStore()
  const kycStatus = useAuthStore((s) => s.kycStatus)

  const [side, setSide] = useState<Side>('BUY')
  const [orderType, setOrderType] = useState<OrderType>('MARKET')
  const [quantity, setQuantity] = useState('')
  const [limitPrice, setLimitPrice] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [showKycGate, setShowKycGate] = useState(false)
  const [paySource, setPaySource] = useState<'wallet' | 'moneta'>('wallet')
  const [monetaLoading, setMonetaLoading] = useState(false)
  const [monetaError, setMonetaError] = useState<string | null>(null)
  const [validating, setValidating] = useState(false)
  const [validation, setValidation] = useState<PacValidationResult | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const walletBalance = useAuthStore((s) => s.walletBalance)
  const debitWallet = useAuthStore((s) => s.debitWallet)
  const userEmail = useAuthStore((s) => s.user?.email ?? '')

  useEffect(() => { if (marketData.length === 0) loadMarketData() }, [])
  useEffect(() => {
    if (orderResult?.success) {
      const t = setTimeout(() => { clearOrderResult(); navigate('/portfolio') }, 2800)
      return () => clearTimeout(t)
    }
  }, [orderResult])

  useEffect(() => {
    if (!showConfirm) {
      setValidation(null); setValidationError(null); setValidating(false)
      return
    }
    if (!pacAccountId || qty <= 0) return
    const currentStock = marketData.find(s => s.symbol === symbol)
    if (!currentStock) return
    let cancelled = false
    setValidating(true); setValidation(null); setValidationError(null)
    const effectivePx = orderType === 'LIMIT' && limitPrice ? parseFloat(limitPrice) : currentStock.price
    validateOrder({ accountId: pacAccountId, symbol: currentStock.symbol, side, quantity: qty, orderType, limitPrice: orderType === 'LIMIT' ? effectivePx : undefined })
      .then(v => { if (!cancelled) setValidation(v) })
      .catch(e => { if (!cancelled) setValidationError((e as Error).message) })
      .finally(() => { if (!cancelled) setValidating(false) })
    return () => { cancelled = true }
  }, [showConfirm])

  const stock = marketData.find((s) => s.symbol === symbol)
  const holding = positions.find((p) => p.symbol === symbol)

  if (!stock) {
    return (
      <div style={{ minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#070e1a' }}>
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>Security not found.</p>
          <button onClick={() => navigate('/market')} style={{ color: '#34d399', fontWeight: 700 }}>Back to Market</button>
        </div>
      </div>
    )
  }

  const isUp = stock.changePercent >= 0
  const effectivePrice = orderType === 'LIMIT' && limitPrice ? parseFloat(limitPrice) : stock.price
  const qty = parseInt(quantity) || 0
  const estimatedTotal = effectivePrice * qty
  const orderTotal = validation?.totalValue ?? estimatedTotal

  return (
    <div style={{ minHeight: '100svh', background: '#070e1a', display: 'flex', flexDirection: 'column', paddingBottom: 100 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', paddingTop: 'calc(env(safe-area-inset-top,0px) + 14px)', background: 'linear-gradient(135deg, #050d1a 0%, #0c1526 65%, #022c22 100%)', borderBottom: '1px solid rgba(5,150,105,0.15)', position: 'sticky', top: 0, zIndex: 40 }}>
        <button onClick={() => navigate(-1)} style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ fontWeight: 900, fontSize: 18, color: '#fff', letterSpacing: -0.4 }}>{stock.symbol}</p>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, color: isUp ? '#34d399' : '#f87171', background: isUp ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.15)', padding: '3px 8px', borderRadius: 20 }}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill={isUp ? '#34d399' : '#f87171'}>{isUp ? <polygon points="4,0 8,8 0,8" /> : <polygon points="0,0 8,0 4,8" />}</svg>
              {Math.abs(stock.changePercent).toFixed(2)}%
            </span>
          </div>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{stock.name}</p>
        </div>
        <button onClick={() => navigate(`/compare?with=${stock.symbol}`)} style={{ width: 38, height: 38, borderRadius: 12, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
        </button>
        {holding && (
          <div style={{ background: 'rgba(16,185,129,0.2)', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(16,185,129,0.35)' }}>
            <p style={{ fontSize: 9, color: '#6ee7b7', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>OWNED</p>
            <p style={{ fontSize: 12, color: '#fff', fontWeight: 800, textAlign: 'center' }}>{holding.quantity}</p>
          </div>
        )}
      </div>

      {/* Price + Chart */}
      <div style={{ background: '#0a1525' }}>
        <div style={{ padding: '20px 20px 4px' }}>
          <p style={{ fontSize: 42, fontWeight: 900, color: '#ffffff', letterSpacing: -1.8, lineHeight: 1, marginBottom: 8 }}>{fmt(stock.price)}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: isUp ? '#34d399' : '#f87171' }}>
              {isUp ? '+' : ''}₦{stock.change.toFixed(2)}
            </span>
            <span style={{ fontSize: 11, fontWeight: 700, color: isUp ? '#34d399' : '#f87171', background: isUp ? 'rgba(16,185,129,0.18)' : 'rgba(239,68,68,0.15)', padding: '3px 9px', borderRadius: 20 }}>
              {isUp ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(2)}%
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>today</span>
          </div>
        </div>
        <PriceChart symbol={stock.symbol} price={stock.price} isUp={isUp} />
      </div>

      {/* OHLV */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', margin: '12px 12px 0', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.07)', background: '#0e1c2f' }}>
        {[
          { label: 'Open', val: `₦${stock.open.toFixed(2)}`,  color: undefined },
          { label: 'High', val: `₦${stock.high.toFixed(2)}`,  color: '#34d399' },
          { label: 'Low',  val: `₦${stock.low.toFixed(2)}`,   color: '#f87171' },
          { label: 'Vol',  val: (stock.volume / 1000).toFixed(0) + 'K', color: undefined },
        ].map(({ label, val, color }, i) => (
          <div key={label} style={{ padding: '11px 0', textAlign: 'center', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 5 }}>{label}</p>
            <p style={{ fontSize: 13, fontWeight: 800, color: color ?? '#ffffff', letterSpacing: -0.2 }}>{val}</p>
          </div>
        ))}
      </div>

      {/* Order form */}
      <div style={{ margin: '12px 12px 0', background: '#0e1c2f', borderRadius: 20, padding: '20px 16px', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Buy/Sell toggle */}
        <div style={{ display: 'flex', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 5, gap: 5 }}>
          {(['BUY', 'SELL'] as Side[]).map((s) => (
            <button key={s} onClick={() => setSide(s)} style={{ flex: 1, padding: '12px', borderRadius: 12, fontWeight: 900, fontSize: 15, letterSpacing: 0.5, cursor: 'pointer', transition: 'all 0.18s', background: side === s ? (s === 'BUY' ? 'linear-gradient(135deg, #059669, #047857)' : 'linear-gradient(135deg, #dc2626, #b91c1c)') : 'transparent', color: side === s ? '#fff' : 'rgba(255,255,255,0.38)', boxShadow: side === s ? (s === 'BUY' ? '0 4px 14px rgba(5,150,105,0.32)' : '0 4px 14px rgba(220,38,38,0.28)') : 'none' }}>
              {s}
            </button>
          ))}
        </div>

        {/* Order type */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['MARKET', 'LIMIT'] as OrderType[]).map((t) => (
            <button key={t} onClick={() => setOrderType(t)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid', borderColor: orderType === t ? '#059669' : 'rgba(255,255,255,0.1)', background: orderType === t ? 'rgba(5,150,105,0.15)' : 'rgba(255,255,255,0.04)', color: orderType === t ? '#34d399' : 'rgba(255,255,255,0.38)', fontWeight: 700, fontSize: 12, letterSpacing: 0.3, cursor: 'pointer', transition: 'all 0.15s' }}>
              {t} ORDER
            </button>
          ))}
        </div>

        {/* Quantity */}
        <div>
          <label style={labelStyle}>Quantity (Units)</label>
          <div style={{ position: 'relative' }}>
            <input
              type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="0"
              style={{ width: '100%', padding: '14px 80px 14px 16px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#ffffff', fontSize: 22, fontWeight: 900, letterSpacing: -0.5, boxSizing: 'border-box' }}
            />
            <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}>
              {['+1', '+10'].map((d) => (
                <button key={d} onClick={() => setQuantity((q) => String((parseInt(q) || 0) + parseInt(d.replace('+', ''))))} style={{ padding: '4px 8px', borderRadius: 7, background: 'rgba(5,150,105,0.2)', color: '#34d399', fontSize: 11, fontWeight: 700 }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Limit price */}
        {orderType === 'LIMIT' && (
          <div>
            <label style={labelStyle}>Limit Price (₦)</label>
            <input type="number" min="0" step="0.01" value={limitPrice} onChange={(e) => setLimitPrice(e.target.value)} placeholder={stock.price.toFixed(2)}
              style={{ width: '100%', padding: '14px 16px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: '#ffffff', fontSize: 20, fontWeight: 800, boxSizing: 'border-box' }}
            />
          </div>
        )}

        {/* Estimated total */}
        {qty > 0 && (
          <div style={{ background: side === 'BUY' ? 'rgba(5,150,105,0.12)' : 'rgba(239,68,68,0.1)', border: `1.5px solid ${side === 'BUY' ? 'rgba(5,150,105,0.3)' : 'rgba(239,68,68,0.25)'}`, borderRadius: 14, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{qty.toLocaleString()} × ₦{effectivePrice.toFixed(2)}</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: '#ffffff', letterSpacing: -0.5 }}>{fmt(estimatedTotal)}</span>
            </div>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>Est. {side === 'BUY' ? 'cost' : 'proceeds'} · Broker fees not included</p>
          </div>
        )}

        {/* Order result */}
        {orderResult && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: orderResult.success ? 'rgba(5,150,105,0.12)' : 'rgba(239,68,68,0.1)', borderLeft: `3px solid ${orderResult.success ? '#059669' : '#dc2626'}`, borderRadius: 10, padding: '12px 14px', color: orderResult.success ? '#34d399' : '#f87171', fontSize: 13, fontWeight: 600 }}>
            <span style={{ flexShrink: 0 }}>
              {orderResult.success
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              }
            </span>
            {orderResult.message}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={() => kycStatus !== 'verified' ? setShowKycGate(true) : setShowConfirm(true)}
          disabled={!qty || qty <= 0 || orderLoading}
          style={{ padding: '16px', borderRadius: 16, fontWeight: 900, fontSize: 17, letterSpacing: 0.2, cursor: (!qty || qty <= 0 || orderLoading) ? 'not-allowed' : 'pointer', transition: 'all 0.2s', background: (!qty || qty <= 0 || orderLoading) ? 'rgba(255,255,255,0.08)' : side === 'BUY' ? 'linear-gradient(135deg, #059669, #047857)' : 'linear-gradient(135deg, #dc2626, #b91c1c)', color: (!qty || qty <= 0 || orderLoading) ? 'rgba(255,255,255,0.25)' : '#fff', boxShadow: (!qty || qty <= 0 || orderLoading) ? 'none' : side === 'BUY' ? '0 6px 24px rgba(5,150,105,0.38)' : '0 6px 24px rgba(220,38,38,0.32)' }}
        >
          {orderLoading ? 'Placing Order…' : `Place ${side} Order`}
        </button>
      </div>

      {/* KYC Gate Modal — centered */}
      {showKycGate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '0 20px' }} onClick={() => setShowKycGate(false)}>
          <div style={{ width: '100%', maxWidth: 400, background: '#fff', borderRadius: 24, padding: '28px 24px 24px', boxShadow: '0 24px 64px rgba(0,0,0,0.3)', animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
              <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#fff7ed', border: '2px solid #fed7aa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
            </div>
            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#0f172a', textAlign: 'center', marginBottom: 10, letterSpacing: -0.4 }}>KYC Required</h3>
            <p style={{ fontSize: 14, color: '#64748b', textAlign: 'center', lineHeight: 1.6, marginBottom: 24, fontWeight: 500 }}>
              You must complete identity verification before you can buy or sell stocks. This is required by the <strong style={{ color: '#0f172a' }}>SEC Nigeria</strong> and CBN.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowKycGate(false)} style={{ flex: 1, padding: '14px', borderRadius: 16, background: '#f8fafc', border: '1.5px solid #e2e8f0', color: '#475569', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>Maybe Later</button>
              <button onClick={() => navigate('/kyc')} style={{ flex: 2, padding: '14px', borderRadius: 16, background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff', fontWeight: 800, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 16px rgba(5,150,105,0.32)', border: 'none' }}>Complete KYC</button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm sheet — stays light so it contrasts with dark page */}
      {showConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'flex-end', zIndex: 100 }} onClick={() => setShowConfirm(false)}>
          <div style={{ width: '100%', maxWidth: 430, margin: '0 auto', background: '#fff', borderRadius: '28px 28px 0 0', padding: '8px 20px 44px', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)', animation: 'slideUp 0.28s cubic-bezier(0.34,1.56,0.64,1)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ width: 40, height: 4, background: '#e2e8f0', borderRadius: 2, margin: '14px auto 22px' }} />
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 24px', borderRadius: 20, fontSize: 14, fontWeight: 900, letterSpacing: 0.5, background: side === 'BUY' ? '#d1fae5' : '#fee2e2', color: side === 'BUY' ? '#065f46' : '#991b1b' }}>
                <svg width="10" height="10" viewBox="0 0 8 8" fill={side === 'BUY' ? '#065f46' : '#991b1b'}>{side === 'BUY' ? <polygon points="4,0 8,8 0,8" /> : <polygon points="0,0 8,0 4,8" />}</svg>
                {side} ORDER · {stock.symbol}
              </span>
            </div>
            <div style={{ borderRadius: 16, overflow: 'hidden', border: '1.5px solid var(--border)', marginBottom: 18 }}>
              {[['Security', stock.name], ['Order Type', orderType], ['Quantity', `${qty.toLocaleString()} units`], ['Price', `₦${effectivePrice.toFixed(2)}`], ['Total', fmt(estimatedTotal)]].map(([label, value], i) => (
                <div key={label as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', background: i % 2 === 0 ? '#fff' : '#f8fafc', borderBottom: i < 4 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: label === 'Total' ? (side === 'BUY' ? '#059669' : '#dc2626') : 'var(--text)' }}>{value}</span>
                </div>
              ))}
            </div>
            {validating && (
              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 12, background: 'rgba(5,150,105,0.06)', border: '1px solid rgba(5,150,105,0.2)' }}>
                <div style={{ width: 14, height: 14, border: '2px solid #059669', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>Calculating fees…</span>
              </div>
            )}
            {validation && (
              <div style={{ marginBottom: 14, borderRadius: 14, border: '1.5px solid rgba(5,150,105,0.3)', background: 'rgba(5,150,105,0.06)', padding: '12px 16px' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#059669', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Fees & Charges</p>
                {([
                  ['Consideration', fmt(validation.consideration)],
                  ['Commission + Fees', fmt(validation.commission + validation.fees)],
                  ['Total Due', fmt(validation.totalValue)],
                ] as [string, string][]).map(([label, value]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: label === 'Total Due' ? 0 : 5 }}>
                    <span style={{ fontSize: 12, color: label === 'Total Due' ? 'var(--text)' : 'var(--text-muted)', fontWeight: label === 'Total Due' ? 700 : 500 }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: label === 'Total Due' ? '#059669' : 'var(--text)' }}>{value}</span>
                  </div>
                ))}
              </div>
            )}
            {validationError && !validation && (
              <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 12, background: '#fff5f5', border: '1px solid #fecaca', fontSize: 12, color: '#991b1b', fontWeight: 600 }}>
                Fee estimate unavailable — proceed to place order
              </div>
            )}
            {side === 'BUY' && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Pay With</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([
                    { key: 'wallet' as const, label: 'Wallet', sub: `₦${walletBalance.toLocaleString('en-NG', { minimumFractionDigits: 2 })} available` },
                    { key: 'moneta' as const, label: 'Moneta', sub: 'Card / Transfer / USSD' },
                  ]).map(({ key, label, sub }) => (
                    <button key={key} onClick={() => { setPaySource(key); setMonetaError(null) }} style={{ flex: 1, padding: '10px 12px', borderRadius: 12, cursor: 'pointer', border: `2px solid ${paySource === key ? (side === 'BUY' ? '#059669' : '#dc2626') : 'var(--border)'}`, background: paySource === key ? (side === 'BUY' ? '#f0fdf4' : '#fff5f5') : '#fff', textAlign: 'left', transition: 'all 0.15s' }}>
                      <p style={{ fontSize: 12, fontWeight: 800, color: paySource === key ? (side === 'BUY' ? '#059669' : '#dc2626') : 'var(--text)', marginBottom: 2 }}>{label}</p>
                      <p style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 500 }}>{sub}</p>
                    </button>
                  ))}
                </div>
                {paySource === 'wallet' && walletBalance < orderTotal && (
                  <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 10, background: '#fff5f5', border: '1px solid #fecaca', fontSize: 12, color: '#991b1b', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>Insufficient funds</span>
                    <button onClick={() => { setShowConfirm(false); navigate('/portfolio') }} style={{ fontSize: 11, fontWeight: 700, color: '#059669', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Fund Wallet</button>
                  </div>
                )}
                {monetaError && <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 8, background: '#fff5f5', border: '1px solid #fecaca', fontSize: 11, color: '#991b1b', fontWeight: 600 }}>{monetaError}</div>}
              </div>
            )}
            {!pacAccountId && (
              <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 10, background: '#fff7ed', border: '1px solid #fed7aa', fontSize: 12, color: '#92400e', fontWeight: 600 }}>
                No broker account linked. Complete KYC to enable trading.
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: '14px', background: '#f8fafc', border: '1.5px solid var(--border)', borderRadius: 16, color: 'var(--text)', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
              <button
                disabled={!pacAccountId || monetaLoading || orderLoading || validating || (side === 'BUY' && paySource === 'wallet' && walletBalance < orderTotal)}
                onClick={async () => {
                  if (!pacAccountId) return
                  if (side === 'BUY' && paySource === 'moneta') {
                    setMonetaLoading(true); setMonetaError(null)
                    try {
                      localStorage.setItem('moneta_pending_order', JSON.stringify({ accountId: pacAccountId, symbol: stock.symbol, side: 'BUY', quantity: qty, orderType, limitPrice: orderType === 'LIMIT' ? effectivePrice : undefined, estimatedTotal }))
                      const { reference, authorizationUrl } = await initializePayment(userEmail, estimatedTotal, 'card')
                      localStorage.setItem('moneta_pending_ref', reference)
                      localStorage.setItem('moneta_pending_amount', String(estimatedTotal))
                      if (Capacitor.isNativePlatform()) {
                        setShowConfirm(false)
                        await Browser.open({ url: authorizationUrl })
                      } else {
                        window.location.href = authorizationUrl
                      }
                    } catch (e: unknown) {
                      localStorage.removeItem('moneta_pending_order')
                      setMonetaError((e as Error).message)
                    } finally {
                      setMonetaLoading(false)
                    }
                    return
                  }
                  if (side === 'BUY' && paySource === 'wallet') {
                    await placeOrder({ accountId: pacAccountId, symbol: stock.symbol, side, quantity: qty, orderType, limitPrice: orderType === 'LIMIT' ? effectivePrice : undefined, estimatedTotal })
                    const result = usePortfolioStore.getState().orderResult
                    if (result?.success) { try { await debitWallet(orderTotal) } catch (e: unknown) { setMonetaError((e as Error).message) } }
                    setShowConfirm(false); return
                  }
                  await placeOrder({ accountId: pacAccountId, symbol: stock.symbol, side, quantity: qty, orderType, limitPrice: orderType === 'LIMIT' ? effectivePrice : undefined, estimatedTotal })
                  setShowConfirm(false)
                }}
                style={{ flex: 2, padding: '14px', background: (!pacAccountId || monetaLoading || orderLoading || validating || (side === 'BUY' && paySource === 'wallet' && walletBalance < orderTotal)) ? '#f1f5f9' : side === 'BUY' ? 'linear-gradient(135deg,#059669,#047857)' : 'linear-gradient(135deg,#dc2626,#b91c1c)', borderRadius: 16, color: (!pacAccountId || monetaLoading || orderLoading || validating || (side === 'BUY' && paySource === 'wallet' && walletBalance < orderTotal)) ? '#94a3b8' : '#fff', fontWeight: 900, fontSize: 15, cursor: (!pacAccountId || validating) ? 'not-allowed' : 'pointer', boxShadow: side === 'BUY' ? '0 4px 16px rgba(5,150,105,0.32)' : '0 4px 16px rgba(220,38,38,0.25)' }}
              >
                {monetaLoading ? 'Redirecting…' : validating ? 'Checking…' : orderLoading ? 'Placing Order…' : `Confirm ${side}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 11, fontWeight: 700,
  color: 'rgba(255,255,255,0.4)', marginBottom: 7,
  letterSpacing: 0.5, textTransform: 'uppercase',
}
