import type { VercelRequest, VercelResponse } from '@vercel/node'

const CLIENT_ID  = process.env.VITE_MONETA_CLIENT_ID     ?? ''
const CLIENT_SEC = process.env.VITE_MONETA_CLIENT_SECRET ?? ''

function genRef(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function getNibssToken(): Promise<string> {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SEC}`).toString('base64')
  const res = await fetch('https://www.nips.moneta.ng/api/access-token', {
    headers: { 'Authorization': `Basic ${basic}`, 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`NIBSS auth failed (${res.status}): ${await res.text()}`)
  const data = await res.json() as { token?: string; access_token?: string; data?: string }
  const token = data.token ?? data.access_token ?? (typeof data.data === 'string' ? data.data : '')
  if (!token) throw new Error(`No NIBSS token in response: ${JSON.stringify(data)}`)
  return token
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { bvn } = req.body as { bvn?: string }
  if (!bvn || bvn.length !== 11) return res.status(400).json({ error: 'Invalid BVN' })

  try {
    const token = await getNibssToken()
    const upstream = await fetch('https://app.moneta.ng/api/bvn/bvn_query', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Accept':        'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        bvn,
        bvn_query_type:     'igree',
        customer_reference: genRef(),
        scope:              'profile',
        channel_code:       'mobile_app',
      }),
    })
    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
