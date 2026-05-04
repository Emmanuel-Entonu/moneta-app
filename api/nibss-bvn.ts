import type { VercelRequest, VercelResponse } from '@vercel/node'

const NIBSS_TOKEN = process.env.VITE_MONETA_NIBSS_TOKEN ?? ''

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { bvn } = req.body as { bvn?: string }
  if (!bvn || bvn.length !== 11) return res.status(400).json({ error: 'Invalid BVN' })

  try {
    const upstream = await fetch('https://api.moneta.ng/api/v2/bvn/query', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'Accept':          'application/json',
        'X-Service-Token': NIBSS_TOKEN,
      },
      body: JSON.stringify({
        scope:        'profile',
        bvn,
        channel_code: 'mobile_app',
      }),
    })
    const text = await upstream.text()
    console.log(`[nibss-bvn] ${upstream.status}: ${text.slice(0, 300)}`)
    try {
      res.status(upstream.status).json(JSON.parse(text))
    } catch {
      res.status(upstream.status).json({ error: text.slice(0, 500) })
    }
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
