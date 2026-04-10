import type { VercelRequest, VercelResponse } from '@vercel/node'

const MONETA_BASE = 'https://api.moneta.ng/api/v2'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path = (req.query.path as string[] | undefined)?.join('/') ?? ''
  const url  = `${MONETA_BASE}/${path}`

  try {
    const upstream = await fetch(url, {
      method:  req.method ?? 'POST',
      headers: {
        'Content-Type':    'application/json',
        'Accept':          'application/json',
        ...(req.headers['x-auth-token']    ? { 'X-Auth-Token':    req.headers['x-auth-token'] as string }    : {}),
        ...(req.headers['x-service-token'] ? { 'X-Service-Token': req.headers['x-service-token'] as string } : {}),
      },
      body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
    })

    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch (e) {
    res.status(500).json({ error: (e as Error).message })
  }
}
