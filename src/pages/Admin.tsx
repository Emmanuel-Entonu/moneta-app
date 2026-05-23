import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const ADMIN_USER = 'MONETA.ADMIN'
const ADMIN_PASS = 'EMMA123X'
const SESSION_KEY = 'moneta_admin_session'

interface UserRow {
  id: string
  full_name: string | null
  email: string | null
  kyc_status: string | null
  cacs_status: string | null
  cacs_doc_url: string | null
  pac_account_id: string | null
  created_at: string | null
}

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected' | 'not_submitted'

const STATUS_CFG: Record<string, { bg: string; color: string; dot: string; label: string }> = {
  approved:      { bg: 'rgba(16,185,129,0.12)', color: '#064e3b', dot: '#10b981', label: 'Approved' },
  pending:       { bg: 'rgba(245,158,11,0.12)',  color: '#78350f', dot: '#f59e0b', label: 'Pending' },
  rejected:      { bg: 'rgba(239,68,68,0.12)',   color: '#7f1d1d', dot: '#ef4444', label: 'Rejected' },
  not_submitted: { bg: 'rgba(148,163,184,0.15)', color: '#475569', dot: '#94a3b8', label: 'Not Submitted' },
  verified:      { bg: 'rgba(16,185,129,0.12)',  color: '#064e3b', dot: '#10b981', label: 'Verified' },
  submitted:     { bg: 'rgba(59,130,246,0.12)',  color: '#1e3a8a', dot: '#3b82f6', label: 'Submitted' },
}

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#6366f1,#8b5cf6)',
  'linear-gradient(135deg,#ec4899,#f43f5e)',
  'linear-gradient(135deg,#0ea5e9,#06b6d4)',
  'linear-gradient(135deg,#10b981,#059669)',
  'linear-gradient(135deg,#f59e0b,#ef4444)',
  'linear-gradient(135deg,#8b5cf6,#ec4899)',
  'linear-gradient(135deg,#06b6d4,#6366f1)',
  'linear-gradient(135deg,#f43f5e,#f59e0b)',
]

function avatarGradient(name: string | null): string {
  if (!name) return AVATAR_GRADIENTS[0]
  return AVATAR_GRADIENTS[name.charCodeAt(0) % AVATAR_GRADIENTS.length]
}

function StatusBadge({ status }: { status: string | null }) {
  const key = status ?? 'not_submitted'
  const cfg = STATUS_CFG[key] ?? STATUS_CFG['not_submitted']
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 11px', borderRadius: 100, fontSize: 11, fontWeight: 700, background: cfg.bg, color: cfg.color, whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: cfg.dot, boxShadow: `0 0 0 2px ${cfg.dot}30` }} />
      {cfg.label}
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
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [approving, setApproving] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => { if (sessionStorage.getItem(SESSION_KEY) === '1') setAuthed(true) }, [])
  useEffect(() => { if (authed) loadUsers() }, [authed])
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(t)
  }, [toast])

  function handleLogin() {
    if (username.trim() === ADMIN_USER && password === ADMIN_PASS) {
      sessionStorage.setItem(SESSION_KEY, '1')
      setAuthed(true)
    } else {
      setAuthError('Invalid credentials. Access denied.')
    }
  }

  function handleLogout() {
    sessionStorage.removeItem(SESSION_KEY)
    setAuthed(false)
    setUsers([])
  }

  async function loadUsers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, kyc_status, cacs_status, cacs_doc_url, pac_account_id, created_at')
      .order('created_at', { ascending: false })
    setLoading(false)
    if (error) { console.error(error); return }
    setUsers((data ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name ?? null,
      email: p.email ?? null,
      kyc_status: p.kyc_status ?? null,
      cacs_status: p.cacs_status ?? null,
      cacs_doc_url: p.cacs_doc_url ?? null,
      pac_account_id: p.pac_account_id ?? null,
      created_at: p.created_at ?? null,
    })))
  }

  async function setStatus(userId: string, status: 'approved' | 'rejected') {
    const setter = status === 'approved' ? setApproving : setRejecting
    setter(userId)
    const { error } = await supabase.from('profiles').update({ cacs_status: status }).eq('id', userId)
    setter(null)
    if (error) {
      setToast({ msg: error.message, ok: false })
    } else {
      setToast({ msg: `User ${status === 'approved' ? 'approved' : 'rejected'} successfully`, ok: true })
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, cacs_status: status } : u))
    }
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
    const matchFilter = filter === 'all' || s === filter
    const q = search.toLowerCase()
    const matchSearch = !q ||
      (u.full_name ?? '').toLowerCase().includes(q) ||
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.pac_account_id ?? '').toLowerCase().includes(q)
    return matchFilter && matchSearch
  })

  // ── Login ──────────────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', fontFamily: "'Inter', system-ui, sans-serif", zIndex: 9999 }}>

      {/* Left panel */}
      <div style={{ flex: '0 0 48%', background: '#030b17', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '52px 64px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -120, right: -120, width: 480, height: 480, borderRadius: '50%', background: 'radial-gradient(circle,rgba(16,185,129,0.18) 0%,transparent 65%)', pointerEvents: 'none', animation: 'orb1 9s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', bottom: -160, left: -80, width: 520, height: 520, borderRadius: '50%', background: 'radial-gradient(circle,rgba(99,102,241,0.12) 0%,transparent 65%)', pointerEvents: 'none', animation: 'orb2 12s ease-in-out infinite' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)', backgroundSize: '48px 48px', pointerEvents: 'none' }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ width: 48, height: 48, borderRadius: 16, background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 36px rgba(16,185,129,0.55)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div>
            <p style={{ fontSize: 20, fontWeight: 900, color: '#f1f5f9', letterSpacing: -0.5, lineHeight: 1 }}>Moneta</p>
            <span style={{ display: 'inline-block', marginTop: 4, padding: '2px 8px', borderRadius: 6, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', fontSize: 9, fontWeight: 800, color: '#34d399', letterSpacing: 2, textTransform: 'uppercase' }}>Admin Portal</span>
          </div>
        </div>

        {/* Headline */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h1 style={{ fontSize: 56, fontWeight: 900, letterSpacing: -2.5, lineHeight: 1.04, marginBottom: 22 }}>
            <span style={{ color: '#f1f5f9' }}>Moneta<br />Management<br /></span>
            <span style={{ background: 'linear-gradient(90deg,#10b981 0%,#34d399 50%,#6ee7b7 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Console</span>
          </h1>
          <p style={{ fontSize: 15, color: '#475569', fontWeight: 500, lineHeight: 1.75, maxWidth: 380 }}>
            Review CACS submissions, approve NGX/CSCS trading accounts, and manage platform access — all in one place.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 40 }}>
            {['CACS Form Review & Instant Approval', 'NGX / CSCS Account Lifecycle Management', 'Real-time User Status & KYC Tracking'].map((f) => (
              <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <span style={{ fontSize: 13.5, color: '#64748b', fontWeight: 500 }}>{f}</span>
              </div>
            ))}
          </div>
        </div>

        <p style={{ position: 'relative', zIndex: 1, fontSize: 11, color: '#1e293b', fontWeight: 500 }}>© 2025 Moneta Securities · Internal Use Only</p>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 72px' }}>
        <div style={{ width: '100%', maxWidth: 420 }}>
          <div style={{ marginBottom: 40 }}>
            <h2 style={{ fontSize: 30, fontWeight: 900, color: '#0f172a', letterSpacing: -1, marginBottom: 8 }}>Sign in</h2>
            <p style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>Authorized personnel only. All access is logged and monitored.</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#374151', marginBottom: 8, letterSpacing: 0.8, textTransform: 'uppercase' }}>Username</label>
              <input value={username} onChange={(e) => { setUsername(e.target.value); setAuthError(null) }} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="MONETA.ADMIN" autoComplete="off"
                style={{ width: '100%', padding: '14px 18px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: 14, fontWeight: 600, boxSizing: 'border-box', outline: 'none', letterSpacing: 0.5 }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#374151', marginBottom: 8, letterSpacing: 0.8, textTransform: 'uppercase' }}>Password</label>
              <div style={{ position: 'relative' }}>
                <input type={showPass ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setAuthError(null) }} onKeyDown={(e) => e.key === 'Enter' && handleLogin()} placeholder="••••••••"
                  style={{ width: '100%', padding: '14px 50px 14px 18px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: 14, fontWeight: 600, boxSizing: 'border-box', outline: 'none' }} />
                <button onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', display: 'flex' }}>
                  {showPass
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {authError && (
              <div style={{ padding: '12px 16px', borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#991b1b', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {authError}
              </div>
            )}

            <button onClick={handleLogin} style={{ padding: '16px', background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', borderRadius: 12, fontWeight: 800, fontSize: 15, cursor: 'pointer', border: 'none', boxShadow: '0 6px 24px rgba(16,185,129,0.4)', letterSpacing: 0.3, width: '100%' }}>
              Access Admin Portal →
            </button>
          </div>

          <p style={{ marginTop: 36, fontSize: 11, color: '#cbd5e1', textAlign: 'center', fontWeight: 500, lineHeight: 1.8 }}>
            This system is restricted to authorized Moneta personnel only.<br />Unauthorized access is prohibited and will be reported.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes orb1 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(30px,-30px) scale(1.1)} }
        @keyframes orb2 { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-20px,35px) scale(1.06)} }
        input:focus { border-color: #10b981 !important; box-shadow: 0 0 0 3px rgba(16,185,129,0.12) !important; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>
    </div>
  )

  // ── Dashboard ──────────────────────────────────────────────────────────────
  const statCards = [
    { label: 'Total Users',    val: counts.all,           accent: '#6366f1', iconBg: 'rgba(99,102,241,0.1)',   iconColor: '#6366f1', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
    { label: 'Pending Review', val: counts.pending,       accent: '#f59e0b', iconBg: 'rgba(245,158,11,0.1)',   iconColor: '#f59e0b', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
    { label: 'Approved',       val: counts.approved,      accent: '#10b981', iconBg: 'rgba(16,185,129,0.1)',   iconColor: '#10b981', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> },
    { label: 'Rejected',       val: counts.rejected,      accent: '#ef4444', iconBg: 'rgba(239,68,68,0.1)',    iconColor: '#ef4444', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> },
    { label: 'Not Submitted',  val: counts.not_submitted, accent: '#94a3b8', iconBg: 'rgba(148,163,184,0.1)', iconColor: '#94a3b8', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', fontFamily: "'Inter', system-ui, sans-serif", zIndex: 9999, overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 256, background: 'linear-gradient(180deg,#060d1c 0%,#071222 100%)', display: 'flex', flexDirection: 'column', height: '100%', borderRight: '1px solid rgba(255,255,255,0.055)', flexShrink: 0 }}>

        {/* Logo */}
        <div style={{ padding: '28px 22px 22px', borderBottom: '1px solid rgba(255,255,255,0.055)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 13, background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 28px rgba(16,185,129,0.5)', flexShrink: 0 }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 900, color: '#f1f5f9', letterSpacing: -0.4, lineHeight: 1 }}>Moneta</p>
              <p style={{ fontSize: 9, color: '#10b981', fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', marginTop: 3 }}>Admin Portal</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '18px 12px', flex: 1 }}>
          <p style={{ fontSize: 9, fontWeight: 800, color: '#1a2e4a', textTransform: 'uppercase', letterSpacing: 1.8, padding: '0 10px', marginBottom: 8 }}>Management</p>
          {[
            { label: 'CACS Review', active: true,  badge: counts.pending > 0 ? counts.pending : 0, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> },
            { label: 'Users',        active: false, badge: 0, icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> },
          ].map(({ label, icon, active, badge }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 10px', borderRadius: 10, marginBottom: 2, background: active ? 'rgba(16,185,129,0.1)' : 'transparent', color: active ? '#10b981' : '#334155', cursor: 'pointer', fontSize: 13.5, fontWeight: active ? 700 : 500, borderLeft: `2.5px solid ${active ? '#10b981' : 'transparent'}` }}>
              {icon}
              <span style={{ flex: 1 }}>{label}</span>
              {active && badge > 0 && <span style={{ background: '#f59e0b', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 100 }}>{badge}</span>}
            </div>
          ))}
        </nav>

        {/* User + Logout */}
        <div style={{ padding: '16px 14px 20px', borderTop: '1px solid rgba(255,255,255,0.055)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 10, marginBottom: 10 }}>
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 0 14px rgba(16,185,129,0.35)' }}>
              <span style={{ fontSize: 12, fontWeight: 900, color: '#fff' }}>MA</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', lineHeight: 1 }}>MONETA.ADMIN</p>
              <p style={{ fontSize: 10, color: '#334155', fontWeight: 500, marginTop: 3 }}>Super Admin</p>
            </div>
          </div>
          <button onClick={handleLogout} style={{ width: '100%', padding: '9px', borderRadius: 10, background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)', color: '#f87171', fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#edf1f7', minWidth: 0 }}>

        {/* Topbar */}
        <header style={{ background: '#fff', borderBottom: '1px solid #e4e9f0', padding: '0 36px', height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Management</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            <span style={{ fontSize: 12, color: '#0f172a', fontWeight: 800 }}>CACS Review</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 100, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 6px #16a34a80' }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#166534' }}>System Online</span>
            </div>
            <button onClick={loadUsers} style={{ padding: '8px 16px', borderRadius: 9, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 700, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
              Refresh
            </button>
          </div>
        </header>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0, padding: '36px 44px' }}>

          {/* Page heading */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 32 }}>
            <div>
              <h1 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', letterSpacing: -1, marginBottom: 6 }}>CACS Submissions</h1>
              <p style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>Review and approve NGX/CSCS trading account applications from users</p>
            </div>
            {counts.pending > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 12, background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.25)', animation: 'fadeIn 0.4s ease' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b', animation: 'ping 2s ease infinite' }} />
                <span style={{ fontSize: 13.5, fontWeight: 800, color: '#92400e' }}>{counts.pending} awaiting review</span>
              </div>
            )}
          </div>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 16, marginBottom: 32 }}>
            {statCards.map(({ label, val, accent, iconBg, iconColor, icon }) => (
              <div key={label} style={{ background: '#fff', borderRadius: 16, padding: '22px 22px 18px', border: '1px solid #e4e9f0', borderTop: `3px solid ${accent}`, boxShadow: '0 2px 10px rgba(0,0,0,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b' }}>{label}</p>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: iconColor, flexShrink: 0 }}>{icon}</div>
                </div>
                <p style={{ fontSize: 40, fontWeight: 900, color: '#0f172a', letterSpacing: -2, lineHeight: 1 }}>{val}</p>
                {counts.all > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <div style={{ height: 3, background: '#f1f5f9', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.round((val / counts.all) * 100)}%`, background: accent, borderRadius: 10, transition: 'width 0.6s ease' }} />
                    </div>
                    <p style={{ fontSize: 10.5, color: '#94a3b8', fontWeight: 600, marginTop: 5 }}>{counts.all > 0 ? Math.round((val / counts.all) * 100) : 0}% of total</p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Table card */}
          <div style={{ background: '#fff', borderRadius: 20, border: '1px solid #e4e9f0', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>

            {/* Toolbar */}
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', background: '#f8fafc', border: '1.5px solid #e4e9f0', borderRadius: 12, padding: 4, gap: 2 }}>
                {(['all', 'pending', 'approved', 'rejected', 'not_submitted'] as FilterTab[]).map((t) => (
                  <button key={t} onClick={() => setFilter(t)} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filter === t ? '#fff' : 'transparent', color: filter === t ? '#0f172a' : '#94a3b8', border: filter === t ? '1.5px solid #e2e8f0' : '1.5px solid transparent', whiteSpace: 'nowrap', boxShadow: filter === t ? '0 1px 4px rgba(0,0,0,0.08)' : 'none' }}>
                    {t === 'not_submitted' ? 'Not Submitted' : t.charAt(0).toUpperCase() + t.slice(1)}
                    <span style={{ marginLeft: 5, padding: '1px 6px', borderRadius: 100, background: filter === t ? '#f1f5f9' : 'transparent', fontSize: 10, fontWeight: 800, color: '#94a3b8' }}>{counts[t]}</span>
                  </button>
                ))}
              </div>
              <div style={{ marginLeft: 'auto', position: 'relative' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input type="text" placeholder="Search name, email or PAC ID…" value={search} onChange={(e) => setSearch(e.target.value)}
                  style={{ width: 280, padding: '9px 14px 9px 36px', borderRadius: 10, border: '1.5px solid #e4e9f0', fontSize: 13, color: '#0f172a', outline: 'none', background: '#fff', fontWeight: 500, boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div style={{ padding: '80px', textAlign: 'center' }}>
                <div style={{ width: 30, height: 30, border: '2.5px solid #e2e8f0', borderTopColor: '#10b981', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 16px' }} />
                <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 600 }}>Loading users…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '80px', textAlign: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#f8fafc', border: '2px solid #e8edf3', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 18px' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>
                <p style={{ fontSize: 15, fontWeight: 800, color: '#94a3b8', marginBottom: 6 }}>No users match this filter</p>
                <p style={{ fontSize: 13, color: '#cbd5e1', fontWeight: 500 }}>Try adjusting your search or filter criteria</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1.5px solid #e8edf3' }}>
                      {['User', 'PAC Account ID', 'KYC', 'CACS Status', 'Joined', 'Document', 'Actions'].map((h, i) => (
                        <th key={h} style={{ padding: '13px 20px', textAlign: 'left', fontWeight: 800, color: '#64748b', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.9, whiteSpace: 'nowrap', borderRight: i < 6 ? '1px solid #f1f5f9' : 'none' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u, i) => (
                      <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#fafbfd' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '' }}>
                        <td style={{ padding: '16px 20px', borderRight: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ width: 40, height: 40, borderRadius: 13, background: avatarGradient(u.full_name), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 10px rgba(0,0,0,0.15)' }}>
                              <span style={{ fontSize: 15, fontWeight: 900, color: '#fff' }}>{(u.full_name ?? '?').charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                              <p style={{ fontWeight: 700, color: '#0f172a', fontSize: 13.5, marginBottom: 2 }}>{u.full_name ?? '—'}</p>
                              <p style={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 500 }}>{u.email ?? 'No email'}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px', borderRight: '1px solid #f1f5f9' }}>
                          {u.pac_account_id
                            ? <span style={{ fontFamily: 'monospace', fontSize: 12, background: '#f8fafc', color: '#374151', padding: '4px 10px', borderRadius: 8, border: '1px solid #e8edf3', fontWeight: 700 }}>{u.pac_account_id}</span>
                            : <span style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600 }}>—</span>}
                        </td>
                        <td style={{ padding: '16px 20px', borderRight: '1px solid #f1f5f9' }}><StatusBadge status={u.kyc_status} /></td>
                        <td style={{ padding: '16px 20px', borderRight: '1px solid #f1f5f9' }}><StatusBadge status={u.cacs_status} /></td>
                        <td style={{ padding: '16px 20px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 600, borderRight: '1px solid #f1f5f9' }}>
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td style={{ padding: '16px 20px', borderRight: '1px solid #f1f5f9' }}>
                          {u.cacs_doc_url
                            ? <a href={u.cacs_doc_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#2563eb', textDecoration: 'none', padding: '5px 12px', borderRadius: 8, background: '#eff6ff', border: '1.5px solid #bfdbfe' }}>
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                View PDF
                              </a>
                            : <span style={{ fontSize: 12, color: '#e2e8f0', fontWeight: 600 }}>No file</span>}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {u.cacs_status !== 'approved' && (
                              <button onClick={() => setStatus(u.id, 'approved')} disabled={approving === u.id}
                                style={{ padding: '7px 16px', borderRadius: 8, background: approving === u.id ? '#f1f5f9' : 'linear-gradient(135deg,#10b981,#059669)', color: approving === u.id ? '#94a3b8' : '#fff', fontWeight: 700, fontSize: 12, border: 'none', cursor: approving === u.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', boxShadow: approving === u.id ? 'none' : '0 3px 10px rgba(16,185,129,0.3)' }}>
                                {approving === u.id ? '…' : 'Approve'}
                              </button>
                            )}
                            {u.cacs_status !== 'rejected' && (
                              <button onClick={() => setStatus(u.id, 'rejected')} disabled={rejecting === u.id}
                                style={{ padding: '7px 16px', borderRadius: 8, background: '#fff', color: rejecting === u.id ? '#94a3b8' : '#ef4444', fontWeight: 700, fontSize: 12, border: `1.5px solid ${rejecting === u.id ? '#e2e8f0' : '#fca5a5'}`, cursor: rejecting === u.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                                {rejecting === u.id ? '…' : 'Reject'}
                              </button>
                            )}
                            {u.cacs_status === 'approved' && (
                              <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600, fontStyle: 'italic' }}>— approved —</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ padding: '14px 24px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#fafbfc' }}>
              <p style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
                Showing <strong style={{ color: '#0f172a' }}>{filtered.length}</strong> of <strong style={{ color: '#0f172a' }}>{users.length}</strong> users
              </p>
              <p style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 500 }}>Changes take effect immediately · Auto-refreshes on action</p>
            </div>
          </div>
        </div>
      </main>

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 32, right: 32, padding: '14px 22px', borderRadius: 14, background: toast.ok ? '#0f172a' : '#fff', border: `1.5px solid ${toast.ok ? 'rgba(16,185,129,0.3)' : '#fecaca'}`, color: toast.ok ? '#f1f5f9' : '#991b1b', fontWeight: 700, fontSize: 13.5, boxShadow: '0 16px 48px rgba(0,0,0,0.18)', display: 'flex', alignItems: 'center', gap: 10, zIndex: 99999, animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
          {toast.ok
            ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          }
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes ping    { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(0.75)} }
        @keyframes fadeIn  { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { border-color: #10b981 !important; box-shadow: 0 0 0 3px rgba(16,185,129,0.1) !important; }
      `}</style>
    </div>
  )
}
