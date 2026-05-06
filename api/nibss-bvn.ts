import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLIENT_ID  = process.env.VITE_MONETA_CLIENT_ID     ?? ''
const CLIENT_SEC = process.env.VITE_MONETA_CLIENT_SECRET ?? ''
const NIBSS_SVC  = process.env.VITE_MONETA_SERVICE_KEY   ?? ''

const PROXY     = 'https://moneta-proxy.fly.dev/api/v2'
const QUERY_URL = `${PROXY}/bvn/query`

let _token: string | null = null

async function getToken(): Promise<string> {
  if (_token) return _token
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SEC}:${NIBSS_SVC}`).toString('base64')
  const res = await fetch(`${PROXY}/generate-access-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': creds },
  })
  const text = await res.text()
  console.log('[nibss token]', res.status, text.slice(0, 200))
  let data: { status: boolean; data?: string; message?: string }
  try { data = JSON.parse(text) as typeof data }
  catch { throw new Error(`Token service unavailable (${res.status})`) }
  if (!data.status || !data.data) throw new Error(data.message ?? 'Token request failed')
  _token = data.data
  return data.data
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { bvn } = req.body as { bvn?: string }
  if (!bvn || bvn.length !== 11) return res.status(400).json({ error: 'Invalid BVN (must be 11 digits)' })

  try {
    const token = await getToken()

    const res2 = await fetch(QUERY_URL, {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'Authorization':   `Bearer ${token}`,
        'X-Service-Token': token,
      },
      body: JSON.stringify({ bvn, scope: 'profile', channel_code: 'mobile_app' }),
    })

    const text = await res2.text()
    console.log(`[nibss] bvn/query ${res2.status}: ${text.slice(0, 400)}`)

    try {
      return res.status(res2.status).json(JSON.parse(text))
    } catch {
      return res.status(res2.status).json({ error: text.slice(0, 800) })
    }
  } catch (e) {
    _token = null
    return res.status(500).json({ error: String(e) })
  }
}
