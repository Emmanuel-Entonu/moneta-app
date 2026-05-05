import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLIENT_ID  = process.env.VITE_MONETA_CLIENT_ID     ?? ''
const CLIENT_SEC = process.env.VITE_MONETA_CLIENT_SECRET ?? ''
const NIBSS_SVC  = process.env.VITE_MONETA_NIBSS_TOKEN   ?? ''

const PROXY = 'https://moneta-proxy.fly.dev/api/v2'

let _token: string | null = null

async function getToken(): Promise<string> {
  if (_token) return _token
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SEC}:${NIBSS_SVC}`).toString('base64')
  const res = await fetch(`${PROXY}/generate-access-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': creds },
  })
  const text = await res.text()
  console.log('[nibss token]', res.status, text)
  const data = JSON.parse(text) as { status: boolean; data?: string; message?: string }
  if (!data.status || !data.data) throw new Error(data.message ?? 'Token failed')
  _token = data.data
  return data.data
}

async function proxyPost(path: string, token: string, payload: object) {
  const res = await fetch(`${PROXY}/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'Accept':          'application/json',
      'X-Service-Token': token,
    },
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  console.log(`[nibss ${path}] ${res.status}: ${text}`)
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

    // ── Step 2: verify OTP → returns real BVN data ────────────────────────────
    if (body.action === 'verify-otp') {
      const { reference, otp } = body
      if (!reference || !otp) return res.status(400).json({ error: 'reference and otp required' })
      const { status, json } = await proxyPost('bvn/getBvnDetails', token, {
        customer_reference: reference,
        code:               otp,
        scope:              'accounts',
      })
      return res.status(status).json(json)
    }

    // ── Step 1: send OTP to BVN-linked phone ─────────────────────────────────
    const { bvn } = body
    if (!bvn || bvn.length !== 11) return res.status(400).json({ error: 'Invalid BVN' })

    const { status, json } = await proxyPost('bvn/query', token, {
      bvn,
      bvn_query_type: 'basic',
      scope:          'accounts',
      channel_code:   'mobile_app',
    })

    // Lift customer_reference to top level for the client
    if (status >= 200 && status < 300 && json && typeof json === 'object') {
      const d = (json as Record<string, unknown>).data as Record<string, unknown> | undefined
      const ref = d?.customer_reference
      if (ref) (json as Record<string, unknown>).customer_reference = ref
    }

    return res.status(status).json(json)

  } catch (e) {
    _token = null
    return res.status(500).json({ error: String(e) })
  }
}
