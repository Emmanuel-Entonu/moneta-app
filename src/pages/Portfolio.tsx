import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout'
import SoftAurora from '../components/SoftAurora'
import { PortfolioCardSkeleton } from '../components/Skeleton'
import StockLogo from '../components/StockLogo'
import { usePortfolioStore } from '../store/portfolioStore'
import { useAuthStore } from '../store/authStore'
import { supabase } from '../lib/supabase'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { initializePayment, verifyPayment, MONETA_CONFIGURED, type PaymentType } from '../lib/monetaApi'
import { createBrokerAccount } from '../lib/pacApi'

interface OrderRecord {
  id: string
  symbol: string
  side: 'BUY' | 'SELL'
  order_type: string
  quantity: number
  limit_price: number | null
  estimated_total: number | null
  status: string
  pac_order_id: string | null
  created_at: string
}

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
      localStorage.removeItem('moneta_pending_order') // don't carry over a stale trade order
      localStorage.setItem('moneta_pending_ref', reference)
      localStorage.setItem('moneta_pending_amount', String(num))
      if (Capacitor.isNativePlatform()) {
        onClose()
        await Browser.open({ url: authorizationUrl })
      } else {
        window.location.href = authorizationUrl
      }
    } catch (e: unknown) {
      setError((e as Error).message)
      setLoading(false)
    }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '24px 24px 0 0', padding: '20px 20px calc(env(safe-area-inset-bottom,0px) + 28px)', zIndex: 101, maxWidth: 480, margin: '0 auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)', animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e2e8f0', margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Fund Account</h3>
          <button onClick={onClose} style={{ fontSize: 22, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 8 }}>Amount (₦)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '2px solid', borderColor: amount ? 'var(--primary)' : 'var(--border)', borderRadius: 14, padding: '12px 16px', background: '#f8fafc', transition: 'border-color 0.15s' }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-muted)' }}>₦</span>
            <input type="number" min="100" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ flex: 1, fontSize: 20, fontWeight: 800, color: 'var(--text)', background: 'none' }} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {QUICK_AMOUNTS.map((a) => (
            <button key={a} onClick={() => setAmount(String(a))} style={{ padding: '7px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, border: '1.5px solid', cursor: 'pointer', borderColor: amount === String(a) ? 'var(--primary)' : 'var(--border)', background: amount === String(a) ? '#f0fdf4' : '#fff', color: amount === String(a) ? 'var(--primary)' : 'var(--text-muted)', transition: 'all 0.15s' }}>
              ₦{(a / 1000).toFixed(0)}K
            </button>
          ))}
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 10 }}>Payment Method</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {([
              { key: 'card' as PaymentType, label: 'Card', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
              { key: 'bank-transfer' as PaymentType, label: 'Transfer', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> },
              { key: 'ussd' as PaymentType, label: 'USSD', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg> },
            ]).map(({ key, label, icon }) => (
              <button key={key} onClick={() => setMethod(key)} style={{ flex: 1, padding: '10px 8px', borderRadius: 12, border: '2px solid', cursor: 'pointer', textAlign: 'center', borderColor: method === key ? 'var(--primary)' : 'var(--border)', background: method === key ? '#f0fdf4' : '#fff', color: method === key ? 'var(--primary)' : 'var(--text-muted)', transition: 'all 0.15s' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>{icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700 }}>{label}</div>
              </button>
            ))}
          </div>
        </div>
        {error && <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#991b1b', fontWeight: 600, marginBottom: 14 }}>{error}</div>}
        <button onClick={handleFund} disabled={loading || !MONETA_CONFIGURED} style={{ width: '100%', padding: '15px', background: loading || !MONETA_CONFIGURED ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #059669, #047857)', color: loading || !MONETA_CONFIGURED ? 'var(--text-muted)' : '#fff', borderRadius: 'var(--radius)', border: 'none', fontSize: 16, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', boxShadow: loading || !MONETA_CONFIGURED ? 'none' : '0 4px 16px rgba(5,150,105,0.3)', transition: 'all 0.2s' }}>
          {loading ? 'Connecting to Moneta…' : `Fund ₦${num.toLocaleString('en-NG')}`}
        </button>
      </div>
    </>
  )
}

function VerifyPaymentSheet({ onClose, onCredited }: { onClose: () => void; onCredited: (amount: number) => void }) {
  const pendingRef = localStorage.getItem('moneta_pending_ref') ?? ''
  const [ref, setRef]         = useState(pendingRef)
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
        const savedAmount = parseFloat(localStorage.getItem('moneta_pending_amount') ?? '0')
        const amountToCredit = savedAmount > 0 ? savedAmount : res.amountNaira
        if (amountToCredit > 0) {
          await creditWallet(amountToCredit)
          localStorage.removeItem('moneta_pending_ref')
          localStorage.removeItem('moneta_pending_amount')
          onCredited(amountToCredit)
          setResult({ ok: true, msg: `₦${amountToCredit.toLocaleString('en-NG', { minimumFractionDigits: 2 })} credited to your wallet!` })
        } else {
          localStorage.removeItem('moneta_pending_ref')
          localStorage.removeItem('moneta_pending_amount')
          setResult({ ok: false, msg: 'Payment verified but amount could not be determined.' })
        }
      } else {
        // Don't remove ref on failure — user may retry or payment may be delayed
        setResult({ ok: false, msg: res.message || 'Payment not confirmed by Moneta — no charge was made' })
      }
    } catch (e: unknown) {
      // Network error — keep ref so user can retry
      setResult({ ok: false, msg: (e as Error).message })
    } finally {
      setLoading(false)
    }
  }

  // Auto-verify when sheet opens with a pre-filled ref (browser closed / page reload)
  useEffect(() => {
    if (pendingRef) handleVerify()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderRadius: '24px 24px 0 0', padding: '20px 20px calc(env(safe-area-inset-bottom,0px) + 28px)', zIndex: 101, maxWidth: 480, margin: '0 auto', boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e2e8f0', margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>Recover Payment</h3>
          <button onClick={onClose} style={{ fontSize: 22, color: 'var(--text-muted)', lineHeight: 1 }}>×</button>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.5 }}>If your payment went through but your wallet wasn't credited, paste the Moneta reference below.</p>
        <input placeholder="e.g. MON-XXXXXXXX" value={ref} onChange={(e) => setRef(e.target.value)} style={{ width: '100%', padding: '13px 16px', borderRadius: 14, border: '2px solid', borderColor: ref ? 'var(--primary)' : 'var(--border)', fontSize: 15, fontWeight: 600, color: 'var(--text)', background: '#f8fafc', marginBottom: 16, boxSizing: 'border-box' }} />
        {result && <div style={{ background: result.ok ? '#f0fdf4' : '#fee2e2', border: `1px solid ${result.ok ? '#bbf7d0' : '#fca5a5'}`, borderRadius: 10, padding: '10px 14px', fontSize: 13, color: result.ok ? '#065f46' : '#991b1b', fontWeight: 600, marginBottom: 14 }}>{result.msg}</div>}
        <button onClick={result?.ok ? onClose : handleVerify} disabled={loading || (!result?.ok && !ref.trim())} style={{ width: '100%', padding: '15px', background: loading || (!result?.ok && !ref.trim()) ? 'var(--bg-elevated)' : 'linear-gradient(135deg, #059669, #047857)', color: loading || (!result?.ok && !ref.trim()) ? 'var(--text-muted)' : '#fff', borderRadius: 'var(--radius)', border: 'none', fontSize: 16, fontWeight: 700, cursor: loading ? 'wait' : 'pointer', boxShadow: loading || (!result?.ok && !ref.trim()) ? 'none' : '0 4px 16px rgba(5,150,105,0.3)' }}>
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
      <div style={{ height: 8, borderRadius: 8, overflow: 'hidden', display: 'flex', gap: 1, marginBottom: 12 }}>
        {positions.map((p, i) => (
          <div key={p.symbol} style={{ height: '100%', width: `${(p.marketValue / total) * 100}%`, background: ALLOC_COLORS[i % ALLOC_COLORS.length], borderRadius: i === 0 ? '8px 0 0 8px' : i === positions.length - 1 ? '0 8px 8px 0' : 0, minWidth: 4, transition: 'width 0.5s ease' }} />
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px' }}>
        {positions.map((p, i) => (
          <div key={p.symbol} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: ALLOC_COLORS[i % ALLOC_COLORS.length], flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
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
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
      {segments.map((s) => (
        <circle key={s.key} cx={cx} cy={cy} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={s.dashArray} strokeDashoffset={s.dashOffset} strokeLinecap="butt" transform="rotate(-90 50 50)" />
      ))}
      <text x={cx} y={cy - 4} textAnchor="middle" fill="#ffffff" fontSize="9" fontWeight="800">{positions.length}</text>
      <text x={cx} y={cy + 7} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7" fontWeight="600">STOCKS</text>
    </svg>
  )
}

export default function Portfolio() {
  const { positions, account, loadingPortfolio, loadPositions, loadAccount, apiStatus } = usePortfolioStore()
  const { pacAccountId, walletBalance, loadProfile, kycStatus } = useAuthStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'holdings' | 'allocation' | 'orders'>('holdings')
  const [showFund, setShowFund]         = useState(false)
  const [showVerify, setShowVerify]     = useState(false)
  const [creditBanner, setCreditBanner] = useState<number | null>(null)
  const [orders, setOrders]             = useState<OrderRecord[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [brokerLinking, setBrokerLinking] = useState(false)
  const [brokerLinkError, setBrokerLinkError] = useState<string | null>(null)
  const userId = useAuthStore((s) => s.user?.id)
  const userEmail = useAuthStore((s) => s.user?.email ?? '')

  const totalValue = positions.reduce((s, p) => s + p.marketValue, 0)
  const totalPnL = positions.reduce((s, p) => s + p.unrealizedPnL, 0)
  const totalCost = positions.reduce((s, p) => s + p.averageCost * p.quantity, 0)
  const totalPnLPct = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0
  const isUp = totalPnL >= 0

  useEffect(() => {
    loadProfile()
    if (pacAccountId) {
      loadAccount(pacAccountId)
      loadPositions(pacAccountId)
    }
    // Auto-show verify sheet if a payment was pending when app reloads
    if (localStorage.getItem('moneta_pending_ref')) setShowVerify(true)
  }, [pacAccountId])


  useEffect(() => {
    if (tab !== 'orders' || !userId) return
    setOrdersLoading(true)
    supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
      .then(
        ({ data }) => { setOrders((data as OrderRecord[]) ?? []); setOrdersLoading(false) },
        () => setOrdersLoading(false),
      )
  }, [tab, userId])

  async function retryBrokerLink() {
    if (!userId) return
    setBrokerLinking(true); setBrokerLinkError(null)
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, phone, bvn, date_of_birth, address')
        .eq('id', userId)
        .single()
      if (!profile?.full_name || !profile?.bvn) throw new Error('KYC data missing — please complete KYC first')
      const pacId = await createBrokerAccount({
        fullName:  profile.full_name,
        email:     userEmail,
        phone:     profile.phone ?? '',
        bvn:       profile.bvn,
        dob:       profile.date_of_birth ?? '',
        address:   profile.address ?? '',
      })
      await supabase.from('profiles').update({ pac_account_id: pacId }).eq('id', userId)
      await loadProfile()
    } catch (e: unknown) {
      setBrokerLinkError((e as Error).message)
    } finally {
      setBrokerLinking(false)
    }
  }

  const sorted = [...positions].sort((a, b) => b.marketValue - a.marketValue)

  return (
    <Layout noBorder>
      {apiStatus && <div style={{ margin: '8px 16px', background: '#1a0a00', border: '1px solid #f97316', borderRadius: 8, padding: '8px 12px', fontSize: 11, color: '#f97316', wordBreak: 'break-all' }}>{apiStatus}</div>}

      {/* Payment credited banner */}
      {creditBanner !== null && (
        <div style={{ margin: '12px 16px 0', background: 'linear-gradient(135deg, #059669, #047857)', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0 4px 16px rgba(5,150,105,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            <div>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: 14, margin: 0 }}>Payment received!</p>
              <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, margin: 0 }}>₦{creditBanner.toLocaleString('en-NG', { minimumFractionDigits: 2 })} added to your wallet</p>
            </div>
          </div>
          <button onClick={() => setCreditBanner(null)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: 4 }}>×</button>
        </div>
      )}

      {/* KYC prompt banner */}
      {kycStatus !== 'verified' && (
        <div style={{ margin: '12px 16px 0', background: 'linear-gradient(135deg, #7c2d12, #b45309)', borderRadius: 16, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 16px rgba(180,83,9,0.25)' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ color: '#fff', fontWeight: 800, fontSize: 13, margin: 0 }}>KYC Verification Required</p>
            <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: 11, margin: 0, lineHeight: 1.4 }}>Complete your identity check to trade stocks on the NGX</p>
          </div>
          <button onClick={() => navigate('/kyc')} style={{ padding: '8px 14px', background: '#fff', borderRadius: 20, color: '#b45309', fontWeight: 800, fontSize: 12, border: 'none', cursor: 'pointer', flexShrink: 0 }}>Verify Now</button>
        </div>
      )}

      {/* Broker account not linked — retry using saved KYC data */}
      {kycStatus === 'verified' && !pacAccountId && (
        <div style={{ margin: '12px 16px 0', background: 'linear-gradient(135deg, #1e3a5f, #1d4ed8)', borderRadius: 16, padding: '14px 16px', boxShadow: '0 4px 16px rgba(29,78,216,0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: brokerLinkError ? 10 : 0 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: '#fff', fontWeight: 800, fontSize: 13, margin: 0 }}>Broker Account Not Linked</p>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, margin: 0, lineHeight: 1.4 }}>Your KYC is verified — tap to activate your trading account</p>
            </div>
            <button onClick={retryBrokerLink} disabled={brokerLinking} style={{ padding: '8px 14px', background: '#fff', borderRadius: 20, color: '#1d4ed8', fontWeight: 800, fontSize: 12, border: 'none', cursor: brokerLinking ? 'wait' : 'pointer', flexShrink: 0, opacity: brokerLinking ? 0.7 : 1 }}>
              {brokerLinking ? 'Linking…' : 'Link Now'}
            </button>
          </div>
          {brokerLinkError && (
            <p style={{ color: '#fca5a5', fontSize: 11, fontWeight: 600, margin: 0, paddingLeft: 52 }}>{brokerLinkError}</p>
          )}
        </div>
      )}

      {/* ── Hero with Aurora + centered title ── */}
      <div style={{
        background: 'linear-gradient(160deg, #050e1a 0%, #0c1f2e 50%, #053d2a 85%, #065f3e 100%)',
        padding: 'calc(env(safe-area-inset-top, 0px) + 18px) 20px 24px',
        position: 'relative', overflow: 'hidden',
      }}>

        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)', backgroundSize: '28px 28px', pointerEvents: 'none', zIndex: 1 }} />
        <p style={{
          textAlign: 'center', position: 'relative', zIndex: 2,
          fontSize: 27, fontWeight: 900, letterSpacing: -0.7, lineHeight: 1,
          background: 'linear-gradient(95deg, #34d399 0%, #059669 55%, #6ee7b7 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        }}>Portfolio</p>
      </div>

      {/* Wallet card — Premium Wallet */}
      <div style={{ margin: '16px 16px 0', position: 'relative', paddingBottom: 14 }}>

        {/* Wallet thickness — stacked pages */}
        <div style={{ position: 'absolute', top: 10, left: 4, right: -7, bottom: 0, borderRadius: 26, background: '#020a06', zIndex: 0 }} />
        <div style={{ position: 'absolute', top: 5, left: 2, right: -4, bottom: 0, borderRadius: 26, background: '#03100a', zIndex: 0 }} />
        <div style={{ position: 'absolute', top: 2, left: 1, right: -2, bottom: 0, borderRadius: 26, background: '#04150c', zIndex: 0 }} />

        {/* Cards peeking from left */}
        <div style={{ position: 'absolute', left: -8, top: '36%', width: 16, height: 52, background: 'linear-gradient(160deg, #1e3a8a, #2563eb)', borderRadius: '7px 0 0 7px', zIndex: 0, boxShadow: '-3px 2px 10px rgba(0,0,0,0.6)' }} />
        <div style={{ position: 'absolute', left: -5, top: '43%', width: 16, height: 44, background: 'linear-gradient(160deg, #7f1d1d, #b91c1c)', borderRadius: '7px 0 0 7px', zIndex: 0 }} />
        <div style={{ position: 'absolute', left: -2, top: '49%', width: 16, height: 36, background: 'linear-gradient(160deg, #292524, #57534e)', borderRadius: '7px 0 0 7px', zIndex: 0 }} />

        {/* Main wallet body */}
        <div style={{
          background: 'linear-gradient(160deg, #071220 0%, #0b1d35 40%, #042e1e 75%, #065036 100%)',
          borderRadius: 26, position: 'relative', overflow: 'hidden', zIndex: 1,
          boxShadow: '0 24px 64px rgba(2,30,20,0.80), 0 8px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(255,255,255,0.07)',
        }}>
          {/* Leather grain */}
          <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.018) 1px, transparent 1px)', backgroundSize: '9px 9px', zIndex: 0 }} />
          {/* SoftAurora */}
          <div style={{ position: 'absolute', inset: 0, opacity: 0.28, pointerEvents: 'none', zIndex: 1 }}>
            <SoftAurora color1="#059669" color2="#34d399" speed={0.2} brightness={0.85} enableMouseInteraction={false} bandHeight={0.6} noiseAmplitude={0.6} />
          </div>
          {/* Body stitching */}
          <div style={{ position: 'absolute', inset: 8, borderRadius: 19, border: '1.5px dashed rgba(255,255,255,0.065)', pointerEvents: 'none', zIndex: 2 }} />
          {/* Card slot crease line */}
          <div style={{ position: 'absolute', top: 122, left: 0, right: 0, height: 1, background: 'rgba(0,0,0,0.3)', zIndex: 2 }} />
          <div style={{ position: 'absolute', top: 123, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.035)', zIndex: 2 }} />

          {/* Space for flap */}
          <div style={{ height: 138 }} />

          {/* Content below flap */}
          <div style={{ padding: '12px 24px 22px', position: 'relative', zIndex: 3 }}>
            <div style={{ position: 'absolute', bottom: -40, left: -40, width: 220, height: 220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(5,150,105,0.1) 0%, transparent 65%)', pointerEvents: 'none' }} />

            {/* Card number row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <p style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.22)', letterSpacing: 5, fontFamily: 'monospace' }}>
                •••• •••• •••• {account?.accountNumber?.slice(-4) ?? '——'}
              </p>
              {/* Network circles in body */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(210,40,40,0.5)', border: '1px solid rgba(255,255,255,0.08)' }} />
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(210,130,20,0.5)', border: '1px solid rgba(255,255,255,0.08)', marginLeft: -8 }} />
              </div>
            </div>

            <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 4 }}>Total Portfolio Value</p>
            <p style={{ fontSize: 34, fontWeight: 900, color: '#fff', letterSpacing: -1.5, lineHeight: 1, marginBottom: 10 }}>{fmt(totalValue)}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.14)', color: '#fff', padding: '5px 12px', borderRadius: 20, backdropFilter: 'blur(4px)' }}>
                <svg width="8" height="8" viewBox="0 0 8 8" fill="#fff" style={{ marginRight: 4, verticalAlign: 'middle' }}>{isUp ? <polygon points="4,0 8,8 0,8" /> : <polygon points="0,0 8,0 4,8" />}</svg>
                {fmt(Math.abs(totalPnL))} ({isUp ? '+' : ''}{totalPnLPct.toFixed(2)}%)
              </span>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>Unrealized P&L</span>
            </div>
            <button onClick={() => setShowFund(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px', borderRadius: 20, marginBottom: 14, background: 'rgba(255,255,255,0.13)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(4px)', transition: 'background 0.15s' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              Fund Account
            </button>
            <button onClick={() => setShowVerify(true)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.45)', fontSize: 11, fontWeight: 600, marginBottom: 16, padding: 0, textDecoration: 'underline', textUnderlineOffset: 3 }}>
              Payment debited but wallet not updated?
            </button>
            <div style={{ display: 'flex', gap: 0, borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 14 }}>
              {[
                { label: 'Cash Balance', val: fmt(walletBalance) },
                { label: 'Holdings', val: String(positions.length) },
                { label: 'Account', val: account?.accountNumber ?? '—' },
              ].map(({ label, val }, i) => (
                <div key={label} style={{ flex: 1, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.1)' : 'none', paddingLeft: i > 0 ? 14 : 0, paddingRight: 14 }}>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', marginBottom: 3, fontWeight: 600 }}>{label}</p>
                  <p style={{ fontSize: 13, fontWeight: 800, color: '#fff', letterSpacing: -0.2 }}>{val}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Flap with drop-shadow */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 158, zIndex: 2, filter: 'drop-shadow(0 14px 30px rgba(0,0,0,0.8))', pointerEvents: 'none' }}>
          <div style={{ position: 'absolute', inset: 0, borderRadius: '26px 26px 0 0', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(160deg, #1c1410 0%, #2d1f14 45%, #3d2b1f 100%)',
              clipPath: 'polygon(0 0, 100% 0, 100% 55%, 93% 65%, 84% 74%, 73% 81%, 61% 87%, 55% 89%, 50% 90%, 45% 89%, 39% 87%, 27% 81%, 16% 74%, 7% 65%, 0 55%)',
            }}>
              {/* Leather grain */}
              <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.025) 1px, transparent 1px)', backgroundSize: '9px 9px', pointerEvents: 'none' }} />
              {/* Subtle security strip (1px, barely visible) */}
              <div style={{ position: 'absolute', top: 58, left: 24, right: 24, height: 1.5, background: 'linear-gradient(90deg, transparent, rgba(255,160,50,0.18), rgba(80,200,255,0.18), rgba(180,80,255,0.15), transparent)', borderRadius: 1, pointerEvents: 'none' }} />
              {/* Inner shadow at arch edge */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.55))', pointerEvents: 'none' }} />
              {/* Flap stitching */}
              <div style={{ position: 'absolute', top: 8, left: 8, right: 8, bottom: 10, clipPath: 'polygon(0 0, 100% 0, 100% 52%, 93% 62%, 84% 71%, 73% 78%, 61% 84%, 50% 87%, 39% 84%, 27% 78%, 16% 71%, 7% 62%, 0 52%)', border: '1.5px dashed rgba(255,255,255,0.1)', borderBottom: 'none', borderRadius: '19px 19px 0 0' }} />
              {/* Corner rivets */}
              <div style={{ position: 'absolute', top: 14, left: 14, width: 7, height: 7, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.4), rgba(255,255,255,0.1))', border: '1px solid rgba(255,255,255,0.15)' }} />
              <div style={{ position: 'absolute', top: 14, right: 14, width: 7, height: 7, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.4), rgba(255,255,255,0.1))', border: '1px solid rgba(255,255,255,0.15)' }} />

              {/* Row 1: MONETA (left) | NFC + Gold Chip (right) */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 22px 0', position: 'relative', zIndex: 1 }}>
                <div>
                  <p style={{ fontSize: 11, fontWeight: 900, color: 'rgba(255,255,255,0.5)', letterSpacing: 3, textTransform: 'uppercase', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>MONETA</p>
                  <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 600, letterSpacing: 1, marginTop: 2 }}>PORTFOLIO WALLET</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* NFC icon */}
                  <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
                    <circle cx="2.5" cy="10" r="2" fill="rgba(255,255,255,0.35)" />
                    <path d="M7 4.5 Q13 7 13 10 Q13 13 7 15.5" stroke="rgba(255,255,255,0.32)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                    <path d="M11 1.5 Q16 5 16 10 Q16 15 11 18.5" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                  </svg>
                  {/* Gold chip */}
                  <div style={{ width: 36, height: 28, borderRadius: 5, background: 'linear-gradient(135deg, #b8912a 0%, #e8c96a 30%, #c8a84b 55%, #f0d060 80%, #d4a843 100%)', border: '1px solid rgba(255,220,80,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 10px rgba(180,140,20,0.45)' }}>
                    <div style={{ width: 22, height: 16, borderRadius: 3, border: '1px solid rgba(100,70,5,0.5)', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 1, padding: 2 }}>
                      {Array.from({ length: 6 }).map((_, i) => <div key={i} style={{ background: 'linear-gradient(135deg, rgba(160,110,10,0.8), rgba(210,160,40,0.5))', borderRadius: 1 }} />)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Magnetic clasp */}
        <div style={{
          position: 'absolute', top: 140, left: '50%', transform: 'translateX(-50%)',
          width: 22, height: 22, borderRadius: '50%', zIndex: 5,
          background: 'linear-gradient(135deg, #4ade80, #059669)',
          boxShadow: '0 0 0 4px rgba(52,211,153,0.15), 0 0 20px rgba(52,211,153,0.65)',
          border: '2px solid rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.6)', boxShadow: '0 0 5px rgba(255,255,255,0.5)' }} />
        </div>

      </div>

      {/* ── Dark body ── */}
      <div style={{ background: '#070e1a', marginTop: 20, borderRadius: '24px 24px 0 0', paddingTop: 20, paddingBottom: 100 }}>

        {/* Allocation preview */}
        {positions.length > 0 && (
          <div style={{ margin: '16px 12px 0', background: '#0e1c2f', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <MiniDonut positions={sorted} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#ffffff', marginBottom: 10, letterSpacing: -0.1 }}>Allocation</p>
                <AllocationBar positions={sorted} />
              </div>
            </div>
          </div>
        )}

        {/* Tab row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 16px 10px' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['holdings', 'allocation', 'orders'] as const).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', background: tab === t ? 'linear-gradient(135deg,#059669,#047857)' : 'rgba(255,255,255,0.06)', color: tab === t ? '#fff' : 'rgba(255,255,255,0.4)', border: '1px solid', borderColor: tab === t ? 'transparent' : 'rgba(255,255,255,0.09)', boxShadow: tab === t ? '0 2px 10px rgba(5,150,105,0.22)' : 'none', textTransform: 'capitalize' }}>
                {t}
              </button>
            ))}
          </div>
          <button onClick={() => navigate('/market')} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#34d399', background: 'rgba(5,150,105,0.15)', padding: '7px 14px', borderRadius: 20, border: '1px solid rgba(5,150,105,0.3)' }}>
            + Add
          </button>
        </div>

        {/* Loading */}
        {loadingPortfolio && (
          <div style={{ padding: '0 12px' }}>
            {Array.from({ length: 3 }).map((_, i) => <PortfolioCardSkeleton key={i} />)}
          </div>
        )}

        {/* Empty */}
        {!loadingPortfolio && positions.length === 0 && (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <div style={{ width: 80, height: 80, borderRadius: 28, background: 'rgba(5,150,105,0.12)', border: '1px solid rgba(5,150,105,0.25)', margin: '0 auto 18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            </div>
            <p style={{ fontWeight: 800, fontSize: 17, color: '#ffffff', marginBottom: 6 }}>No holdings yet</p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 24, lineHeight: 1.5 }}>Start growing your wealth by investing in NGX equities</p>
            <button onClick={() => navigate('/market')} style={{ padding: '13px 32px', background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff', borderRadius: 16, fontWeight: 800, fontSize: 15, boxShadow: '0 4px 20px rgba(5,150,105,0.32)' }}>
              Browse Market
            </button>
          </div>
        )}

        {/* Holdings */}
        {!loadingPortfolio && positions.length > 0 && tab === 'holdings' && (
          <div style={{ padding: '0 12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }} className="animate-in">
            {sorted.map((pos, idx) => {
              const posUp = pos.unrealizedPnL >= 0
              const dotColor = ALLOC_COLORS[idx % ALLOC_COLORS.length]
              const pct = (pos.marketValue / totalValue) * 100
              return (
                <button key={pos.symbol} onClick={() => navigate(`/trade/${pos.symbol}`)} style={{ background: '#0e1c2f', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '16px 18px', cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color 0.15s' }}
                  onPointerEnter={(e) => { e.currentTarget.style.borderColor = dotColor + '60' }}
                  onPointerLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <StockLogo symbol={pos.symbol} size={44} radius={14} />
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                          <p style={{ fontWeight: 800, fontSize: 15, color: '#ffffff', letterSpacing: -0.2 }}>{pos.symbol}</p>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>{pct.toFixed(0)}% of portfolio</span>
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>{pos.quantity.toLocaleString()} units · avg ₦{pos.averageCost.toFixed(2)}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <p style={{ fontWeight: 900, fontSize: 16, color: '#ffffff', letterSpacing: -0.3 }}>{fmt(pos.marketValue)}</p>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 700, marginTop: 4, color: posUp ? '#34d399' : '#f87171', background: posUp ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', padding: '2px 8px', borderRadius: 20 }}>
                        <svg width="7" height="7" viewBox="0 0 8 8" fill={posUp ? '#34d399' : '#f87171'} style={{ marginRight: 2, verticalAlign: 'middle' }}>{posUp ? <polygon points="4,0 8,8 0,8" /> : <polygon points="0,0 8,0 4,8" />}</svg>
                        {Math.abs(pos.unrealizedPnLPercent).toFixed(2)}%
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 3, marginBottom: 10, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 3, background: `linear-gradient(90deg,${dotColor},${dotColor}aa)`, transition: 'width 0.5s ease' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '10px 0' }}>
                    {[
                      { label: 'Avg Cost', value: `₦${pos.averageCost.toFixed(2)}`, color: '#ffffff' },
                      { label: 'Current',  value: `₦${pos.currentPrice.toFixed(2)}`, color: '#ffffff' },
                      { label: 'P & L',    value: (posUp ? '+' : '') + fmt(pos.unrealizedPnL), color: posUp ? '#34d399' : '#f87171' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 600, marginBottom: 3, textTransform: 'uppercase', letterSpacing: 0.3 }}>{label}</p>
                        <p style={{ fontSize: 12, fontWeight: 800, color }}>{value}</p>
                      </div>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {/* Allocation tab */}
        {!loadingPortfolio && positions.length > 0 && tab === 'allocation' && (
          <div style={{ padding: '0 12px 16px' }} className="animate-in">
            {sorted.map((pos, idx) => {
              const pct = (pos.marketValue / totalValue) * 100
              const color = ALLOC_COLORS[idx % ALLOC_COLORS.length]
              return (
                <div key={pos.symbol} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 4px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <StockLogo symbol={pos.symbol} size={36} radius={11} />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>{pos.symbol}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#ffffff' }}>{pct.toFixed(1)}%</span>
                    </div>
                    <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 5, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg,${color},${color}cc)`, borderRadius: 5, transition: 'width 0.6s ease' }} />
                    </div>
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', minWidth: 72, textAlign: 'right' }}>{fmt(pos.marketValue)}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Orders tab */}
        {tab === 'orders' && (
          <div style={{ padding: '0 12px 16px' }} className="animate-in">
            {ordersLoading && <div style={{ padding: '40px 0', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading orders…</div>}
            {!ordersLoading && orders.length === 0 && (
              <div style={{ padding: '48px 20px', textAlign: 'center' }}>
                <div style={{ width: 72, height: 72, borderRadius: 24, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', margin: '0 auto 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                </div>
                <p style={{ fontWeight: 800, fontSize: 15, color: '#ffffff', marginBottom: 6 }}>No orders yet</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, lineHeight: 1.5 }}>Your placed buy and sell orders will appear here</p>
              </div>
            )}
            {!ordersLoading && orders.map((o) => {
              const isBuy = o.side === 'BUY'
              const isPlaced = o.status === 'placed'
              const date = new Date(o.created_at)
              const dateStr = date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
              const timeStr = date.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })
              return (
                <button key={o.id} onClick={() => navigate(`/trade/${o.symbol}`)} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: '#0e1c2f', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 16, padding: '14px 16px', marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: isBuy ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 8 8" fill={isBuy ? '#34d399' : '#f87171'}>{isBuy ? <polygon points="4,0 8,8 0,8" /> : <polygon points="0,0 8,0 4,8" />}</svg>
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                          <p style={{ fontWeight: 800, fontSize: 14, color: '#ffffff' }}>{o.symbol}</p>
                          <span style={{ fontSize: 10, fontWeight: 700, color: isBuy ? '#34d399' : '#f87171', background: isBuy ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', padding: '2px 7px', borderRadius: 20 }}>{o.side}</span>
                        </div>
                        <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', fontWeight: 500 }}>{o.quantity.toLocaleString()} units · {o.order_type}{o.limit_price ? ` @ ₦${o.limit_price.toFixed(2)}` : ''}</p>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      {o.estimated_total != null && <p style={{ fontWeight: 800, fontSize: 14, color: '#ffffff', letterSpacing: -0.3 }}>{fmt(o.estimated_total)}</p>}
                      <span style={{ fontSize: 10, fontWeight: 700, color: isPlaced ? '#34d399' : '#f87171', background: isPlaced ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', padding: '2px 7px', borderRadius: 20, marginTop: 4, display: 'inline-block' }}>
                        {isPlaced ? '✓ Placed' : 'Failed'}
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontWeight: 500, marginTop: 10 }}>{dateStr} · {timeStr}{o.pac_order_id ? ` · ID: ${o.pac_order_id}` : ''}</p>
                </button>
              )
            })}
          </div>
        )}

        <p style={{ padding: '8px 20px 28px', fontSize: 10, color: 'rgba(255,255,255,0.2)', textAlign: 'center', lineHeight: 1.6 }}>
          Prices are delayed · Capital at risk · Not investment advice
        </p>
      </div>

      {showFund && <FundWalletSheet onClose={() => setShowFund(false)} />}
      {showVerify && <VerifyPaymentSheet onClose={() => setShowVerify(false)} onCredited={(amount) => { setShowVerify(false); setCreditBanner(amount) }} />}
    </Layout>
  )
}
