import type { VercelRequest, VercelResponse } from '@vercel/node'

const API_KEY = process.env.VITE_MONETA_SERVICE_KEY ?? ''

const BVN_QUERY_URL  = 'https://app.moneta.ng/api/bvn/bvn_query'
const BVN_DETAIL_URL = 'https://staging-nips.moneta.ng/api/bvn/getBvnDetails'

async function monetaPost(url: string, payload: object) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${API_KEY}`,
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
    // ── Step 2: verify OTP → returns real BVN data ───────────────────────────
    if (body.action === 'verify-otp') {
      const { reference, otp } = body
      if (!reference || !otp) return res.status(400).json({ error: 'reference and otp required' })
      const { status, json } = await monetaPost(BVN_DETAIL_URL, {
        customer_reference: reference,
        code:               otp,
        scope:              'accounts',
      })
      return res.status(status).json(json)
    }

    // ── Step 1: send OTP to BVN-linked phone ─────────────────────────────────
    const { bvn } = body
    if (!bvn || bvn.length !== 11) return res.status(400).json({ error: 'Invalid BVN' })

    const customerRef = Math.random().toString(36).slice(2, 8).toUpperCase() +
                        Math.random().toString(36).slice(2, 8).toUpperCase()

    const { status, json } = await monetaPost(BVN_QUERY_URL, {
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
    return res.status(500).json({ error: String(e) })
  }
}
