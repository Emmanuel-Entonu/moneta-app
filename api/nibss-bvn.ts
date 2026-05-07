import type { VercelRequest, VercelResponse } from '@vercel/node'
import nodeFetch from 'node-fetch'
import { HttpsProxyAgent } from 'https-proxy-agent'

const CLIENT_ID  = process.env.VITE_MONETA_CLIENT_ID     ?? ''
const CLIENT_SEC = process.env.VITE_MONETA_CLIENT_SECRET ?? ''
const NIBSS_SVC  = process.env.VITE_MONETA_SERVICE_KEY   ?? ''
const FIXIE_URL  = process.env.FIXIE_URL                 ?? ''

const PROXY      = 'https://moneta-proxy.fly.dev'
const MONETA_API = 'https://api.moneta.ng'

const proxyAgent = FIXIE_URL ? new HttpsProxyAgent(FIXIE_URL) : undefined

let _token: string | null = null

function svcHeaders(token: string): Record<string, string> {
  return {
    'Content-Type':    'application/json',
    'Accept':          'application/json',
    'X-Service-Token': token,
  }
}

async function getToken(): Promise<string> {
  if (_token) return _token
  const creds = Buffer.from(`${CLIENT_ID}:${CLIENT_SEC}:${NIBSS_SVC}`).toString('base64')
  const res = await nodeFetch(`${PROXY}/api/v2/generate-access-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Auth-Token': creds },
  })
  const text = await res.text()
  console.log('[nibss token]', res.status, text.slice(0, 200))
  const data = JSON.parse(text) as { status: boolean; data?: string; message?: string }
  if (!data.status || !data.data) throw new Error(data.message ?? 'Token request failed')
  _token = data.data
  return data.data
}

async function apiPost(path: string, token: string, body: object) {
  const url = `${MONETA_API}${path}`
  const res = await nodeFetch(url, {
    method: 'POST',
    headers: svcHeaders(token),
    body: JSON.stringify(body),
    agent: proxyAgent,
  })
  const text = await res.text()
  console.log(`[nibss] POST ${path} status=${res.status}: ${text.slice(0, 600)}`)
  try { return { status: res.status, json: JSON.parse(text) } }
  catch { return { status: res.status, json: { error: `non-JSON (${res.status}): ${text.slice(0, 400)}` } } }
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const body = req.body as { action?: string; bvn?: string; reference?: string; otp?: string }

  try {
    const token = await getToken()

    if (body.action === 'verify-otp') {
      const { reference, otp } = body
      if (!reference || !otp) return res.status(400).json({ error: 'reference and otp required' })

      const step2 = await apiPost('/api/v2/bvn/verify/otp', token, {
        customer_reference: reference,
        otp,
      })
      if (!step2.json?.status) return res.status(step2.status).json(step2.json)

      await sleep(6000)

      const step3 = await apiPost('/api/v2/bvn/details', token, {
        scope:              'profile',
        customer_reference: reference,
      })
      return res.status(step3.status).json(step3.json)
    }

    const { bvn } = body
    if (!bvn || bvn.length !== 11) return res.status(400).json({ error: 'Invalid BVN (must be 11 digits)' })

    const { status, json } = await apiPost('/api/v2/bvn/query', token, {
      bvn,
      scope:        'profile',
      channel_code: 'mobile_app',
    })
    return res.status(status).json(json)

  } catch (e) {
    _token = null
    return res.status(500).json({ error: String(e) })
  }
}
