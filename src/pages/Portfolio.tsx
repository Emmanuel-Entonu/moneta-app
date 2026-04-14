import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import { PortfolioCardSkeleton } from '../components/Skeleton'
import { usePortfolioStore } from '../store/portfolioStore'
import { useAuthStore } from '../store/authStore'
import { initializePayment, verifyPayment, MONETA_CONFIGURED, type PaymentType } from '../lib/monetaApi'

const QUICK_AMOUNTS = [5000, 10000, 25000, 50000, 100000]

function FundWalletSheet({ onClose }: { onClose: () => void }) {
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<PaymentType>('card')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const userEmail = useAuthStore((s) => s.user?.email ?? '')

  const num = parseFloat(amount) || 0

  async function handleFund() {
    if (num < 100) { setError('Minimum deposit is ₦100'); return }
    setLoading(true); setError(null)
    try {
      const { reference, authorizationUrl } = await initializePayment(userEmail, num, method)
      // Save reference so the app can verify payment when the user returns from the system browser
      localStorage.setItem('moneta_pending_ref', reference)
      window.location.href = authorizationUrl
    } catch (e: unknown) {
      setError((e as Error).message)
      setLoading(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 100, backdropFilter: 'blur(4px)',
        }}
      />
      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '24px 24px 0 0',
        padding: '20px 20px calc(env(safe-area-inset-bottom,0px) + 28px)',
        zIndex: 101, maxWidth: 480, margin: '0 auto',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
        animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e2e8f0', margin: '0 auto 20px' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Fund Account</h3>
          <button onClick={onClose} style={{ fontSize: 22, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>

        {/* Amount input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>
            Amount (₦)
          </label>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            border: '2px solid', borderColor: amount ? 'var(--primary)' : 'var(--border)',
            borderRadius: 14, padding: '12px 16px', background: '#f8fafc',
            transition: 'border-color 0.15s',
          }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-muted)' }}>₦</span>
            <input
              type="number" min="100" placeholder="0.00"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              style={{ flex: 1, fontSize: 20, fontWeight: 800, color: 'var(--text)', background: 'none' }}
            />
          </div>
        </div>

        {/* Quick amounts */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {QUICK_AMOUNTS.map((a) => (
            <button
              key={a}
              onClick={() => setAmount(String(a))}
              style={{
                padding: '7px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                border: '1.5px solid', cursor: 'pointer',
                borderColor: amount === String(a) ? 'var(--primary)' : 'var(--border)',
                background: amount === String(a) ? '#f0fdf4' : '#fff',
                color: amount === String(a) ? 'var(--primary)' : 'var(--text-muted)',
                transition: 'all 0.15s',
              }}
            >
              ₦{(a / 1000).toFixed(0)}K
            </button>
          ))}
        </div>

        {/* Payment method */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>
            Payment Method
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { key: 'card' as PaymentType, label: 'Card', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
                </svg>
              )},
              { key: 'bank-transfer' as PaymentType, label: 'Transfer', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                </svg>
              )},
              { key: 'ussd' as PaymentType, label: 'USSD', icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
                </svg>
              )},
            ]).map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setMethod(key)}
                style={{
                  flex: 1, padding: '10px 8px', borderRadius: 12,
                  border: '2px solid', cursor: 'pointer', textAlign: 'center',
                  borderColor: method === key ? 'var(--primary)' : 'var(--border)',
                  background: method === key ? '#f0fdf4' : '#fff',
                  color: method === key ? 'var(--primary)' : 'var(--text-muted)',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{label}</div>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            background: '#fee2e2', border: '1px solid #fca5a5',
            borderRadius: 10, padding: '10px 14px',
            fontSize: 12, color: '#991b1b', fontWeight: 600, marginBottom: 14,
          }}>
            {error}
          </div>
        )}

        <button
          onClick={handleFund}
          disabled={loading || !MONETA_CONFIGURED}
          style={{
            width: '100%', padding: '15px',
            background: loading || !MONETA_CONFIGURED
              ? 'var(--bg-elevated)'
              : 'linear-gradient(135deg, #059669, #047857)',
            color: loading || !MONETA_CONFIGURED ? 'var(--text-muted)' : '#fff',
            borderRadius: 'var(--radius)', border: 'none',
            fontSize: 16, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
            boxShadow: loading || !MONETA_CONFIGURED ? 'none' : '0 4px 16px rgba(5,150,105,0.3)',
            transition: 'all 0.2s',
          }}
        >
          {loading ? 'Connecting to Moneta…' : `Fund ₦${num.toLocaleString('en-NG')}`}
        </button>
      </div>
    </>
  )
}

function VerifyPaymentSheet({ onClose }: { onClose: () => void }) {
  const [ref, setRef]         = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<{ ok: boolean; msg: string } | null>(null)
  const creditWallet = useAuthStore((s) => s.creditWallet)

  async function handleVerify() {
    const r = ref.trim()
    if (!r) return
    setLoading(true); setResult(null)
    try {
      const res = await verifyPayment(r)
      if (res.success) {
        await creditWallet(res.amountNaira)
        localStorage.removeItem('moneta_pending_ref')
        setResult({ ok: true, msg: `₦${res.amountNaira.toLocaleString('en-NG', { minimumFractionDigits: 2 })} credited to your wallet!` })
      } else {
        setResult({ ok: false, msg: res.message || 'Payment not confirmed by Moneta' })
      }
    } catch (e: unknown) {
      setResult({ ok: false, msg: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, backdropFilter: 'blur(4px)' }} />
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: '#fff', borderRadius: '24px 24px 0 0',
        padding: '20px 20px calc(env(safe-area-inset-bottom,0px) + 28px)',
        zIndex: 101, maxWidth: 480, margin: '0 auto',
        boxShadow: '0 -8px 40px rgba(0,0,0,0.15)',
      }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e2e8f0', margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Recover Payment</h3>
          <button onClick={onClose} style={{ fontSize: 22, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>
          If your payment went through but your wallet wasn't credited, paste the Moneta reference below.
        </p>

        <input
          placeholder="e.g. MON-XXXXXXXX"
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          style={{
            width: '100%', padding: '13px 16px', borderRadius: 14,
            border: '2px solid', borderColor: ref ? 'var(--primary)' : 'var(--border)',
            fontSize: 15, fontWeight: 600, color: 'var(--text)',
            background: '#f8fafc', marginBottom: 16, boxSizing: 'border-box',
          }}
        />

        {result && (
          <div style={{
            background: result.ok ? '#f0fdf4' : '#fee2e2',
            border: `1px solid ${result.ok ? '#bbf7d0' : '#fca5a5'}`,
            borderRadius: 10, padding: '10px 14px',
            fontSize: 13, color: result.ok ? '#065f46' : '#991b1b',
            fontWeight: 600, marginBottom: 14,
          }}>
            {result.msg}
          </div>
        )}

        <button
          onClick={result?.ok ? onClose : handleVerify}
          disabled={loading || (!result?.ok && !ref.trim())}
          style={{
            width: '100%', padding: '15px',
            background: loading || (!result?.ok && !ref.trim())
              ? 'var(--bg-elevated)'
              : result?.ok
                ? 'linear-gradient(135deg, #059669, #047857)'
                : 'linear-gradient(135deg, #059669, #047857)',
            color: loading || (!result?.ok && !ref.trim()) ? 'var(--text-muted)' : '#fff',
            borderRadius: 'var(--radius)', border: 'none',
            fontSize: 16, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
            boxShadow: loading || (!result?.ok && !ref.trim()) ? 'none' : '0 4px 16px rgba(5,150,105,0.3)',
          }}
        >
          {loading ? 'Verifying…' : result?.ok ? 'Done' : 'Verify & Credit Wallet'}
        </button>
      </div>
    </>
  )
}

const ALLOC_COLORS = ['#059669', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#0ea5e9', '#ef4444']

function fmt(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function AllocationBar({ positions }: { positions: { symbol: string; marketValue: number }[] }) {
  const total = positions.reduce((s, p) => s + p.marketValue, 0)
  if (total === 0) return null

  return (
    <div>
      {/* Stacked bar */}
      <div style={{
        height: 8, borderRadius: 8, overflow: 'hidden',
        display: 'flex', gap: 1, marginBottom: 12,
      }}>
        {positions.map((p, i) => (
          <div
            key={p.symbol}
            title={`${p.symbol}: ${((p.marketValue / total) * 100).toFixed(1)}%`}
            style={{
              height: '100%',
              width: `${(p.marketValue / total) * 100}%`,
              background: ALLOC_COLORS[i % ALLOC_COLORS.length],
              borderRadius: i === 0 ? '8px 0 0 8px' : i === positions.length - 1 ? '0 8px 8px 0' : 0,
              minWidth: 4,
              transition: 'width 0.5s ease',
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
        {positions.map((p, i) => (
          <div key={p.symbol} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: ALLOC_COLORS[i % ALLOC_COLORS.length], flexShrink: 0,
            }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>
              {p.symbol} {((p.marketValue / total) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function MiniDonut({ positions }: { positions: { symbol: string; marketValue: number }[] }) {
  const total = positions.reduce((s, p) => s + p.marketValue, 0)
  if (total === 0) return null

  const cx = 50, cy = 50, r = 36, stroke = 14
  const circumference = 2 * Math.PI * r

  let offset = 0
  const segments = positions.map((p, i) => {
    const pct = p.marketValue / total
    const dashArray = `${pct * circumference} ${circumference}`
    const dashOffset = -offset * circumference
    offset += pct
    return { key: p.symbol, dashArray, dashOffset, color: ALLOC_COLORS[i % ALLOC_COLORS.length] }
  })

  return (
    <svg width={100} height={100} viewBox="0 0 100 100" style={{ flexShrink: 0 }}>
      {/* Background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      {/* Segments */}
      {segments.map((s) => (
        <circle
          key={s.key} cx={cx} cy={cy} r={r}
          fill="none" stroke={s.color} strokeWidth={stroke}
          strokeDasharray={s.dashArray}
          strokeDashoffset={s.dashOffset}
          strokeLinecap="butt"
          transform="rotate(-90 50 50)"
        />
      ))}
      {/* Center text */}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#0f172a" fontSize="9" fontWeight="800">
        {positions.length}
      </text>
      <text x={cx} y={cy + 7} textAnchor="middle" fill="#94a3b8" fontSize="7" fontWeight="600">
        STOCKS
      </text>
    </svg>
  )
}

export default function Portfolio() {
  const { positions, account, loadingPortfolio, loadPositions, loadAccount } = usePortfolioStore()
  const { pacAccountId, walletBalance, loadProfile } = useAuthStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'holdings' | 'allocation'>('holdings')
  const [showFund, setShowFund]         = useState(false)
  const [showVerify, setShowVerify]     = useState(false)
  const [creditBanner, setCreditBanner] = useState<number | null>(() => {
    const v = localStorage.getItem('moneta_last_credit')
    if (v) { localStorage.removeItem('moneta_last_credit'); return parseFloat(v) }
    return null
  })

  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0)
  const totalPnL = positions.reduce((s, p) => s + p.unrealizedPnL, 0)
  const totalCost = positions.reduce((s, p) => s + p.averageCost * p.quantity, 0)
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0
  const isUp = totalPnL >= 0

  useEffect(() => {
    // Refresh wallet balance from Supabase every time this page is opened
    loadProfile()
    const id = pacAccountId ?? 'demo-account'
    loadAccount(id)
    loadPositions(id)
  }, [pacAccountId])

  // Show success banner when background payment verification credits the wallet
  useEffect(() => {
    function onCredited() {
      const v = localStorage.getItem('moneta_last_credit')
      if (v) { localStorage.removeItem('moneta_last_credit'); setCreditBanner(parseFloat(v)) }
    }
    window.addEventListener('moneta_wallet_credited', onCredited)
    return () => window.removeEventListener('moneta_wallet_credited', onCredited)
  }, [])

  const sorted = [...positions].sort((a, b) => b.marketValue - a.marketValue)

  return (
    <Layout title="Portfolio">
      {/* Payment credited banner */}
      {creditBanner !== null && (
        <div style={{
          margin: '12px 16px 0',
          background: 'linear-gradient(135deg, #059669, #047857)',
          borderRadius: 14, padding: '14px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          boxShadow: '0 4px 16px rgba(5,150,105,0.3)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: 14, margin: 0 }}>Payment received!</p>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, margin: 0 }}>
                ₦{creditBanner.toLocaleString('en-NG', { minimumFractionDigits: 2 })} added to your wallet
              </p>
            </div>
          </div>
          <button onClick={() => setCreditBanner(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: 4 }}>×</button>
        </div>
      )}

      {/* Wallet card */}
      <div style={{ margin: '16px 16px 0', position: 'relative', paddingBottom: 14 }}>
        {/* Cards peeking from behind the wallet */}
        <div style={{
          position: 'absolute', bottom: 6, left: 10, right: 10, height: '92%',
          background: 'linear-gradient(145deg, #047857, #065f46)',
          borderRadius: 22, zIndex: 0,
          boxShadow: '0 4px 16px rgba(2,44,34,0.3)',
        }} />
        <div style={{
          position: 'absolute', bottom: 0, left: 20, right: 20, height: '90%',
          background: 'linear-gradient(145deg, #065f46, #022c22)',
          borderRadius: 20, zIndex: 0,
        }} />

      <div style={{
        background: 'linear-gradient(145deg, #022c22 0%, #064e3b 40%, #059669 100%)',
        borderRadius: 24, padding: '24px 22px 22px',
        position: 'relative', overflow: 'hidden', zIndex: 1,
        boxShadow: '0 8px 32px rgba(2,44,34,0.5), inset 0 0 0 1.5px rgba(255,255,255,0.09)',
      }}>
        {/* Wallet icon top-right */}
        <div style={{
          position: 'absolute', top: 20, right: 20,
          width: 38, height: 38, borderRadius: 12,
          background: 'rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(4px)',
        }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="1" y="6" width="22" height="14" rx="3"/>
            <path d="M16 14a1 1 0 1 0 2 0 1 1 0 0 0-2 0"/>
            <path d="M1 10h22"/>
          </svg>
        </div>
        {/* Decorative shine */}
        <div style={{ position: 'absolute', top: -40, left: -40, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />
        <div style={{ position: 'absolute', bottom: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />

        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6 }}>
          Total Portfolio Value
        </p>
        <p style={{ fontSize: 38, fontWeight: 900, color: '#fff', letterSpacing: -1.5, lineHeight: 1, marginBottom: 10 }}>
          {fmt(totalValue)}
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 12, fontWeight: 700,
            background: 'rgba(255,255,255,0.16)',
            color: '#fff', padding: '5px 12px', borderRadius: 20,
            backdropFilter: 'blur(4px)',
          }}>
            <svg width="8" height="8" viewBox="0 0 8 8" fill="#fff" style={{marginRight:4,verticalAlign:'middle'}}>
              {isUp ? <polygon points="4,0 8,8 0,8" /> : <polygon points="0,0 8,0 4,8" />}
            </svg>{fmt(Math.abs(totalPnL))} ({isUp ? '+' : ''}{totalPnLPct.toFixed(2)}%)
          </span>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Unrealized P&L</span>
        </div>

        {/* Fund button */}
        <button
          onClick={() => setShowFund(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderRadius: 20, marginBottom: 16,
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.25)',
            color: '#fff', fontSize: 13, fontWeight: 700,
            cursor: 'pointer', backdropFilter: 'blur(4px)',
            transition: 'background 0.15s',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Fund Account
        </button>

        {/* Recover a stuck payment */}
        <button
          onClick={() => setShowVerify(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 600,
            marginBottom: 16, padding: 0, textDecoration: 'underline',
            textUnderlineOffset: 3,
          }}
        >
          Payment debited but wallet not updated?
        </button>

        {/* Stats row */}
        <div style={{
          display: 'flex', gap: 0,
          borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: 16,
        }}>
          {[
            { label: 'Cash Balance', val: fmt(walletBalance) },
            { label: 'Holdings', val: String(positions.length) },
            { label: 'Account', val: account?.accountNumber ?? '—' },
          ].map(({ label, val }, i) => (
            <div key={label} style={{
              flex: 1,
              borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.12)' : 'none',
              paddingLeft: i > 0 ? 14 : 0,
              paddingRight: 14,
            }}>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginBottom: 3, fontWeight: 600 }}>{label}</p>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: -0.2 }}>{val}</p>
            </div>
          ))}
        </div>
      </div>
      </div>

      {/* Allocation preview (only when positions exist) */}
      {positions.length > 0 && (
        <div style={{
          margin: '12px 16px 0',
          background: '#fff', border: '1.5px solid var(--border)',
          borderRadius: 18, padding: '16px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <MiniDonut positions={sorted} />
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', marginBottom: 10, letterSpacing: -0.1 }}>
                Allocation
              </p>
              <AllocationBar positions={sorted} />
            </div>
          </div>
        </div>
      )}

      {/* Tab row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '20px 20px 10px',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['holdings', 'allocation'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                cursor: 'pointer', transition: 'all 0.15s',
                background: tab === t ? 'linear-gradient(135deg,#059669,#047857)' : '#f8fafc',
                color: tab === t ? '#fff' : 'var(--text-muted)',
                border: '1.5px solid',
                borderColor: tab === t ? 'transparent' : 'var(--border)',
                boxShadow: tab === t ? '0 2px 10px rgba(5,150,105,0.22)' : 'none',
                textTransform: 'capitalize',
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          onClick={() => navigate('/market')}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 12, fontWeight: 700, color: 'var(--primary)',
            background: '#f0fdf4', padding: '7px 14px', borderRadius: 20,
            border: '1.5px solid #a7f3d0',
          }}
        >
          + Add
        </button>
      </div>

      {/* Loading */}
      {loadingPortfolio && (
        <div style={{ padding: '0 16px' }}>
          {Array.from({ length: 3 }).map((_, i) => <PortfolioCardSkeleton key={i} />)}
        </div>
      )}

      {/* Empty */}
      {!loadingPortfolio && positions.length === 0 && (
        <div style={{ padding: '48px 20px', textAlign: 'center' }}>
          <div style={{
            width: 80, height: 80, borderRadius: 28,
            background: 'linear-gradient(135deg,#f0fdf4,#d1fae5)',
            border: '2px solid #a7f3d0',
            margin: '0 auto 18px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </div>
          <p style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', marginBottom: 6 }}>No holdings yet</p>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>
            Start growing your wealth by investing in NSE equities
          </p>
          <button
            onClick={() => navigate('/market')}
            style={{
              padding: '13px 32px',
              background: 'linear-gradient(135deg,#059669,#047857)',
              color: '#fff', borderRadius: 'var(--radius)',
              fontWeight: 800, fontSize: 15,
              boxShadow: '0 4px 20px rgba(5,150,105,0.32)',
            }}
          >
            Browse Market
          </button>
        </div>
      )}

      {/* Holdings list */}
      {!loadingPortfolio && positions.length > 0 && tab === 'holdings' && (
        <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }} className="animate-in">
          {sorted.map((pos, idx) => {
            const posUp = pos.unrealizedPnL >= 0
            const dotColor = ALLOC_COLORS[idx % ALLOC_COLORS.length]
            const pct = (pos.marketValue / totalValue) * 100

            return (
              <button
                key={pos.symbol}
                onClick={() => navigate(`/trade/${pos.symbol}`)}
                style={{
                  background: '#fff', border: '1.5px solid var(--border)',
                  borderRadius: 18, padding: '16px 18px',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onPointerEnter={(e) => {
                  e.currentTarget.style.borderColor = dotColor
                  e.currentTarget.style.boxShadow = `0 0 0 3px ${dotColor}18`
                }}
                onPointerLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'
                }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: 14,
                      background: dotColor + '15', border: `1.5px solid ${dotColor}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 900, color: dotColor, letterSpacing: -0.5 }}>
                        {pos.symbol.slice(0, 4)}
                      </span>
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                        <p style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', letterSpacing: -0.2 }}>{pos.symbol}</p>
                        <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>{pct.toFixed(0)}% of portfolio</span>
                      </div>
                      <p style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
                        {pos.quantity.toLocaleString()} units · avg ₦{pos.averageCost.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: 900, fontSize: 16, color: 'var(--text)', letterSpacing: -0.3 }}>{fmt(pos.marketValue)}</p>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 3,
                      fontSize: 11, fontWeight: 700, marginTop: 4,
                      color: posUp ? '#065f46' : '#991b1b',
                      background: posUp ? '#d1fae5' : '#fee2e2',
                      padding: '2px 8px', borderRadius: 20,
                    }}>
                      <svg width="7" height="7" viewBox="0 0 8 8" fill={posUp ? '#065f46' : '#991b1b'} style={{marginRight:2,verticalAlign:'middle'}}>
                        {posUp ? <polygon points="4,0 8,8 0,8" /> : <polygon points="0,0 8,0 4,8" />}
                      </svg>{Math.abs(pos.unrealizedPnLPercent).toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Allocation bar for this position */}
                <div style={{ height: 3, background: '#f1f5f9', borderRadius: 3, marginBottom: 10, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${pct}%`, borderRadius: 3,
                    background: `linear-gradient(90deg,${dotColor},${dotColor}aa)`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>

                {/* Stats */}
                <div style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
                  background: '#f8fafc', borderRadius: 10, padding: '10px 0',
                }}>
                  {[
                    { label: 'Avg Cost',  value: `₦${pos.averageCost.toFixed(2)}`,       color: 'var(--text)' },
                    { label: 'Current',   value: `₦${pos.currentPrice.toFixed(2)}`,       color: 'var(--text)' },
                    { label: 'P & L',     value: (posUp ? '+' : '') + fmt(pos.unrealizedPnL), color: posUp ? '#059669' : '#dc2626' },
                  ].map(({ label, value, color }) => (
                    <div key={label} style={{ textAlign: 'center' }}>
                      <p style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</p>
                      <p style={{ fontSize: 12, fontWeight: 800, color }}>{value}</p>
                    </div>
                  ))}
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* Allocation tab view */}
      {!loadingPortfolio && positions.length > 0 && tab === 'allocation' && (
        <div style={{ padding: '0 16px 16px' }} className="animate-in">
          {sorted.map((pos, idx) => {
            const pct = (pos.marketValue / totalValue) * 100
            const color = ALLOC_COLORS[idx % ALLOC_COLORS.length]
            return (
              <div key={pos.symbol} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 0', borderBottom: '1px solid #f1f5f9',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 11,
                  background: color + '15', border: `1.5px solid ${color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 8, fontWeight: 900, color, letterSpacing: -0.5 }}>
                    {pos.symbol.slice(0, 4)}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{pos.symbol}</span>
                    <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text)' }}>{pct.toFixed(1)}%</span>
                  </div>
                  <div style={{ height: 5, background: '#f1f5f9', borderRadius: 5, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${pct}%`,
                      background: `linear-gradient(90deg,${color},${color}cc)`,
                      borderRadius: 5,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', minWidth: 72, textAlign: 'right' }}>
                  {fmt(pos.marketValue)}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <p style={{ padding: '8px 20px 28px', fontSize: 10, color: '#94a3b8', textAlign: 'center', lineHeight: 1.6 }}>
        Prices are delayed · Capital at risk · Not investment advice
      </p>

      {showFund && (
        <FundWalletSheet onClose={() => setShowFund(false)} />
      )}
      {showVerify && (
        <VerifyPaymentSheet onClose={() => setShowVerify(false)} />
      )}
    </Layout>
  )
}
