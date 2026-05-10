import type { VercelRequest, VercelResponse } from '@vercel/node'

const PAC_BASE  = process.env.VITE_BROKER_BASE_URL || 'https://api.prod.mywealthcare.io'
const TENANT_ID = process.env.VITE_PAC_TENANT_ID   || 'pac-sec'
const USERNAME  = process.env.VITE_PAC_USERNAME     || 'moneta-user'
const PASSWORD  = process.env.VITE_PAC_PASSWORD     || 'izV6ZBQkpr$$ZlGe'

let _token: string | null = null
let _tokenExpiry = 0

async function getServerToken(): Promise<string> {
  if (_token && Date.now() < _tokenExpiry) return _token
  const res = await fetch(`${PAC_BASE}/administration/api/v1/users/token/daemon`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tenant-id': TENANT_ID },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD, tenant: TENANT_ID }),
  })
  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`PAC auth failed (${res.status}): ${txt.slice(0, 200)}`)
  }
  const data = await res.json() as { token?: string; access_token?: string; expires_in?: number }
  _token = data.access_token ?? data.token ?? ''
  _tokenExpiry = Date.now() + ((data.expires_in ?? 1800) * 1000) - 60_000
  console.log('[pac-proxy] token refreshed, expires in', data.expires_in ?? 1800, 's')
  return _token
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,x-idempotency-id')
  if (req.method === 'OPTIONS') return res.status(204).end()

  const path   = (req.query.path as string) ?? ''
  const method = req.method ?? 'GET'
  const isGet  = method === 'GET' || method === 'HEAD'

  const headers: Record<string, string> = {
    'Accept':      'application/json',
    'x-tenant-id': TENANT_ID,
    ...(!isGet ? { 'Content-Type': 'application/json' } : {}),
  }

  try {
    const token = await getServerToken()
    headers['Authorization'] = `Bearer ${token}`
  } catch (e) {
    console.error('[pac-proxy] auth failed:', e)
    return res.status(401).json({ error: `PAC authentication failed: ${String(e)}` })
  }

  const idempotencyId = req.headers['x-idempotency-id'] as string | undefined
  if (idempotencyId) headers['x-idempotency-id'] = idempotencyId

  const body = !isGet ? JSON.stringify(req.body) : undefined

  try {
    console.log(`[pac-proxy] ${method} ${PAC_BASE}${path}`)
    const upstream = await fetch(`${PAC_BASE}${path}`, { method, headers, body })
    const data = await upstream.text()
    if (upstream.status >= 400) {
      console.error(`[pac-proxy] ${upstream.status} ${path} body=${data.slice(0, 600)}`)
    } else {
      console.log(`[pac-proxy] ${upstream.status} ${path}`)
    }
    if (upstream.status === 401) _token = null
    res.status(upstream.status).setHeader('Content-Type', 'application/json').send(data)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
