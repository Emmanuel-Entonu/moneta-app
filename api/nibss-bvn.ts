import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLIENT_ID  = process.env.VITE_MONETA_CLIENT_ID     ?? ''
const CLIENT_SEC = process.env.VITE_MONETA_CLIENT_SECRET ?? ''
const NIBSS_SVC  = process.env.VITE_MONETA_NIBSS_TOKEN   ?? ''

let _token: string | null = null

async function getServiceToken(): Promise<string> {
  if (_token) return _token
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SEC}:${NIBSS_SVC}`).toString('base64')
  const res = await fetch('https://moneta-proxy.fly.dev/api/v2/generate-access-token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': creds },
  })
  if (!res.ok) throw new Error(`Token failed (${res.status}): ${await res.text()}`)
  const data = await res.json() as { status: boolean; data?: string; message?: string }
  if (!data.status || !data.data) throw new Error(data.message ?? 'Token exchange failed')
  _token = data.data
  return _token
}

async function proxyPost(path: string, token: string, payload: object) {
  const upstream = await fetch(`https://moneta-proxy.fly.dev/api/v2/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'Accept':          'application/json',
      'X-Service-Token': token,
    },
    body: JSON.stringify(payload),
  })
  const text = await upstream.text()
  console.log(`[nibss-bvn ${path}] ${upstream.status}: ${text}`)
  try {
    return { status: upstream.status, json: JSON.parse(text) }
  } catch {
    return { status: upstream.status, json: { error: text.slice(0, 800) } }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as {
    bvn?: string
    action?: string
    reference?: string  // customer_reference from step 1
    otp?: string        // code entered by the user
  }

  try {
    const token = await getServiceToken()

    // ── Step 2: Get BVN Details ──────────────────────────────────────────────
    // Docs: POST /api/bvn/getBvnDetails
    // Body: { customer_reference, code (the OTP), scope }
    if (body.action === 'get-bvn-details') {
      const { reference, otp } = body
      if (!reference || !otp) {
        return res.status(400).json({ error: 'customer_reference and code (OTP) are required' })
      }
      const { status, json } = await proxyPost('bvn/getBvnDetails', token, {
        customer_reference: reference,
        code:               otp,
        scope:              'profile',
      })
      return res.status(status).json(json)
    }

    // ── Step 1: BVN Query (igree) → triggers OTP to user's BVN-linked phone ─
    // Docs: POST /api/bvn/bvn_query
    // Body: { bvn, bvn_query_type, scope, channel_code, customer_reference }
    // We generate customer_reference so we control the value for Step 2.
    const { bvn } = body
    if (!bvn || bvn.length !== 11) return res.status(400).json({ error: 'Invalid BVN' })

    // Docs: customer_reference must be exactly 12 characters
    const customerReference = (Date.now().toString(36) + Math.random().toString(36).slice(2))
      .slice(0, 12).toUpperCase()

    const { status, json } = await proxyPost('bvn/query', token, {
      bvn,
      bvn_query_type:     'igree',
      scope:              'profile',
      channel_code:       'mobile_app',
      customer_reference: customerReference,
    })

    // Inject our 12-char reference so the client passes the exact same value to Step 2
    if (status >= 200 && status < 300 && json && typeof json === 'object') {
      json.customer_reference = customerReference
    }

    return res.status(status).json(json)

  } catch (e) {
    _token = null
    return res.status(500).json({ error: String(e) })
  }
}
