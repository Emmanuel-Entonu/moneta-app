/**
 * Moneta Payment Gateway — Production API
 * https://api.moneta.ng/api/v2
 *
 * Auth:
 *   1. btoa(client_id:client_secret:service_key) → POST /generate-access-token
 *   2. Use returned token as X-Service-Token on all subsequent requests
 *
 * Hash: HMAC-SHA512(email + amount + payment_type + callback_url, mac_key)
 */

const BASE       = '/moneta-proxy/api/v2'
const CLIENT_ID  = import.meta.env.VITE_MONETA_CLIENT_ID     as string
const CLIENT_SEC = import.meta.env.VITE_MONETA_CLIENT_SECRET as string
const SVC_KEY    = import.meta.env.VITE_MONETA_SERVICE_KEY   as string
const MAC_KEY    = import.meta.env.VITE_MONETA_MAC_KEY       as string

const CALLBACK_URL = `${window.location.origin}/payment/callback`

// ─── Token exchange ───────────────────────────────────────────────────────────

let _token: string | null = null

async function getServiceToken(): Promise<string> {
  if (_token) return _token

  const creds = btoa(`${CLIENT_ID}:${CLIENT_SEC}:${SVC_KEY}`)
  const res = await fetch(`${BASE}/generate-access-token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Token': creds,
    },
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Moneta auth failed (${res.status}): ${text}`)
  }

  const data = await res.json() as { status: boolean; data?: string; message?: string }
  if (!data.status || !data.data) throw new Error(data.message ?? 'Token exchange failed')
  _token = data.data
  return _token
}

// ─── HMAC-SHA512 hash ─────────────────────────────────────────────────────────

async function generateHash(email: string, amount: number, paymentType: string): Promise<string> {
  const message = email + amount + paymentType + CALLBACK_URL
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(MAC_KEY),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type PaymentType = 'card' | 'bank-transfer' | 'ussd'

// ─── Initialize payment ───────────────────────────────────────────────────────

/**
 * Initialize a payment. Returns the Moneta authorization URL to redirect the user to.
 * amountNaira is in Naira — converted to kobo internally.
 */
export async function initializePayment(
  email: string,
  amountNaira: number,
  paymentType: PaymentType,
): Promise<{ reference: string; authorizationUrl: string }> {
  const token  = await getServiceToken()
  const amount = Math.round(amountNaira * 100) // naira → kobo
  const hash   = await generateHash(email, amount, paymentType)

  const res = await fetch(`${BASE}/transaction/initialize`, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'X-Service-Token': token,
    },
    body: JSON.stringify({
      amount,
      email,
      payment_type: paymentType,
      hash,
      callback_url: CALLBACK_URL,
      json: true, // return JSON instead of doing a server-side redirect
    }),
  })

  if (!res.ok) {
    // Clear cached token on auth failure so next attempt re-exchanges
    if (res.status === 401 || res.status === 422) _token = null
    const text = await res.text()
    throw new Error(`Payment init failed (${res.status}): ${text}`)
  }

  // Response: { status: "success", responseCode: "00", ref_no: "...", authorization_url: "..." }
  const data = await res.json() as {
    status: string | boolean
    responseCode?: string
    ref_no?: string
    reference?: string
    authorization_url?: string
    message?: string
  }

  const ok = data.status === 'success' || data.status === true || data.responseCode === '00'
  if (!ok) throw new Error(data.message ?? 'Payment initialisation failed')

  const reference = data.ref_no ?? data.reference ?? ''
  let authorizationUrl = data.authorization_url ?? ''

  // authorization_url can be a relative path — prefix with production base
  if (authorizationUrl && !authorizationUrl.startsWith('http')) {
    authorizationUrl = `https://api.moneta.ng${authorizationUrl}`
  }

  return { reference, authorizationUrl }
}

// ─── Verify payment ───────────────────────────────────────────────────────────

export async function verifyPayment(reference: string): Promise<{
  success: boolean
  amountNaira: number
  message: string
}> {
  const token = await getServiceToken()
  const res = await fetch(`${BASE}/transaction/charge/verify/reference`, {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'X-Service-Token': token,
    },
    body: JSON.stringify({ reference }),
  })

  if (!res.ok) throw new Error(`Verify failed (${res.status})`)

  const data = await res.json() as {
    status: string | boolean
    data?: { amount?: number; reference?: string }
    message?: string
  }

  const success = data.status === 'success' || data.status === true
  return {
    success,
    amountNaira: (data.data?.amount ?? 0) / 100, // kobo → naira
    message: data.message ?? (success ? 'Payment successful' : 'Payment failed'),
  }
}

export const MONETA_CONFIGURED = !!(CLIENT_ID && CLIENT_SEC && SVC_KEY && MAC_KEY)
