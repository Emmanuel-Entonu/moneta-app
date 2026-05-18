import type { VercelRequest, VercelResponse } from '@vercel/node'

const APP_ID     = process.env.DOJAH_APP_ID     ?? ''
const SECRET_KEY = process.env.DOJAH_SECRET_KEY ?? ''
const BASE_URL   = 'https://api.dojah.io'

function dojahHeaders(): Record<string, string> {
  return {
    'Content-Type':  'application/json',
    'Accept':        'application/json',
    'AppId':         APP_ID,
    'Authorization': SECRET_KEY,
  }
}

async function dojahPost(path: string, body: object) {
  const url = `${BASE_URL}${path}`
  console.log(`[bvn] POST ${url}`, JSON.stringify(body).slice(0, 200))
  const res = await fetch(url, {
    method:  'POST',
    headers: dojahHeaders(),
    body:    JSON.stringify(body),
  })
  const text = await res.text()
  console.log(`[bvn] ${path} status=${res.status}:`, text.slice(0, 600))
  let json: unknown
  try { json = JSON.parse(text) }
  catch { json = { error: `non-JSON (${res.status}): ${text.slice(0, 300)}` } }
  return { status: res.status, json: json as Record<string, unknown> }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' })

  if (!APP_ID || !SECRET_KEY) {
    return res.status(500).json({ error: 'Dojah credentials not configured (DOJAH_APP_ID / DOJAH_SECRET_KEY)' })
  }

  const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as {
    action?:    string
    bvn?:       string
    reference?: string
    otp?:       string
  }
  const action = String(body.action ?? 'query').trim().toLowerCase()

  console.log('[bvn] action=', action)

  try {
    if (action === 'query') {
      const { bvn } = body
      if (!bvn || bvn.length !== 11) return res.status(400).json({ error: 'Invalid BVN (must be 11 digits)' })

      const { status, json } = await dojahPost('/api/v1/kyc/bvn/send/otp', { bvn })

      // Dojah returns { entity: { reference_id: "..." } }
      // KYC.tsx looks for: data.reference / data.ref / data.customer_reference
      const entity = (json.entity ?? {}) as Record<string, unknown>
      const referenceId = entity.reference_id ?? entity.referenceId

      if (!referenceId) {
        const errMsg = String((json.error as string) ?? (json.message as string) ?? 'BVN lookup failed — please check your BVN and try again')
        console.warn('[bvn] no reference_id. response:', JSON.stringify(json).slice(0, 600))
        return res.status(status >= 400 ? status : 502).json({ error: errMsg })
      }

      return res.status(200).json({
        status: true,
        data: { reference: String(referenceId) },
      })
    }

    if (action === 'verify-otp') {
      const { reference, otp } = body
      if (!reference || !otp) return res.status(400).json({ error: 'reference and otp required' })

      const { status, json } = await dojahPost('/api/v1/kyc/bvn/verify/otp', {
        reference_id: reference,
        otp,
      })

      // Dojah returns { entity: { first_name, last_name, date_of_birth, ... } }
      // KYC.tsx reads: data.first_name, data.surname ?? data.last_name, data.date_of_birth ?? data.dob
      const entity = (json.entity ?? {}) as Record<string, unknown>

      if (status < 200 || status >= 300 || !entity.first_name) {
        const errMsg = String((json.error as string) ?? (json.message as string) ?? 'OTP verification failed — please try again')
        return res.status(status >= 400 ? status : 502).json({ error: errMsg })
      }

      return res.status(200).json({
        status: true,
        data: {
          first_name:    entity.first_name,
          last_name:     entity.last_name,
          surname:       entity.last_name,
          date_of_birth: entity.date_of_birth ?? entity.dob,
          dob:           entity.date_of_birth ?? entity.dob,
        },
      })
    }

    return res.status(400).json({ error: `Unknown action: ${action}` })

  } catch (e) {
    return res.status(500).json({ error: String(e) })
  }
}
