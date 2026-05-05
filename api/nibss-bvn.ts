import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLIENT_ID  = process.env.VITE_MONETA_CLIENT_ID     ?? ''
const CLIENT_SEC = process.env.VITE_MONETA_CLIENT_SECRET ?? ''

const TOKEN_URL = 'https://www.nips.moneta.ng/api/access-token'
const BVN_BASE  = 'https://staging-nips.moneta.ng'

let _token: string | null = null

async function getToken(): Promise<string> {
  if (_token) return _token
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SEC}`).toString('base64')}`,
      'Content-Type': 'application/json',
    },
  })
  const text = await res.text()
  console.log('[nibss token]', res.status, text)
  const data = JSON.parse(text) as { status: boolean; data?: string; message?: string }
  if (!data.status || !data.data) throw new Error(data.message ?? 'Token failed')
  _token = data.data
  return _token
}

async function bvnPost(path: string, token: string, payload: object) {
  const res = await fetch(`${BVN_BASE}${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
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

function makeRef(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
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
    reference?: string
    otp?: string
  }

  try {
    const token = await getToken()

    // Step 2 — verify OTP, get BVN profile
    if (body.action === 'get-bvn-details') {
      const { reference, otp } = body
      if (!reference || !otp) return res.status(400).json({ error: 'reference and otp required' })
      const { status, json } = await bvnPost('/api/bvn/getBvnDetails', token, {
        customer_reference: reference,
        code:               otp,
        scope:              'profile',
      })
      return res.status(status).json(json)
    }

    // Step 1 — onboard BVN, triggers OTP to BVN-linked phone
    const { bvn } = body
    if (!bvn || bvn.length !== 11) return res.status(400).json({ error: 'Invalid BVN' })

    const customerReference = makeRef() // exactly 12 chars as docs require

    const { status, json } = await bvnPost('/api/bvn/bvn_onboard', token, {
      bvn,
      scope:              'profile',
      channel_code:       'mobile_app',
      customer_reference: customerReference,
    })

    // Surface our reference at top level so client uses it in Step 2
    if (status >= 200 && status < 300 && json && typeof json === 'object') {
      json.customer_reference = customerReference
    }

    return res.status(status).json(json)

  } catch (e) {
    _token = null
    return res.status(500).json({ error: String(e) })
  }
}
