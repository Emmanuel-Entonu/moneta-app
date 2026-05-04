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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as { bvn?: string; action?: string; reference?: string; otp?: string }

  try {
    const token = await getServiceToken()

    // Step 2: OTP verification
    if (body.action === 'verify-otp') {
      const { reference, otp } = body
      if (!reference || !otp) return res.status(400).json({ error: 'reference and otp are required' })

      const upstream = await fetch('https://moneta-proxy.fly.dev/api/v2/bvn/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type':    'application/json',
          'Accept':          'application/json',
          'X-Service-Token': token,
        },
        body: JSON.stringify({ reference, otp }),
      })
      const text = await upstream.text()
      console.log(`[nibss-bvn verify-otp] ${upstream.status}: ${text}`)
      try {
        return res.status(upstream.status).json(JSON.parse(text))
      } catch {
        return res.status(upstream.status).json({ error: text.slice(0, 500) })
      }
    }

    // Step 1: Initiate BVN query → OTP sent to user's phone
    const { bvn } = body
    if (!bvn || bvn.length !== 11) return res.status(400).json({ error: 'Invalid BVN' })

    const upstream = await fetch('https://moneta-proxy.fly.dev/api/v2/bvn/query', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'Accept':          'application/json',
        'X-Service-Token': token,
      },
      body: JSON.stringify({
        scope:        'profile',
        bvn,
        channel_code: 'mobile_app',
      }),
    })
    const text = await upstream.text()
    console.log(`[nibss-bvn query] ${upstream.status}: ${text}`)
    try {
      return res.status(upstream.status).json(JSON.parse(text))
    } catch {
      return res.status(upstream.status).json({ error: text.slice(0, 500) })
    }
  } catch (e) {
    _token = null
    return res.status(500).json({ error: String(e) })
  }
}
