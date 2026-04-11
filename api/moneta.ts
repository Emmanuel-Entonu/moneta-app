import type { VercelRequest, VercelResponse } from '@vercel/node'

const MONETA_BASE = 'https://api.moneta.ng/api/v2'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Allow cross-origin requests from the app
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Auth-Token,X-Service-Token')
  if (req.method === 'OPTIONS') { res.status(204).end(); return }

  try {
    // req.query.path is a string at runtime, not an array — safe coercion
    const rawPath = req.query.path
    const path = Array.isArray(rawPath) ? rawPath.join('/') : (rawPath ?? '')
    const url = `${MONETA_BASE}/${path}`

    const upstream = await fetch(url, {
      method:  req.method ?? 'POST',
      headers: {
        'Content-Type':    'application/json',
        'Accept':          'application/json',
        ...(req.headers['x-auth-token']    ? { 'X-Auth-Token':    req.headers['x-auth-token'] as string }    : {}),
        ...(req.headers['x-service-token'] ? { 'X-Service-Token': req.headers['x-service-token'] as string } : {}),
      },
      body: req.method !== 'GET' && req.body ? JSON.stringify(req.body) : undefined,
    })

    let data: unknown
    const ct = upstream.headers.get('content-type') ?? ''
    if (ct.includes('application/json')) {
      data = await upstream.json()
    } else {
      data = { raw: await upstream.text() }
    }

    res.status(upstream.status).json(data)
  } catch (e) {
    console.error('[moneta proxy]', e)
    res.status(500).json({ error: (e as Error).message })
  }
}
