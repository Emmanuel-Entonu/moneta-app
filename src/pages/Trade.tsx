import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { usePortfolioStore } from '../store/portfolioStore'
import { useAuthStore } from '../store/authStore'
import { generateIntradayChart, generateDayChart } from '../lib/sparkline'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { initializePayment } from '../lib/monetaApi'
import { validateOrder, getHistoricalPrices, type PacValidationResult } from '../lib/pacApi'

type Side = 'BUY' | 'SELL'
type OrderType = 'MARKET' | 'LIMIT'
type Period = '1D' | '1W' | '1M' | '3M'

type ReceiptData = {
  symbol: string
  name: string
  side: Side
  qty: number
  price: number
  orderType: OrderType
  total: number
  validation: PacValidationResult | null
  orderId?: string | null
  timestamp: Date
}

function fmt(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseHistoricalPrices(raw: unknown, currentPrice: number): number[] {
  try {
    const r = raw as Record<string, unknown>
    const list = Array.isArray(r?.priceHistory) ? r.priceHistory as Record<string, unknown>[]
      : Array.isArray(r?.data) ? r.data as Record<string, unknown>[]
      : Array.isArray(raw) ? raw as Record<string, unknown>[] : []
    // Sort ascending by date — API may return newest-first which would plot the chart backwards
    const sorted = [...list].sort((a, b) => {
      const da = String(a?.tradeDate ?? a?.date ?? a?.Date ?? a?.time ?? '')
      const db = String(b?.tradeDate ?? b?.date ?? b?.Date ?? b?.time ?? '')
      return da.localeCompare(db)
    })
    const prices = sorted.map(it => Number(it?.close ?? it?.closingPrice ?? it?.closePrice ?? it?.price ?? 0)).filter(p => p > 0)
    if (prices.length > 0) prices[prices.length - 1] = currentPrice
    return prices
  } catch { return [] }
}

function buildChartPaths(prices: number[], w: number, h: number): { line: string; area: string } | null {
  const n = prices.length
  if (n < 2) return null
  const minP = Math.min(...prices), maxP = Math.max(...prices)
  const range = maxP - minP || 1
  const pad = h * 0.12
  const pts = prices.map((p, i) => [
    (i / (n - 1)) * w,
    pad + ((maxP - p) / range) * (h - pad * 2),
  ] as [number, number])
  let line = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 1; i < n; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]
    line += ` Q ${((x0 + x1) / 2).toFixed(1)} ${y0.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`
  }
  return { line, area: line + ` L ${w} ${h} L 0 ${h} Z` }
}

const PERIOD_LABELS: Record<Period, string[]> = {
  '1D': ['9:30', '11:30', '13:30', '15:30'],
  '1W': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  '1M': ['Wk 1', 'Wk 2', 'Wk 3', 'Wk 4'],
  '3M': ['Mo 1', 'Mo 2', 'Mo 3'],
}

function PriceChart({ symbol, price, open, high, low, isUp }: { symbol: string; price: number; open: number; high: number; low: number; isUp: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dims, setDims] = useState({ w: 340, h: 150 })
  const [hoverIdx, setHoverIdx] = useState<number | null>(null)
  const [period, setPeriod] = useState<Period>('1D')
  const [realPoints, setRealPoints] = useState<number[] | null>(null)
  const [histLoading, setHistLoading] = useState(false)

  useEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    const ro = new ResizeObserver(([entry]) => setDims({ w: entry.contentRect.width, h: 150 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    setRealPoints(null)
    setHistLoading(true)
    const today = new Date()
    const from = new Date(today)
    from.setDate(today.getDate() - (period === '1W' ? 7 : period === '1M' ? 30 : period === '3M' ? 90 : 1))
    const fmtDate = (d: Date) => d.toISOString().split('T')[0]
    getHistoricalPrices(symbol, fmtDate(from), fmtDate(today))
      .then(raw => {
        if (cancelled) return
        const pts = parseHistoricalPrices(raw, price)
        if (pts.length > 1) setRealPoints(pts)
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setHistLoading(false) })
    return () => { cancelled = true }
  }, [symbol, period]) // eslint-disable-line react-hooks/exhaustive-deps

  const fallback = (period === '1D' && open > 0 && high > 0 && low > 0)
    ? generateDayChart(symbol, open, high, low, price, dims.w, dims.h)
    : generateIntradayChart(symbol + period, price, isUp, dims.w, dims.h)
  const realPaths = realPoints ? buildChartPaths(realPoints, dims.w, dims.h) : null
  const line = realPaths?.line ?? fallback.line
  const area = realPaths?.area ?? fallback.area
  const points = realPoints ?? fallback.points

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
        {histLoading && (
          <div style={{ position: 'absolute', top: 10, right: 16, zIndex: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, border: `2px solid ${color}40`, borderTopColor: color, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>Loading…</span>
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
          {PERIOD_LABELS[period].map((t) => (
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
  const [searchParams] = useSearchParams()
  const { marketData, positions, orderLoading, orderResult, placeOrder, clearOrderResult, loadMarketData } = usePortfolioStore()
  const { pacAccountId } = useAuthStore()
  const kycStatus = useAuthStore((s) => s.kycStatus)

  const initialSide: Side = searchParams.get('side')?.toUpperCase() === 'SELL' ? 'SELL' : 'BUY'
  const [side, setSide] = useState<Side>(initialSide)
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
  const [, setValidationError] = useState<string | null>(null)
  const [receipt, setReceipt] = useState<ReceiptData | null>(null)
  const pendingReceiptRef = useRef<Omit<ReceiptData, 'orderId'> | null>(null)
  const pacAccount = usePortfolioStore((s) => s.account)
  const authWalletBalance = useAuthStore((s) => s.walletBalance)
  const walletBalance = pacAccount?.balance ?? authWalletBalance

  const userEmail = useAuthStore((s) => s.user?.email ?? '')

  useEffect(() => { if (marketData.length === 0) loadMarketData() }, [])
  useEffect(() => {
    if (orderResult?.success && pendingReceiptRef.current) {
      setReceipt({
        ...pendingReceiptRef.current,
        orderId: orderResult.orderId,
      })
      pendingReceiptRef.current = null
      clearOrderResult()
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
  const maxSellQty = holding?.quantity ?? 0
  const estimatedTotal = effectivePrice * qty
  const orderTotal = validation?.totalValue ?? estimatedTotal
  const sellQtyInvalid = side === 'SELL' && qty > maxSellQty
  const sellNoHolding  = side === 'SELL' && maxSellQty === 0

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
        <PriceChart symbol={stock.symbol} price={stock.price} open={stock.open} high={stock.high} low={stock.low} isUp={isUp} />
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <label style={labelStyle}>Quantity (Units)</label>
            {side === 'SELL' && maxSellQty > 0 && (
              <button onClick={() => setQuantity(String(maxSellQty))} style={{ fontSize: 11, fontWeight: 700, color: '#f87171', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', padding: '3px 10px', borderRadius: 20, cursor: 'pointer' }}>
                Sell All ({maxSellQty.toLocaleString()})
              </button>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type="number" min="1" max={side === 'SELL' ? maxSellQty : undefined}
              value={quantity}
              onChange={(e) => {
                const v = parseInt(e.target.value) || 0
                if (side === 'SELL' && v > maxSellQty) setQuantity(String(maxSellQty))
                else setQuantity(e.target.value)
              }}
              placeholder="0"
              style={{ width: '100%', padding: '14px 80px 14px 16px', borderRadius: 10, border: `1.5px solid ${sellQtyInvalid ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.1)'}`, background: 'rgba(255,255,255,0.05)', color: '#ffffff', fontSize: 22, fontWeight: 900, letterSpacing: -0.5, boxSizing: 'border-box' }}
            />
            <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', display: 'flex', gap: 4 }}>
              {['+1', '+10'].map((d) => (
                <button key={d} onClick={() => {
                  const next = (parseInt(quantity) || 0) + parseInt(d.replace('+', ''))
                  setQuantity(String(side === 'SELL' ? Math.min(next, maxSellQty) : next))
                }} style={{ padding: '4px 8px', borderRadius: 7, background: 'rgba(5,150,105,0.2)', color: '#34d399', fontSize: 11, fontWeight: 700 }}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          {sellNoHolding && (
            <p style={{ fontSize: 12, color: '#f87171', fontWeight: 600, marginTop: 6 }}>You don't own any {symbol} shares to sell.</p>
          )}
          {!sellNoHolding && sellQtyInvalid && (
            <p style={{ fontSize: 12, color: '#f87171', fontWeight: 600, marginTop: 6 }}>You only own {maxSellQty.toLocaleString()} units.</p>
          )}
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
          disabled={!qty || qty <= 0 || orderLoading || sellQtyInvalid || sellNoHolding}
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

      {/* Order Receipt Screen */}
      {receipt && (
        <div style={{ position: 'fixed', inset: 0, background: '#070e1a', zIndex: 200, display: 'flex', flexDirection: 'column', paddingTop: 'env(safe-area-inset-top,0px)', paddingBottom: 'env(safe-area-inset-bottom,0px)', animation: 'fadeIn 0.25s ease both' }}>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px 24px' }}>

            {/* Animated checkmark */}
            <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'linear-gradient(135deg,#059669,#047857)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24, boxShadow: '0 0 48px rgba(5,150,105,0.45)', animation: 'popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <polyline points="8 21 16 29 32 13" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
                  style={{ strokeDasharray: 40, strokeDashoffset: 40, animation: 'checkDraw 0.4s ease 0.35s forwards' }} />
              </svg>
            </div>

            <h1 style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: -0.8, marginBottom: 8, textAlign: 'center' }}>Order Submitted</h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginBottom: receipt.side === 'SELL' ? 12 : 32, fontWeight: 500, maxWidth: 260, lineHeight: 1.5 }}>
              Your order has been sent to the NGX market
            </p>
            {receipt.side === 'SELL' && (
              <div style={{ marginBottom: 24, padding: '10px 16px', borderRadius: 12, background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', display: 'flex', alignItems: 'flex-start', gap: 8, maxWidth: 320 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500, lineHeight: 1.5 }}>Sale proceeds settle in <strong style={{ color: '#60a5fa' }}>T+3 business days</strong>. Your cash balance will reflect the proceeds after NGX settlement.</span>
              </div>
            )}

            {/* Order card */}
            <div style={{ width: '100%', background: '#0e1c2f', borderRadius: 20, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 12 }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: -0.5, marginBottom: 2 }}>{receipt.symbol}</p>
                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{receipt.name}</p>
                </div>
                <span style={{ padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 800, background: receipt.side === 'BUY' ? 'rgba(5,150,105,0.2)' : 'rgba(220,38,38,0.2)', color: receipt.side === 'BUY' ? '#34d399' : '#f87171', border: `1px solid ${receipt.side === 'BUY' ? 'rgba(5,150,105,0.4)' : 'rgba(220,38,38,0.3)'}` }}>
                  {receipt.side}
                </span>
              </div>
              {([
                ['Quantity', `${receipt.qty.toLocaleString()} units`],
                ['Price per unit', `₦${receipt.price.toFixed(2)}`],
                ['Order type', receipt.orderType],
                receipt.validation ? ['Commission + Fees', fmt(receipt.validation.commission + receipt.validation.fees)] : null,
                ['Total', fmt(receipt.total)],
              ] as ([string, string] | null)[]).filter((x): x is [string, string] => x !== null).map(([label, value], i, arr) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 20px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: label === 'Total' ? (receipt.side === 'BUY' ? '#34d399' : '#f87171') : '#fff' }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Meta card */}
            <div style={{ width: '100%', background: '#0e1c2f', borderRadius: 16, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 8 }}>
              {([
                ['Status', 'Submitted'],
                receipt.orderId ? ['Order ID', receipt.orderId.length > 20 ? receipt.orderId.slice(0, 20) + '…' : receipt.orderId] : null,
                ['Time', receipt.timestamp.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' }) + '  ·  ' + receipt.timestamp.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })],
              ] as ([string, string] | null)[]).filter((x): x is [string, string] => x !== null).map(([label, value], i, arr) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                  <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: label === 'Status' ? '#34d399' : 'rgba(255,255,255,0.65)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom actions */}
          <div style={{ padding: '12px 20px 32px', display: 'flex', gap: 10 }}>
            <button
              onClick={() => { setReceipt(null); setQuantity('') }}
              style={{ flex: 1, padding: '15px', borderRadius: 16, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.7)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}
            >
              New Trade
            </button>
            <button
              onClick={() => { setReceipt(null); navigate('/portfolio') }}
              style={{ flex: 2, padding: '15px', borderRadius: 16, background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff', fontWeight: 900, fontSize: 15, cursor: 'pointer', boxShadow: '0 4px 20px rgba(5,150,105,0.35)', border: 'none' }}
            >
              View Portfolio
            </button>
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
              {[['Security', stock.name], ['Order Type', orderType], ['Quantity', `${qty.toLocaleString()} units`], ['Price', `₦${effectivePrice.toFixed(2)}`], ['Total', fmt(orderTotal)]].map(([label, value], i) => (
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
            {side === 'SELL' && (
              <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, color: '#1e40af', fontWeight: 600, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1e40af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span>Proceeds from this sale are settled in <strong>T+3 business days</strong> per NGX rules. Your cash balance will update once settlement clears.</span>
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
                  pendingReceiptRef.current = {
                    symbol: stock.symbol, name: stock.name, side, qty,
                    price: effectivePrice, orderType, total: orderTotal,
                    validation, timestamp: new Date(),
                  }
                  if (side === 'BUY' && paySource === 'wallet') {
                    await placeOrder({ accountId: pacAccountId, symbol: stock.symbol, side, quantity: qty, orderType, limitPrice: orderType === 'LIMIT' ? effectivePrice : undefined, estimatedTotal })
                    setShowConfirm(false); return
                  }
                  await placeOrder({ accountId: pacAccountId, symbol: stock.symbol, side, quantity: qty, orderType, limitPrice: orderType === 'LIMIT' ? effectivePrice : undefined, estimatedTotal: orderTotal })
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
