import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLIENT_ID  = process.env.VITE_MONETA_CLIENT_ID     ?? ''
const CLIENT_SEC = process.env.VITE_MONETA_CLIENT_SECRET ?? ''
const NIBSS_SVC  = process.env.VITE_MONETA_SERVICE_KEY   ?? ''

const PROXY      = 'https://moneta-proxy.fly.dev/api/v2'
const QUERY_URL  = `${PROXY}/bvn/query`

let _token: string | null = null

async function getToken(): Promise<string> {
  if (_token) return _token
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SEC}:${NIBSS_SVC}`).toString('base64')
  const res = await fetch(`${PROXY}/generate-access-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': creds },
  })
  const text = await res.text()
  console.log('[nibss token]', res.status, text.slice(0, 400))
  let data: { status: boolean; data?: string; message?: string }
  try {
    data = JSON.parse(text) as typeof data
  } catch {
    throw new Error(`BVN service unavailable (status ${res.status}). Please try again shortly.`)
  }
  if (!data.status || !data.data) throw new Error(data.message ?? 'BVN token request failed')
  _token = data.data
  return data.data
}

async function monetaPost(url: string, token: string, payload: object) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'Authorization':   `Bearer ${token}`,
      'X-Service-Token': token,
    },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  console.log(`[nibss] ${url.split('/').pop()} ${res.status}: ${text.slice(0, 400)}`)
  try {
    return { status: res.status, json: JSON.parse(text) }
  } catch {
    return { status: res.status, json: { error: text.slice(0, 800) } }
  }
}

const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
function makeRef() {
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as { bvn?: string; account_number?: string; bank_code?: string }
  const { bvn, account_number, bank_code } = body

  if (!bvn || bvn.length !== 11)          return res.status(400).json({ error: 'Invalid BVN (must be 11 digits)' })
  if (!account_number || !bank_code)       return res.status(400).json({ error: 'account_number and bank_code are required' })

  try {
    const token = await getToken()
    const { status, json } = await monetaPost(QUERY_URL, token, {
      bvn,
      bvn_query_type:     'casual',
      customer_reference: makeRef(),
      account_number,
      bank_code,
      scope:              'accounts',
      channel_code:       'mobile_app',
    })
    return res.status(status).json(json)
  } catch (e) {
    _token = null
    return res.status(500).json({ error: String(e) })
  }
}
