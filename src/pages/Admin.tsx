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

const BADGE: Record<string, { bg: string; text: string; dot: string }> = {
  approved:      { bg: '#dcfce7', text: '#166534', dot: '#16a34a' },
  pending:       { bg: '#fef9c3', text: '#854d0e', dot: '#ca8a04' },
  rejected:      { bg: '#fee2e2', text: '#991b1b', dot: '#dc2626' },
  not_submitted: { bg: '#f1f5f9', text: '#64748b', dot: '#94a3b8' },
  verified:      { bg: '#dcfce7', text: '#166534', dot: '#16a34a' },
  submitted:     { bg: '#dbeafe', text: '#1e40af', dot: '#3b82f6' },
}

function Badge({ status }: { status: string | null }) {
  const s = status ?? 'not_submitted'
  const c = BADGE[s] ?? BADGE['not_submitted']
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.text, whiteSpace: 'nowrap', letterSpacing: 0.1 }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
      {s.replace(/_/g, ' ')}
    </span>
  )
}

export default function Admin() {
  const [username, setUsername] = useState('')
  const [password, setPassword]  = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authed, setAuthed]       = useState(false)
  const [showPass, setShowPass]   = useState(false)

  const [users, setUsers]         = useState<UserRow[]>([])
  const [loading, setLoading]     = useState(false)
  const [filter, setFilter]       = useState<FilterTab>('all')
  const [search, setSearch]       = useState('')
  const [approving, setApproving] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null)

  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY) === '1') setAuthed(true)
  }, [])

  useEffect(() => {
    if (authed) loadUsers()
  }, [authed])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 3000)
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

  // ── Login ────────────────────────────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', fontFamily: "'Inter', system-ui, sans-serif", zIndex: 9999 }}>

        {/* Left branding panel */}
        <div style={{ flex: '0 0 45%', background: 'linear-gradient(160deg,#0a1628 0%,#0f2318 60%,#062318 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '48px 56px', position: 'relative', overflow: 'hidden' }}>
          {/* Grid texture */}
          <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)', backgroundSize: '40px 40px', pointerEvents: 'none' }} />
          {/* Glow */}
          <div style={{ position: 'absolute', bottom: -80, left: -80, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(5,150,105,0.18) 0%,transparent 70%)', pointerEvents: 'none' }} />

          {/* Logo */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 46, height: 46, borderRadius: 14, background: 'linear-gradient(135deg,#059669,#047857)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 32px rgba(5,150,105,0.45)' }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div>
                <p style={{ fontSize: 20, fontWeight: 900, color: '#f8fafc', letterSpacing: -0.5, lineHeight: 1 }}>Moneta</p>
                <p style={{ fontSize: 10, color: '#34d399', fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginTop: 2 }}>Admin Portal</p>
              </div>
            </div>
          </div>

          {/* Center content */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h1 style={{ fontSize: 36, fontWeight: 900, color: '#f8fafc', letterSpacing: -1, lineHeight: 1.15, marginBottom: 16 }}>
              Moneta<br />Management<br /><span style={{ color: '#34d399' }}>Console</span>
            </h1>
            <p style={{ fontSize: 14, color: '#64748b', fontWeight: 500, lineHeight: 1.7, maxWidth: 320 }}>
              Review CACS submissions, approve trading accounts, and manage user access for the NGX trading platform.
            </p>

            {/* Feature pills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 32 }}>
              {[
                'CACS Form Review & Approval',
                'NGX/CSCS Account Management',
                'Real-time User Status Tracking',
              ].map((f) => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(5,150,105,0.2)', border: '1px solid rgba(5,150,105,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </div>
                  <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            <p style={{ fontSize: 11, color: '#334155', fontWeight: 500 }}>© 2025 Moneta Securities · Internal Use Only</p>
          </div>
        </div>

        {/* Right login panel */}
        <div style={{ flex: 1, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 64px' }}>
          <div style={{ width: '100%', maxWidth: 400 }}>
            <div style={{ marginBottom: 36 }}>
              <h2 style={{ fontSize: 26, fontWeight: 900, color: '#0f172a', letterSpacing: -0.6, marginBottom: 6 }}>Sign in</h2>
              <p style={{ fontSize: 14, color: '#64748b', fontWeight: 500 }}>Enter your admin credentials to access the portal</p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, letterSpacing: 0.3, textTransform: 'uppercase' }}>Username</label>
                <input
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setAuthError(null) }}
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                  placeholder="MONETA.ADMIN"
                  autoComplete="off"
                  style={{ width: '100%', padding: '13px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: 14, fontWeight: 600, boxSizing: 'border-box', outline: 'none', letterSpacing: 0.5 }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 8, letterSpacing: 0.3, textTransform: 'uppercase' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setAuthError(null) }}
                    onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    placeholder="••••••••"
                    style={{ width: '100%', padding: '13px 48px 13px 16px', borderRadius: 10, border: '1.5px solid #e2e8f0', background: '#fff', color: '#0f172a', fontSize: 14, fontWeight: 600, boxSizing: 'border-box', outline: 'none' }}
                  />
                  <button onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: 4, display: 'flex' }}>
                    {showPass
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              {authError && (
                <div style={{ padding: '11px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#991b1b', fontWeight: 600 }}>{authError}</div>
              )}

              <button
                onClick={handleLogin}
                style={{ padding: '14px', background: 'linear-gradient(135deg,#059669,#047857)', color: '#fff', borderRadius: 10, fontWeight: 800, fontSize: 15, cursor: 'pointer', border: 'none', marginTop: 4, boxShadow: '0 4px 20px rgba(5,150,105,0.3)', letterSpacing: 0.2, width: '100%' }}
              >
                Access Admin Portal
              </button>
            </div>

            <p style={{ marginTop: 28, fontSize: 11, color: '#cbd5e1', textAlign: 'center', fontWeight: 500 }}>
              This system is restricted to authorized Moneta personnel only.<br />Unauthorized access is prohibited.
            </p>
          </div>
        </div>

        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          * { box-sizing: border-box; margin: 0; padding: 0; }
          input:focus { border-color: #059669 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.12) !important; }
        `}</style>
      </div>
    )
  }

  // ── Dashboard ────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', background: '#f1f5f9', fontFamily: "'Inter', system-ui, sans-serif", zIndex: 9999, overflow: 'hidden' }}>

      {/* ── Sidebar ── */}
      <aside className="admin-sidebar" style={{ width: 240, background: '#0f172a', display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%', overflowY: 'auto' }}>
        {/* Logo */}
        <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#059669,#047857)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <div>
              <p style={{ fontSize: 15, fontWeight: 800, color: '#f8fafc', letterSpacing: -0.3, lineHeight: 1 }}>Moneta</p>
              <p style={{ fontSize: 10, color: '#64748b', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginTop: 2 }}>Admin Portal</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ padding: '16px 12px', flex: 1 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: '#334155', textTransform: 'uppercase', letterSpacing: 1, padding: '0 8px', marginBottom: 8 }}>Management</p>
          {[
            { label: 'CACS Review',  icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>, active: true },
            { label: 'Users',        icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>, active: false },
          ].map(({ label, icon, active }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 10px', borderRadius: 8, marginBottom: 2, background: active ? 'rgba(5,150,105,0.15)' : 'transparent', color: active ? '#34d399' : '#64748b', cursor: 'pointer', fontSize: 13, fontWeight: active ? 700 : 500, transition: 'all 0.15s' }}>
              {icon}{label}
              {active && <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />}
            </div>
          ))}
        </nav>

        {/* Sidebar footer */}
        <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#059669,#047857)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#fff' }}>MA</span>
            </div>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: '#f8fafc', lineHeight: 1 }}>MONETA.ADMIN</p>
              <p style={{ fontSize: 10, color: '#64748b', fontWeight: 500, marginTop: 2 }}>Super Admin</p>
            </div>
          </div>
          <button onClick={handleLogout} style={{ width: '100%', padding: '8px', borderRadius: 8, background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, height: '100%', overflow: 'hidden' }}>

        {/* Top header */}
        <header style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 32px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>Management</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
              <span style={{ fontSize: 12, color: '#0f172a', fontWeight: 700 }}>CACS Review</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#166534' }}>System Online</span>
            </div>
            <button onClick={loadUsers} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
              Refresh
            </button>
          </div>
        </header>

        <div style={{ flex: 1, padding: '28px 32px', overflowY: 'auto', minHeight: 0 }}>

          {/* Page title */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', letterSpacing: -0.5, marginBottom: 4 }}>CACS Submissions</h1>
            <p style={{ fontSize: 13, color: '#64748b', fontWeight: 500 }}>Review and approve NGX/CSCS trading account applications from users</p>
          </div>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 }}>
            {([
              { label: 'Total Users',    val: counts.all,           accent: '#0f172a', light: '#f8fafc', border: '#e2e8f0',  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg> },
              { label: 'Pending Review', val: counts.pending,       accent: '#b45309', light: '#fffbeb', border: '#fde68a',  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
              { label: 'Approved',       val: counts.approved,      accent: '#166534', light: '#f0fdf4', border: '#bbf7d0',  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg> },
              { label: 'Rejected',       val: counts.rejected,      accent: '#991b1b', light: '#fef2f2', border: '#fecaca',  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg> },
              { label: 'Not Submitted',  val: counts.not_submitted, accent: '#374151', light: '#f1f5f9', border: '#e2e8f0',  icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> },
            ] as const).map(({ label, val, accent, light, border, icon }) => (
              <div key={label} style={{ background: light, borderRadius: 14, padding: '18px 20px', border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', letterSpacing: 0.1 }}>{label}</p>
                  {icon}
                </div>
                <p style={{ fontSize: 30, fontWeight: 900, color: accent, letterSpacing: -1, lineHeight: 1 }}>{val}</p>
              </div>
            ))}
          </div>

          {/* Table card */}
          <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>

            {/* Toolbar */}
            <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              {/* Filter tabs */}
              <div style={{ display: 'flex', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: 3, gap: 2 }}>
                {(['all', 'pending', 'approved', 'rejected', 'not_submitted'] as FilterTab[]).map((t) => (
                  <button key={t} onClick={() => setFilter(t)} style={{ padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filter === t ? '#fff' : 'transparent', color: filter === t ? '#0f172a' : '#94a3b8', border: filter === t ? '1px solid #e2e8f0' : '1px solid transparent', transition: 'all 0.12s', whiteSpace: 'nowrap', boxShadow: filter === t ? '0 1px 3px rgba(0,0,0,0.06)' : 'none' }}>
                    {t === 'not_submitted' ? 'Not Submitted' : t.charAt(0).toUpperCase() + t.slice(1)}
                    <span style={{ marginLeft: 5, padding: '1px 6px', borderRadius: 20, background: filter === t ? '#f1f5f9' : 'transparent', fontSize: 10, fontWeight: 800, color: filter === t ? '#64748b' : '#94a3b8' }}>
                      {counts[t]}
                    </span>
                  </button>
                ))}
              </div>

              {/* Search */}
              <div style={{ marginLeft: 'auto', position: 'relative', minWidth: 240 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <input
                  type="text"
                  placeholder="Search name, email or PAC ID…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ width: '100%', padding: '8px 14px 8px 34px', borderRadius: 8, border: '1.5px solid #e2e8f0', fontSize: 13, color: '#0f172a', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>

            {/* Table */}
            {loading ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <div style={{ width: 24, height: 24, border: '2.5px solid #e2e8f0', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
                <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>Loading users…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: '60px', textAlign: 'center' }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#cbd5e1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 12px', display: 'block' }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                <p style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>No users match this filter.</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 800 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['User', 'PAC Account ID', 'KYC', 'CACS Status', 'Joined', 'Document', 'Actions'].map((h, i) => (
                        <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6, whiteSpace: 'nowrap', borderBottom: '1px solid #f1f5f9', borderRight: i < 6 ? '1px solid #f1f5f9' : 'none' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u, i) => (
                      <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f8fafc' : 'none' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#f8fafc' }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '' }}
                      >
                        <td style={{ padding: '14px 16px', borderRight: '1px solid #f1f5f9' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg,#e2e8f0,#cbd5e1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>{(u.full_name ?? '?').charAt(0).toUpperCase()}</span>
                            </div>
                            <div>
                              <p style={{ fontWeight: 700, color: '#0f172a', fontSize: 13, marginBottom: 1 }}>{u.full_name ?? '—'}</p>
                              <p style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500 }}>{u.email ?? 'no email'}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '14px 16px', fontFamily: 'monospace', fontSize: 12, color: '#374151', whiteSpace: 'nowrap', borderRight: '1px solid #f1f5f9' }}>
                          {u.pac_account_id
                            ? <span style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: 6, border: '1px solid #e2e8f0' }}>{u.pac_account_id}</span>
                            : <span style={{ color: '#cbd5e1' }}>—</span>
                          }
                        </td>
                        <td style={{ padding: '14px 16px', borderRight: '1px solid #f1f5f9' }}><Badge status={u.kyc_status} /></td>
                        <td style={{ padding: '14px 16px', borderRight: '1px solid #f1f5f9' }}><Badge status={u.cacs_status} /></td>
                        <td style={{ padding: '14px 16px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 12, borderRight: '1px solid #f1f5f9' }}>
                          {u.created_at ? new Date(u.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td style={{ padding: '14px 16px', borderRight: '1px solid #f1f5f9' }}>
                          {u.cacs_doc_url ? (
                            <a href={u.cacs_doc_url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 700, color: '#2563eb', textDecoration: 'none', padding: '4px 10px', borderRadius: 6, background: '#eff6ff', border: '1px solid #bfdbfe' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                              View PDF
                            </a>
                          ) : <span style={{ color: '#cbd5e1', fontSize: 12 }}>None</span>}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                            {u.cacs_status !== 'approved' && (
                              <button
                                onClick={() => setStatus(u.id, 'approved')}
                                disabled={approving === u.id}
                                style={{ padding: '6px 14px', borderRadius: 7, background: approving === u.id ? '#e2e8f0' : '#059669', color: approving === u.id ? '#94a3b8' : '#fff', fontWeight: 700, fontSize: 12, border: 'none', cursor: approving === u.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                              >
                                {approving === u.id ? '…' : 'Approve'}
                              </button>
                            )}
                            {u.cacs_status !== 'rejected' && (
                              <button
                                onClick={() => setStatus(u.id, 'rejected')}
                                disabled={rejecting === u.id}
                                style={{ padding: '6px 14px', borderRadius: 7, background: rejecting === u.id ? '#e2e8f0' : '#fff', color: rejecting === u.id ? '#94a3b8' : '#dc2626', fontWeight: 700, fontSize: 12, border: '1.5px solid', borderColor: rejecting === u.id ? '#e2e8f0' : '#fecaca', cursor: rejecting === u.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                              >
                                {rejecting === u.id ? '…' : 'Reject'}
                              </button>
                            )}
                            {u.cacs_status === 'approved' && (
                              <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, fontStyle: 'italic' }}>No actions</span>
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
            <div style={{ padding: '12px 20px', borderTop: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 12, color: '#94a3b8', fontWeight: 500 }}>
                Showing <strong style={{ color: '#64748b' }}>{filtered.length}</strong> of <strong style={{ color: '#64748b' }}>{users.length}</strong> users
              </p>
              <p style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 500 }}>Approval takes effect immediately · Last refreshed just now</p>
            </div>
          </div>
        </div>
      </main>

      {/* Toast notification */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 28, right: 28, padding: '12px 20px', borderRadius: 12, background: toast.ok ? '#0f172a' : '#fef2f2', border: `1px solid ${toast.ok ? 'rgba(255,255,255,0.1)' : '#fecaca'}`, color: toast.ok ? '#f8fafc' : '#991b1b', fontWeight: 700, fontSize: 13, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: 8, zIndex: 999, animation: 'slideUp 0.25s cubic-bezier(0.34,1.56,0.64,1)' }}>
          {toast.ok
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          }
          {toast.msg}
        </div>
      )}

      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { border-color: #059669 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.1) !important; }
        @media (max-width: 768px) {
          .admin-sidebar { display: none !important; }
        }
      `}</style>
    </div>
  )
}
