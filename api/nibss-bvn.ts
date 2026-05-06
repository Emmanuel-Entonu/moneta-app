import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLIENT_ID  = process.env.VITE_MONETA_CLIENT_ID     ?? ''
const CLIENT_SEC = process.env.VITE_MONETA_CLIENT_SECRET ?? ''
const NIBSS_SVC  = process.env.VITE_MONETA_SERVICE_KEY   ?? ''

const PROXY       = 'https://moneta-proxy.fly.dev/api/v2'
const PROXY_ROOT  = 'https://moneta-proxy.fly.dev'
const ONBOARD_URL = `${PROXY_ROOT}/nibss-app/api/bvn/bvn_query`
const DETAIL_URL  = `${PROXY_ROOT}/nibss-app/api/bvn/getBvnDetails`

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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as { bvn?: string; action?: string; reference?: string; otp?: string }

  try {
    const token = await getToken()

    // ── Step 2: verify OTP → returns real BVN data ───────────────────────────
    if (body.action === 'verify-otp') {
      const { reference, otp } = body
      if (!reference || !otp) return res.status(400).json({ error: 'reference and otp required' })
      const { status, json } = await monetaPost(DETAIL_URL, token, {
        customer_reference: reference,
        code:               otp,
        scope:              'accounts',
      })
      return res.status(status).json(json)
    }

    // ── Step 1: send OTP to BVN-linked phone ─────────────────────────────────
    const { bvn } = body
    if (!bvn || bvn.length !== 11) return res.status(400).json({ error: 'Invalid BVN' })

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    const customerRef = Array.from({ length: 12 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('')

    const { status, json } = await monetaPost(ONBOARD_URL, token, {
      bvn,
      bvn_query_type:     'igree',
      customer_reference: customerRef,
      scope:              'accounts',
      channel_code:       'mobile_app',
    })

    // Lift customer_reference to top level so client can use it for OTP verification
    if (status >= 200 && status < 300 && json && typeof json === 'object') {
      const d = (json as Record<string, unknown>).data as Record<string, unknown> | undefined
      const ref = d?.customer_reference ?? customerRef
      ;(json as Record<string, unknown>).customer_reference = ref
    }

    return res.status(status).json(json)

  } catch (e) {
    _token = null
    return res.status(500).json({ error: String(e) })
  }
}
