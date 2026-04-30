import type { VercelRequest, VercelResponse } from '@vercel/node'

const MDS_BASE  = 'https://mywealth.mds.prod.mywealthcare.io'
const API_KEY   = process.env.MDS_API_KEY ?? ''
const TENANT_ID = 'pac-sec'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = (req.query.path as string) ?? ''

  try {
    console.log(`[mds-proxy] GET ${path}`)
    const upstream = await fetch(`${MDS_BASE}${path}`, {
      headers: {
        'Accept': 'application/json',
        'x-api-key': API_KEY,
        'x-tenant-id': TENANT_ID,
      },
    })
    const data = await upstream.text()
    console.log(`[mds-proxy] response ${upstream.status}`)
    res.status(upstream.status).setHeader('Content-Type', 'application/json').send(data)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
