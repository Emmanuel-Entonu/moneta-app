import { Component, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import Ballpit from '../components/Ballpit'

class BallpitBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false }
  static getDerivedStateFromError() { return { crashed: true } }
  render() { return this.state.crashed ? null : this.props.children }
}

const ADMIN_USER = 'MONETA.ADMIN'
const ADMIN_PASS = 'EMMA123X'
const SESSION_KEY = 'moneta_admin_session'

interface UserRow {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  bvn: string | null
  id_type: string | null
  id_number: string | null
  kyc_status: string | null
  cacs_status: string | null
  cacs_doc_url: string | null
  cacs_rejection_reason: string | null
  pac_account_id: string | null
  created_at: string | null
}

type CacsFilter = 'all' | 'pending' | 'approved' | 'rejected' | 'not_submitted'

const REJECT_REASONS = [
  'Wrong document uploaded',
  'Document not filled properly',
  'BVN not verified',
  'Signature missing',
  'Document is illegible or blurry',
  'Information mismatch with BVN records',
]

// ── Status palette ────────────────────────────────────────────────────────────
// Defined once; never inline per-usage
const STATUS: Record<string, { bg: string; color: string; border: string; dot: string; label: string }> = {
  approved:      { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0', dot: '#16a34a', label: 'Approved' },
  pending:       { bg: '#fffbeb', color: '#92400e', border: '#fde68a', dot: '#d97706', label: 'Pending' },
  rejected:      { bg: '#fef2f2', color: '#991b1b', border: '#fecaca', dot: '#dc2626', label: 'Rejected' },
  not_submitted: { bg: '#f8fafc', color: '#475569', border: '#e2e8f0', dot: '#94a3b8', label: 'Not submitted' },
  verified:      { bg: '#f0fdf4', color: '#166534', border: '#bbf7d0', dot: '#16a34a', label: 'Verified' },
  submitted:     { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe', dot: '#3b82f6', label: 'Submitted' },
  pending_kyc:   { bg: '#fffbeb', color: '#92400e', border: '#fde68a', dot: '#d97706', label: 'Pending KYC' },
}

const AVATAR_COLORS = ['#6366f1','#ec4899','#0ea5e9','#10b981','#f59e0b','#8b5cf6','#06b6d4','#f43f5e']
function avatarBg(name: string | null) {
  if (!name) return AVATAR_COLORS[0]
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length]
}
function truncateId(id: string) {
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id
}
function relativeDate(iso: string | null) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  if (d === 0) return 'Today'
  if (d === 1) return 'Yesterday'
  if (d < 30) return `${d}d ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}
function absDate(iso: string | null) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? 'not_submitted'
  const c = STATUS[s] ?? STATUS['not_submitted']
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      {c.label}
    </span>
  )
}


export default function Admin() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authed, setAuthed] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<CacsFilter>('all')
  const [search, setSearch] = useState('')
  const [acting, setActing] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [kycUser, setKycUser] = useState<UserRow | null>(null)
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string | null } | null>(null)
  const [rejectReason, setRejectReason] = useState<string>('')

  useEffect(() => { if (sessionStorage.getItem(SESSION_KEY) === '1') setAuthed(true) }, [])
  useEffect(() => { if (authed) loadUsers() }, [authed])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  function handleLogin() {
    if (username.trim() === ADMIN_USER && password === ADMIN_PASS) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setAuthed(true)
    } else {
      setAuthError('Invalid credentials.')
    }
  }
  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY)
    setAuthed(false)
    setUsers([])
  }

  async function loadUsers() {
    setLoading(true)
    setLoadError(null)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, phone, bvn, id_type, id_number, kyc_status, cacs_status, cacs_doc_url, cacs_rejection_reason, pac_account_id, created_at')
      .order('created_at', { ascending: false })
    setLoading(false)
    if (error) { setLoadError(error.message); return }
    setUsers((data ?? []).map((p) => ({
      id: p.id, full_name: p.full_name ?? null, email: p.email ?? null,
      phone: p.phone ?? null, bvn: p.bvn ?? null,
      id_type: p.id_type ?? null, id_number: p.id_number ?? null,
      kyc_status: p.kyc_status ?? null, cacs_status: p.cacs_status ?? null,
      cacs_doc_url: p.cacs_doc_url ?? null, cacs_rejection_reason: p.cacs_rejection_reason ?? null,
      pac_account_id: p.pac_account_id ?? null,
      created_at: p.created_at ?? null,
    })))
  }

  async function setStatus(userId: string, status: 'approved' | 'rejected', reason: string | null = null) {
    setActing(userId)
    const update: Record<string, string | null> = { cacs_status: status }
    if (status === 'rejected') update.cacs_rejection_reason = reason
    if (status === 'approved') update.cacs_rejection_reason = null
    const { data, error } = await supabase
      .from('profiles')
      .update(update)
      .eq('id', userId)
      .select('id')
    setActing(null)
    if (error || !data?.length) {
      setToast({ msg: error?.message ?? 'Permission denied — add UPDATE policy for anon in Supabase', ok: false })
    } else {
      setToast({ msg: `Application ${status}`, ok: true })
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, cacs_status: status, cacs_rejection_reason: reason } : u))
    }
  }

  function printReceipt(u: UserRow) {
    const win = window.open('', '_blank', 'width=960,height=750')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>CACS Receipt — ${u.full_name ?? u.email}</title><style>
      *{box-sizing:border-box;margin:0;padding:0;font-family:'Inter',system-ui,sans-serif}
      body{background:#f8fafc;padding:32px}
      .receipt{background:#fff;border-radius:12px;border:1px solid #e2e8f0;overflow:hidden;max-width:820px;margin:0 auto}
      .hdr{background:#111827;padding:22px 28px;display:flex;align-items:center;justify-content:space-between}
      .logo{color:#10b981;font-size:20px;font-weight:900;letter-spacing:-0.5px}
      .badge{background:rgba(16,185,129,.15);border:1px solid rgba(16,185,129,.3);color:#34d399;font-size:10px;font-weight:700;padding:3px 10px;border-radius:4px;letter-spacing:1.5px;text-transform:uppercase}
      .grid{padding:20px 28px;border-bottom:1px solid #f1f5f9;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:14px 20px}
      .f label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.6px;display:block;margin-bottom:4px}
      .f span{font-size:13px;font-weight:600;color:#111827}
      .mono{font-family:monospace}
      .pill{background:#f0fdf4;border:1px solid #bbf7d0;color:#166534;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:600}
      .doc{height:560px}
      iframe{width:100%;height:100%;border:none;display:block}
      .foot{padding:12px 28px;border-top:1px solid #f1f5f9;display:flex;justify-content:space-between}
      .foot p{font-size:11px;color:#94a3b8}
      .actions{text-align:center;margin-top:20px}
      button.print{padding:10px 24px;background:#111827;color:#fff;border:none;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;margin-right:10px}
      button.cls{padding:10px 24px;background:#f1f5f9;color:#374151;border:1px solid #e2e8f0;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer}
      @media print{body{padding:0;background:#fff}.receipt{border-radius:0;border:none}.actions{display:none}}
    </style></head><body>
      <div class="receipt">
        <div class="hdr"><span class="logo">Moneta</span><span class="badge">CACS Receipt</span></div>
        <div class="grid">
          <div class="f"><label>Full Name</label><span>${u.full_name ?? '—'}</span></div>
          <div class="f"><label>Email</label><span>${u.email ?? '—'}</span></div>
          <div class="f"><label>Phone Number</label><span>${u.phone ?? '—'}</span></div>
          <div class="f"><label>BVN</label><span class="mono">${u.bvn ? `${u.bvn.slice(0,3)}****${u.bvn.slice(-2)}` : '—'}</span></div>
          <div class="f"><label>ID Type</label><span>${u.id_type ?? '—'}</span></div>
          <div class="f"><label>ID Number</label><span class="mono">${u.id_number ?? '—'}</span></div>
          <div class="f"><label>PAC Account ID</label><span class="mono">${u.pac_account_id ?? '—'}</span></div>
          <div class="f"><label>CACS Status</label><span class="pill">${u.cacs_status ?? '—'}</span></div>
          <div class="f"><label>Member Since</label><span>${u.created_at ? new Date(u.created_at).toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'}) : '—'}</span></div>
          <div class="f"><label>Receipt Generated</label><span>${new Date().toLocaleDateString('en-NG',{day:'numeric',month:'long',year:'numeric'})}</span></div>
        </div>
        <div class="doc"><iframe src="${u.cacs_doc_url}" title="CACS Document"></iframe></div>
        <div class="foot"><p>Moneta Securities · Internal Use Only · © ${new Date().getFullYear()}</p><p>Generated by Admin Portal</p></div>
      </div>
      <div class="actions">
        <button class="print" onclick="window.print()">Print / Save as PDF</button>
        <button class="cls" onclick="window.close()">Close</button>
      </div>
    </body></html>`)
    win.document.close()
  }

  function copyId(id: string) {
    navigator.clipboard.writeText(id).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  const counts = {
    all:           users.length,
    pending:       users.filter((u) => u.cacs_status === 'pending').length,
    approved:      users.filter((u) => u.cacs_status === 'approved').length,
    rejected:      users.filter((u) => u.cacs_status === 'rejected').length,
    not_submitted: users.filter((u) => !u.cacs_status || u.cacs_status === 'not_submitted').length,
  }

  const filtered = users.filter((u) => {
    const s = u.cacs_status ?? 'not_submitted'
    if (filter !== 'all' && s !== filter) return false
    const q = search.toLowerCase()
    return !q || (u.full_name ?? '').toLowerCase().includes(q) || (u.email ?? '').toLowerCase().includes(q) || (u.pac_account_id ?? '').toLowerCase().includes(q)
  })

  // ── Login ──────────────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', fontFamily: "'Inter', system-ui, sans-serif", zIndex: 9999 }}>

      {/* ── Left panel ── */}
      <div style={{ flex: '0 0 46%', background: '#000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '52px 64px', position: 'relative', overflow: 'hidden' }}>

        {/* Ballpit */}
        <BallpitBoundary>
          <div style={{ position: 'absolute', inset: 0, zIndex: 0, width: '100%', height: '100%' }}>
            <Ballpit
              count={90}
              gravity={0.01}
              friction={0.9975}
              wallBounce={0.95}
              followCursor={false}
              colors={[0x10b981, 0x34d399, 0x059669, 0x6ee7b7, 0x00ff99, 0xffffff]}
            />
          </div>
        </BallpitBoundary>

        {/* Grid overlay */}
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none', zIndex: 1 }} />
        {/* Bottom vignette so text is readable */}
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 45%, rgba(0,0,0,0.2) 100%)', pointerEvents: 'none', zIndex: 1 }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 44, height: 44, borderRadius: 14, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(16,185,129,0.5)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div>
            <p style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: -0.5, lineHeight: 1 }}>Moneta</p>
            <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.4)', fontSize: 9, fontWeight: 800, color: '#34d399', letterSpacing: 2, textTransform: 'uppercase' }}>Admin Portal</span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ fontSize: 54, fontWeight: 900, letterSpacing: -2.5, lineHeight: 1.04, marginBottom: 20 }}>
            <span style={{ color: '#fff' }}>Moneta<br />Management<br /></span>
            <span style={{ background: 'linear-gradient(90deg,#10b981,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Console</span>
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.65)', fontWeight: 500, lineHeight: 1.75, maxWidth: 380 }}>Review CACS submissions, approve NGX/CSCS trading accounts, and manage platform access.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 36 }}>
            {['CACS Form Review & Instant Approval', 'NGX / CSCS Account Lifecycle Management', 'Real-time User Status & KYC Tracking'].map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(16,185,129,0.18)', border: '1px solid rgba(16,185,129,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ position: 'relative', zIndex: 2, fontSize: 11, color: 'rgba(255,255,255,0.2)', fontWeight: 500 }}>© 2025 Moneta Securities · Internal Use Only</p>
      </div>

      {/* ── Right panel ── */}
      <div style={{ flex: 1, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 72px' }}>
        <div style={{ width: '100%', maxWidth: 400 }}>
          <div style={{ marginBottom: 36 }}>
            <h2 style={{ fontSize: 28, fontWeight: 900, color: '#0a0a0a', letterSpacing: -0.8, marginBottom: 6 }}>Sign in</h2>
            <p style={{ fontSize: 14, color: '#6b7280', fontWeight: 500 }}>Authorized personnel only. All access is logged.</p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#111827', marginBottom: 7, letterSpacing: 0.7, textTransform: 'uppercase' }}>Username</label>
              <input value={username} onChange={(e) => { setUsername(e.target.value); setAuthError(null) }} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="MONETA.ADMIN" autoComplete="off"
                style={{ width: '100%', padding: '12px 16px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#0a0a0a', fontSize: 14, fontWeight: 600, boxSizing: 'border-box', outline: 'none', letterSpacing: 0.5 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#111827', marginBottom: 7, letterSpacing: 0.7, textTransform: 'uppercase' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setAuthError(null) }} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="••••••••"
                  style={{ width: '100%', padding: '12px 46px 12px 16px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#0a0a0a', fontSize: 14, fontWeight: 600, boxSizing: 'border-box', outline: 'none' }} />
                <button onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex' }}>
                  {showPass
                    ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>}
                </button>
              </div>
            </div>
            {authError && (
              <div style={{ padding: '10px 14px', borderRadius: 6, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#991b1b', fontWeight: 600 }}>{authError}</div>
            )}
            <button onClick={handleLogin} style={{ padding: '14px', background: '#0a0a0a', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: 'pointer', border: 'none', width: '100%', letterSpacing: 0.3 }}>
              Access Admin Portal
            </button>
          </div>
          <p style={{ marginTop: 28, fontSize: 11, color: '#d1d5db', textAlign: 'center', fontWeight: 500 }}>Restricted to authorized Moneta personnel only.</p>
        </div>
      </div>

      <style>{`
        input:focus{border-color:#10b981!important;box-shadow:0 0 0 3px rgba(16,185,129,0.1)!important}
        *{box-sizing:border-box;margin:0;padding:0}
      `}</style>
    </div>
  )

  // ── Dashboard ──────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', fontFamily: "'Inter', system-ui, sans-serif", zIndex: 9999, overflow: 'hidden', background: '#fff' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 220, background: '#0a0a0a', display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid #000', flexShrink: 0 }}>
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: -0.3, lineHeight: 1 }}>Moneta</p>
              <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 2 }}>Admin</p>
            </div>
          </div>
        </div>

        <nav style={{ padding: '12px 8px', flex: 1 }}>
          <p style={{ fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase', letterSpacing: 1.5, padding: '0 8px', marginBottom: 4 }}>Management</p>
          {[
            { label: 'CACS Review', active: true, badge: counts.pending, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
          ].map(({ label, icon, active, badge }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 6, marginBottom: 1, background: active ? 'rgba(16,185,129,0.12)' : 'transparent', color: active ? '#10b981' : 'rgba(255,255,255,0.35)', cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400, borderLeft: `2px solid ${active ? '#10b981' : 'transparent'}` }}>
              {icon}
              <span style={{ flex: 1 }}>{label}</span>
              {badge > 0 && <span style={{ background: '#d97706', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10 }}>{badge}</span>}
            </div>
          ))}
        </nav>

        <div style={{ padding: '12px 8px 16px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', marginBottom: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#fff' }}>MA</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#fff', lineHeight: 1 }}>MONETA.ADMIN</p>
              <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontWeight: 400, marginTop: 2 }}>Super Admin</p>
            </div>
          </div>
          <button onClick={handleLogout} style={{ width: '100%', height: 30, borderRadius: 4, background: 'transparent', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 24px', height: 48, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
            <span style={{ color: '#9ca3af', fontWeight: 400 }}>Management</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            <span style={{ color: '#111827', fontWeight: 700 }}>CACS Review</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#dc2626', padding: '3px 8px', borderRadius: 4, border: '1.5px solid #fca5a5', background: '#fef2f2', letterSpacing: 0.5 }}>PRODUCTION</span>
            <div style={{ width: 1, height: 20, background: '#e5e7eb' }} />
            <button onClick={loadUsers} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30, padding: '0 12px', borderRadius: 4, border: '1px solid #e5e7eb', background: '#fff', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
              Refresh
            </button>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

          {/* Page header */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: 16, fontWeight: 800, color: '#111827', letterSpacing: -0.3 }}>CACS Submissions</h1>
              <p style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>Review and approve NGX/CSCS account applications</p>
            </div>
            {counts.pending > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 6, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', fontSize: 13, fontWeight: 600, color: '#059669' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                {counts.pending} pending review
              </div>
            )}
          </div>

          {/* Stat summary strip */}
          <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex' }}>
            {([
              { label: 'Total users',   val: counts.all,           active: filter === 'all',           key: 'all' as CacsFilter },
              { label: 'Pending',       val: counts.pending,       active: filter === 'pending',       key: 'pending' as CacsFilter },
              { label: 'Approved',      val: counts.approved,      active: filter === 'approved',      key: 'approved' as CacsFilter },
              { label: 'Rejected',      val: counts.rejected,      active: filter === 'rejected',      key: 'rejected' as CacsFilter },
              { label: 'Not submitted', val: counts.not_submitted, active: filter === 'not_submitted', key: 'not_submitted' as CacsFilter },
            ]).map(({ label, val, active, key }, i) => (
              <button key={key} onClick={() => setFilter(key)}
                style={{ flex: 1, padding: '14px 16px', background: active ? 'rgba(16,185,129,0.05)' : '#fff', border: 'none', borderRight: i < 4 ? '1px solid #e5e7eb' : 'none', borderBottom: active ? '2px solid #10b981' : '2px solid transparent', cursor: 'pointer', textAlign: 'left' }}>
                <p style={{ fontSize: 20, fontWeight: 800, color: active ? '#10b981' : '#111827', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{val}</p>
                <p style={{ fontSize: 12, color: active ? '#059669' : '#6b7280', marginTop: 4, fontWeight: active ? 700 : 400 }}>{label}</p>
              </button>
            ))}
          </div>

          {/* Filter / search bar */}
          <div style={{ padding: '10px 24px', background: '#fff', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ position: 'relative', flex: 1, maxWidth: 360 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" placeholder="Search name, email, PAC ID…" value={search} onChange={(e) => setSearch(e.target.value)}
                style={{ width: '100%', padding: '7px 12px 7px 32px', borderRadius: 6, border: '1px solid #e5e7eb', fontSize: 13, color: '#111827', outline: 'none', background: '#fff' }} />
            </div>
            {search && (
              <button onClick={() => setSearch('')} style={{ display: 'flex', alignItems: 'center', gap: 5, height: 30, padding: '0 10px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>
                Clear
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
            <p style={{ marginLeft: 'auto', fontSize: 12, color: '#9ca3af' }}>{filtered.length} of {users.length}</p>
          </div>

          {/* Table */}
          {loadError ? (
            <div style={{ padding: '48px 24px', textAlign: 'center' }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>Failed to load users</p>
              <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>{loadError}</p>
              <button onClick={loadUsers} style={{ height: 30, padding: '0 14px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>Retry</button>
            </div>
          ) : loading ? (
            <div>
              {[...Array(8)].map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 0, padding: '0 24px', height: 44, borderBottom: '1px solid #f3f4f6', background: '#fff' }}>
                  <div style={{ flex: '0 0 240px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#f3f4f6', animation: 'shimmer 1.4s ease infinite' }} />
                    <div style={{ width: 120, height: 12, borderRadius: 4, background: '#f3f4f6', animation: 'shimmer 1.4s ease infinite' }} />
                  </div>
                  <div style={{ flex: '0 0 160px' }}><div style={{ width: 90, height: 12, borderRadius: 4, background: '#f3f4f6', animation: 'shimmer 1.4s ease infinite' }} /></div>
                  <div style={{ flex: '0 0 100px' }}><div style={{ width: 60, height: 20, borderRadius: 4, background: '#f3f4f6', animation: 'shimmer 1.4s ease infinite' }} /></div>
                  <div style={{ flex: '0 0 120px' }}><div style={{ width: 70, height: 20, borderRadius: 4, background: '#f3f4f6', animation: 'shimmer 1.4s ease infinite' }} /></div>
                  <div style={{ flex: '0 0 100px' }}><div style={{ width: 55, height: 12, borderRadius: 4, background: '#f3f4f6', animation: 'shimmer 1.4s ease infinite' }} /></div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '64px 24px', textAlign: 'center' }}>
              <div style={{ width: 44, height: 44, borderRadius: 8, background: '#f8fafc', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 4 }}>
                {search ? 'No users match that search' : filter !== 'all' ? `No ${filter.replace('_', ' ')} applications` : 'No users yet'}
              </p>
              <p style={{ fontSize: 13, color: '#6b7280' }}>
                {search ? 'Try a different name, email, or PAC ID.' : filter !== 'all' ? 'Switch to "All" to see all users.' : 'Users will appear here once they sign up.'}
              </p>
              {(search || filter !== 'all') && (
                <button onClick={() => { setSearch(''); setFilter('all') }} style={{ marginTop: 14, height: 30, padding: '0 14px', borderRadius: 4, border: '1px solid #d1d5db', background: '#fff', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>Clear filters</button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0a0a0a' }}>
                    {['User', 'PAC Account ID', 'KYC', 'CACS Status', 'Joined', 'Document', ''].map((h, i) => (
                      <th key={`${h}-${i}`} style={{ padding: '0 16px', height: 36, textAlign: 'left', fontWeight: 600, color: 'rgba(255,255,255,0.45)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7, whiteSpace: 'nowrap', borderRight: i < 6 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f3f4f6' : 'none', background: '#fff' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f9fefb' }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#fff' }}>

                      {/* User */}
                      <td style={{ padding: '0 16px', height: 44, borderRight: '1px solid #f3f4f6', minWidth: 220 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: avatarBg(u.full_name), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>{(u.full_name ?? '?').charAt(0).toUpperCase()}</span>
                          </div>
                          <div>
                            <p style={{ fontWeight: 600, color: '#111827', lineHeight: 1.2 }}>{u.full_name ?? '—'}</p>
                            <p style={{ fontSize: 11, color: '#9ca3af' }}>{u.email ?? 'no email'}</p>
                          </div>
                        </div>
                      </td>

                      {/* PAC ID */}
                      <td style={{ padding: '0 16px', height: 44, borderRight: '1px solid #f3f4f6' }}>
                        {u.pac_account_id ? (
                          <button onClick={() => copyId(u.pac_account_id!)} title={u.pac_account_id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'monospace', fontSize: 12, color: '#374151', background: '#f3f4f6', padding: '3px 8px', borderRadius: 4, border: 'none', cursor: 'copy', fontWeight: 600 }}>
                            {truncateId(u.pac_account_id)}
                            {copiedId === u.pac_account_id
                              ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                            }
                          </button>
                        ) : <span style={{ color: '#d1d5db', fontSize: 12 }}>—</span>}
                      </td>

                      {/* KYC */}
                      <td style={{ padding: '0 16px', height: 44, borderRight: '1px solid #f3f4f6' }}><StatusBadge status={u.kyc_status} /></td>

                      {/* CACS */}
                      <td style={{ padding: '0 16px', height: 44, borderRight: '1px solid #f3f4f6' }}><StatusBadge status={u.cacs_status} /></td>

                      {/* Joined */}
                      <td style={{ padding: '0 16px', height: 44, borderRight: '1px solid #f3f4f6' }}>
                        <span title={absDate(u.created_at)} style={{ fontSize: 12, color: '#6b7280', cursor: 'default' }}>{relativeDate(u.created_at)}</span>
                      </td>

                      {/* Document */}
                      <td style={{ padding: '0 16px', height: 44, borderRight: '1px solid #f3f4f6' }}>
                        {u.cacs_doc_url
                          ? (
                            <button onClick={() => setKycUser(u)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 10px', borderRadius: 4, background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', color: '#059669', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                              View KYC
                            </button>
                          )
                          : <span style={{ fontSize: 12, color: '#d1d5db' }}>—</span>}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '0 16px', height: 44 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          {u.cacs_status === 'approved' || u.cacs_status === 'rejected' ? (
                            <span style={{ fontSize: 11, color: '#d1d5db' }}>—</span>
                          ) : (
                            <>
                              <button onClick={() => setStatus(u.id, 'approved')} disabled={acting === u.id}
                                style={{ height: 28, padding: '0 10px', borderRadius: 4, background: acting === u.id ? '#f9fafb' : '#059669', color: acting === u.id ? '#9ca3af' : '#fff', fontWeight: 600, fontSize: 12, border: `1px solid ${acting === u.id ? '#e5e7eb' : '#047857'}`, cursor: acting === u.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                                {acting === u.id ? '…' : 'Approve'}
                              </button>
                              <button onClick={() => { setRejectTarget({ id: u.id, name: u.full_name }); setRejectReason('') }} disabled={acting === u.id}
                                style={{ height: 28, padding: '0 10px', borderRadius: 4, background: '#fff', color: '#dc2626', fontWeight: 600, fontSize: 12, border: '1px solid #fca5a5', cursor: acting === u.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                                Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table footer */}
          {!loading && !loadError && filtered.length > 0 && (
            <div style={{ padding: '10px 24px', borderTop: '1px solid #e5e7eb', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 12, color: '#9ca3af' }}>
                {filtered.length} result{filtered.length !== 1 ? 's' : ''} · {users.length} total users
              </p>
              <p style={{ fontSize: 11, color: '#d1d5db' }}>Changes take effect immediately</p>
            </div>
          )}
        </div>
      </main>

      {/* Rejection reason modal */}
      {rejectTarget && (
        <div onClick={() => setRejectTarget(null)} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Reject Application</p>
              <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{rejectTarget.name ?? 'Unknown user'} — select a reason</p>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {REJECT_REASONS.map((r) => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${rejectReason === r ? '#fca5a5' : '#e5e7eb'}`, background: rejectReason === r ? '#fef2f2' : '#fff', cursor: 'pointer', transition: 'all 0.12s' }}>
                  <input type="radio" name="rejectReason" value={r} checked={rejectReason === r} onChange={() => setRejectReason(r)} style={{ accentColor: '#dc2626', width: 14, height: 14, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: rejectReason === r ? 600 : 400, color: rejectReason === r ? '#dc2626' : '#374151' }}>{r}</span>
                </label>
              ))}
            </div>
            <div style={{ padding: '12px 20px 20px', display: 'flex', gap: 10 }}>
              <button onClick={() => setRejectTarget(null)} style={{ flex: 1, height: 38, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}>Cancel</button>
              <button
                disabled={!rejectReason || acting === rejectTarget.id}
                onClick={async () => {
                  const { id } = rejectTarget
                  setRejectTarget(null)
                  await setStatus(id, 'rejected', rejectReason)
                }}
                style={{ flex: 2, height: 38, borderRadius: 6, background: !rejectReason ? '#f9fafb' : '#dc2626', color: !rejectReason ? '#9ca3af' : '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: !rejectReason ? 'not-allowed' : 'pointer' }}>
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KYC Document Modal */}
      {kycUser && (
        <div onClick={() => setKycUser(null)} style={{ position: 'fixed', inset: 0, zIndex: 100000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 920, maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.35)' }}>

            {/* Modal header */}
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>KYC Document — {kycUser.full_name ?? kycUser.email}</p>
                <p style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>CACS form submission</p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={() => printReceipt(kycUser)} style={{ height: 32, padding: '0 14px', borderRadius: 6, background: '#111827', color: '#fff', fontSize: 12, fontWeight: 600, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                  Download Receipt
                </button>
                <button onClick={() => setKycUser(null)} style={{ width: 32, height: 32, borderRadius: 6, border: '1px solid #e5e7eb', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>

            {/* User info strip */}
            <div style={{ padding: '14px 20px', background: '#f8fafc', borderBottom: '1px solid #e5e7eb', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '12px 24px', flexShrink: 0 }}>
              {([
                { label: 'Full Name',     value: kycUser.full_name ?? '—',        mono: false },
                { label: 'Email',         value: kycUser.email ?? '—',            mono: false },
                { label: 'Phone Number',  value: kycUser.phone ?? '—',            mono: false },
                { label: 'BVN',           value: kycUser.bvn ? `${kycUser.bvn.slice(0,3)}****${kycUser.bvn.slice(-2)}` : '—', mono: true },
                { label: 'ID Type',       value: kycUser.id_type ?? '—',          mono: false },
                { label: 'ID Number',     value: kycUser.id_number ?? '—',        mono: true  },
                { label: 'PAC Account ID',value: kycUser.pac_account_id ?? '—',   mono: true  },
              ] as { label: string; value: string; mono: boolean }[]).map(({ label, value, mono }) => (
                <div key={label}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>{label}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', fontFamily: mono ? 'monospace' : undefined }}>{value}</p>
                </div>
              ))}
              <div>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3 }}>CACS Status</p>
                <StatusBadge status={kycUser.cacs_status} />
              </div>
            </div>

            {/* PDF iframe */}
            <div style={{ flex: 1, minHeight: 0 }}>
              <iframe src={kycUser.cacs_doc_url ?? ''} title="CACS Document" style={{ width: '100%', height: '100%', border: 'none', display: 'block', minHeight: 480 }} />
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, padding: '11px 18px', borderRadius: 8, background: toast.ok ? '#111827' : '#fff', border: `1px solid ${toast.ok ? '#374151' : '#fecaca'}`, color: toast.ok ? '#f9fafb' : '#991b1b', fontWeight: 600, fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, zIndex: 99999, animation: 'slideUp 0.2s ease', boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }}>
          {toast.ok
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>}
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:0.4} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { border-color: #10b981 !important; box-shadow: 0 0 0 3px rgba(16,185,129,0.08) !important; }
        button:disabled { cursor: not-allowed; }
      `}</style>
    </div>
  )
}
