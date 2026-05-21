import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Whitelist of admin email addresses — add your team's emails here
const ADMIN_EMAILS = [
  'xrenegade1813@gmail.com',
]

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

type FilterTab = 'all' | 'pending' | 'approved' | 'rejected'

const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  approved:      { bg: '#f0fdf4', text: '#065f46', border: '#bbf7d0' },
  pending:       { bg: '#fffbeb', text: '#92400e', border: '#fde68a' },
  rejected:      { bg: '#fef2f2', text: '#991b1b', border: '#fecaca' },
  not_submitted: { bg: '#f8fafc', text: '#64748b', border: '#e2e8f0' },
}

function StatusBadge({ status }: { status: string | null }) {
  const s = status ?? 'not_submitted'
  const c = STATUS_COLORS[s] ?? STATUS_COLORS['not_submitted']
  return (
    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: c.bg, color: c.text, border: `1px solid ${c.border}`, whiteSpace: 'nowrap' }}>
      {s.replace(/_/g, ' ')}
    </span>
  )
}

export default function Admin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState<string | null>(null)
  const [authed, setAuthed] = useState(false)
  const [checking, setChecking] = useState(true)
  const [signingIn, setSigningIn] = useState(false)

  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [approving, setApproving] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [actionMsg, setActionMsg] = useState<{ id: string; msg: string; ok: boolean } | null>(null)
  const [search, setSearch] = useState('')

  // Check for existing session on mount
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user && ADMIN_EMAILS.includes(session.user.email ?? '')) {
        setAuthed(true)
        setChecking(false)
      } else {
        setChecking(false)
      }
    })
  }, [])

  useEffect(() => {
    if (!authed) return
    loadUsers()
  }, [authed])

  async function handleSignIn() {
    setSigningIn(true)
    setAuthError(null)
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setSigningIn(false)
    if (error || !data.user) { setAuthError(error?.message ?? 'Sign-in failed'); return }
    if (!ADMIN_EMAILS.includes(data.user.email ?? '')) {
      await supabase.auth.signOut()
      setAuthError('This account does not have admin access.')
      return
    }
    setAuthed(true)
  }

  async function loadUsers() {
    setLoading(true)
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, email, kyc_status, cacs_status, cacs_doc_url, pac_account_id, created_at')
      .order('created_at', { ascending: false })

    if (error) { console.error(error); setLoading(false); return }

    const rows: UserRow[] = (data ?? []).map((p) => ({
      id: p.id,
      full_name: p.full_name ?? null,
      email: p.email ?? null,
      kyc_status: p.kyc_status ?? null,
      cacs_status: p.cacs_status ?? null,
      cacs_doc_url: p.cacs_doc_url ?? null,
      pac_account_id: p.pac_account_id ?? null,
      created_at: p.created_at ?? null,
    }))
    setUsers(rows)
    setLoading(false)
  }

  async function setStatus(userId: string, status: 'approved' | 'rejected') {
    const setter = status === 'approved' ? setApproving : setRejecting
    setter(userId)
    setActionMsg(null)
    const { error } = await supabase.from('profiles').update({ cacs_status: status }).eq('id', userId)
    setter(null)
    if (error) {
      setActionMsg({ id: userId, msg: error.message, ok: false })
    } else {
      setActionMsg({ id: userId, msg: `${status === 'approved' ? 'Approved' : 'Rejected'} successfully`, ok: true })
      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, cacs_status: status } : u))
    }
  }

  const filtered = users.filter((u) => {
    const matchFilter = filter === 'all' || u.cacs_status === filter
    const matchSearch = !search || (u.full_name ?? '').toLowerCase().includes(search.toLowerCase()) || (u.email ?? '').toLowerCase().includes(search.toLowerCase()) || (u.pac_account_id ?? '').toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const counts = {
    all:      users.length,
    pending:  users.filter((u) => u.cacs_status === 'pending').length,
    approved: users.filter((u) => u.cacs_status === 'approved').length,
    rejected: users.filter((u) => u.cacs_status === 'rejected').length,
  }

  // ─── Auth Screen ────────────────────────────────────────────────────────────
  if (checking) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ width: 20, height: 20, border: '2px solid #e2e8f0', borderTopColor: '#059669', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ width: '100%', maxWidth: 380, background: '#fff', borderRadius: 16, padding: '36px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: '#0f172a', margin: 0 }}>Moneta Admin</h1>
              <p style={{ fontSize: 12, color: '#64748b', margin: 0, fontWeight: 500 }}>Authorized personnel only</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSignIn() }}
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, color: '#0f172a', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSignIn() }}
                style={{ width: '100%', padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 14, color: '#0f172a', boxSizing: 'border-box', outline: 'none' }}
              />
            </div>
            {authError && (
              <div style={{ padding: '10px 14px', borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', fontSize: 13, color: '#991b1b', fontWeight: 600 }}>{authError}</div>
            )}
            <button
              onClick={handleSignIn}
              disabled={signingIn}
              style={{ padding: '13px', background: signingIn ? '#e2e8f0' : 'linear-gradient(135deg,#059669,#047857)', color: signingIn ? '#94a3b8' : '#fff', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: signingIn ? 'not-allowed' : 'pointer', border: 'none', marginTop: 4 }}
            >
              {signingIn ? 'Signing in…' : 'Sign In'}
            </button>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', fontFamily: 'system-ui, sans-serif' }}>

      {/* Top bar */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2e8f0', padding: '0 24px' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            </div>
            <span style={{ fontWeight: 800, fontSize: 16, color: '#0f172a', letterSpacing: -0.3 }}>Moneta Admin</span>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500, background: '#f1f5f9', padding: '2px 8px', borderRadius: 20, border: '1px solid #e2e8f0' }}>CACS Review</span>
          </div>
          <button
            onClick={async () => { await supabase.auth.signOut(); setAuthed(false) }}
            style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 8 }}
          >
            Sign Out
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px 24px' }}>

        {/* Stat cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
          {([
            { label: 'Total Users',    val: counts.all,      color: '#0f172a', bg: '#f8fafc' },
            { label: 'Pending Review', val: counts.pending,   color: '#92400e', bg: '#fffbeb' },
            { label: 'Approved',       val: counts.approved,  color: '#065f46', bg: '#f0fdf4' },
            { label: 'Rejected',       val: counts.rejected,  color: '#991b1b', bg: '#fef2f2' },
          ] as const).map(({ label, val, color, bg }) => (
            <div key={label} style={{ background: bg, borderRadius: 14, padding: '18px 20px', border: '1px solid #e2e8f0' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#64748b', marginBottom: 8 }}>{label}</p>
              <p style={{ fontSize: 32, fontWeight: 900, color, letterSpacing: -1 }}>{val}</p>
            </div>
          ))}
        </div>

        {/* Table card */}
        <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0', overflow: 'hidden' }}>

          {/* Table header row */}
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['all', 'pending', 'approved', 'rejected'] as FilterTab[]).map((t) => (
                <button key={t} onClick={() => setFilter(t)} style={{ padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filter === t ? '#0f172a' : '#f8fafc', color: filter === t ? '#fff' : '#64748b', border: `1px solid ${filter === t ? '#0f172a' : '#e2e8f0'}`, textTransform: 'capitalize', transition: 'all 0.15s' }}>
                  {t} {t !== 'all' ? `(${counts[t]})` : `(${counts.all})`}
                </button>
              ))}
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search name / email / PAC ID…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: '8px 14px', borderRadius: 10, border: '1.5px solid #e2e8f0', fontSize: 13, color: '#0f172a', width: 220, outline: 'none' }}
              />
              <button onClick={loadUsers} style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.51"/></svg>
                Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>Loading users…</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>No users match this filter.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
                    {['Name / Email', 'PAC Account ID', 'KYC Status', 'CACS Status', 'Joined', 'Document', 'Actions'].map((h) => (
                      <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontWeight: 700, color: '#64748b', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((u, i) => (
                    <tr key={u.id} style={{ borderBottom: i < filtered.length - 1 ? '1px solid #f1f5f9' : 'none', background: i % 2 === 0 ? '#fff' : '#fafbfd' }}>
                      <td style={{ padding: '13px 16px', whiteSpace: 'nowrap' }}>
                        <p style={{ fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{u.full_name ?? '—'}</p>
                        <p style={{ fontSize: 11, color: '#64748b', fontWeight: 500 }}>{u.email ?? <span style={{ color: '#94a3b8' }}>no email yet</span>}</p>
                      </td>
                      <td style={{ padding: '13px 16px', fontFamily: 'monospace', fontSize: 12, color: '#374151', whiteSpace: 'nowrap' }}>
                        {u.pac_account_id ?? <span style={{ color: '#94a3b8' }}>—</span>}
                      </td>
                      <td style={{ padding: '13px 16px' }}><StatusBadge status={u.kyc_status} /></td>
                      <td style={{ padding: '13px 16px' }}><StatusBadge status={u.cacs_status} /></td>
                      <td style={{ padding: '13px 16px', color: '#64748b', whiteSpace: 'nowrap', fontSize: 12 }}>
                        {u.created_at ? new Date(u.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        {u.cacs_doc_url ? (
                          <a href={u.cacs_doc_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 700, color: '#059669', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                            View PDF
                          </a>
                        ) : <span style={{ color: '#94a3b8', fontSize: 12 }}>None</span>}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        {actionMsg?.id === u.id && (
                          <span style={{ fontSize: 11, fontWeight: 700, color: actionMsg.ok ? '#059669' : '#ef4444', marginRight: 8 }}>{actionMsg.msg}</span>
                        )}
                        {u.cacs_status !== 'approved' && (
                          <button
                            onClick={() => setStatus(u.id, 'approved')}
                            disabled={approving === u.id}
                            style={{ padding: '6px 14px', borderRadius: 8, background: approving === u.id ? '#e2e8f0' : '#f0fdf4', color: approving === u.id ? '#94a3b8' : '#059669', fontWeight: 700, fontSize: 12, border: '1.5px solid', borderColor: approving === u.id ? '#e2e8f0' : '#bbf7d0', cursor: approving === u.id ? 'not-allowed' : 'pointer', marginRight: 6, whiteSpace: 'nowrap' }}
                          >
                            {approving === u.id ? '…' : 'Approve'}
                          </button>
                        )}
                        {u.cacs_status !== 'rejected' && (
                          <button
                            onClick={() => setStatus(u.id, 'rejected')}
                            disabled={rejecting === u.id}
                            style={{ padding: '6px 14px', borderRadius: 8, background: rejecting === u.id ? '#e2e8f0' : '#fef2f2', color: rejecting === u.id ? '#94a3b8' : '#dc2626', fontWeight: 700, fontSize: 12, border: '1.5px solid', borderColor: rejecting === u.id ? '#e2e8f0' : '#fecaca', cursor: rejecting === u.id ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}
                          >
                            {rejecting === u.id ? '…' : 'Reject'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ marginTop: 16, fontSize: 11, color: '#94a3b8', textAlign: 'center' }}>
          Approving a user sets their CACS status to "approved" and enables trading. Changes take effect immediately.
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input:focus { border-color: #059669 !important; box-shadow: 0 0 0 3px rgba(5,150,105,0.1); }
      `}</style>
    </div>
  )
}
