import type { VercelRequest, VercelResponse } from '@vercel/node'

const MDS_BASE = 'https://mywealth.mds.prod.mywealthcare.io'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path    = (req.query.path as string) ?? ''
  const apiKey  = (req.headers['x-mds-key'] as string) ?? ''

  try {
    console.log(`[mds-proxy] GET ${path} | key=${apiKey ? apiKey.substring(0, 6) + '...' : 'NONE'}`)
    const upstream = await fetch(`${MDS_BASE}${path}`, {
      headers: {
        'Accept': 'application/json',
        'x-api-key': apiKey,
      },
    })
    const data = await upstream.text()
    console.log(`[mds-proxy] response ${upstream.status}`)
    res.status(upstream.status).setHeader('Content-Type', 'application/json').send(data)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
