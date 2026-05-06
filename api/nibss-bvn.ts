import type { VercelRequest, VercelResponse } from '@vercel/node'

const API_KEY = process.env.VITE_MONETA_SERVICE_KEY ?? ''

// Proxy forwards /nibss-app/* → https://app.moneta.ng/*
const QUERY_URL = 'https://moneta-proxy.fly.dev/nibss-app/api/v2/bvn/bvn_query'

async function monetaPost(url: string, payload: object) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
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

  const { bvn } = req.body as { bvn?: string }

  try {
    if (!bvn || bvn.length !== 11) return res.status(400).json({ error: 'Invalid BVN (must be 11 digits)' })

    const { status, json } = await monetaPost(QUERY_URL, {
      bvn,
      scope:        'profile',
      channel_code: 'mobile_app',
    })

    return res.status(status).json(json)
  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
