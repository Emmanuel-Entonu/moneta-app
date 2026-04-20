import type { VercelRequest, VercelResponse } from '@vercel/node'

const PAC_BASE = 'https://api.dev.mywealthcare.io'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const path   = (req.query.path as string) ?? ''
  const method = req.method ?? 'GET'
  const token  = (req.headers['x-pac-token'] as string) ?? ''

  const isGet = method === 'GET' || method === 'HEAD'
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'x-tenant-id': 'pac',
    ...(!isGet ? { 'Content-Type': 'application/json' } : {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const body = !isGet ? JSON.stringify(req.body) : undefined

  try {
    console.log(`[pac-proxy] ${method} ${path} | token=${token ? token.substring(0, 20) + '...' : 'NONE'}`)
    const upstream = await fetch(`${PAC_BASE}${path}`, { method, headers, body })
    const data = await upstream.text()
    console.log(`[pac-proxy] response ${upstream.status}`)
    res.status(upstream.status).setHeader('Content-Type', 'application/json').send(data)
  } catch (e) {
    res.status(500).json({ error: String(e) })
  }
}
