/**
 * Moneta NIBSS — BVN Verification
 * Routes through Fly.io static IP proxy (same as payment calls)
 *
 * Flow:
 *   1. initBvnVerification(bvn) → customer_reference + OTP sent to user's phone
 *   2. verifyBvnOtp(ref, otp)   → OTP confirmed
 *   3. getBvnDetails(ref)        → profile data (waits 6s as required by API)
 */

import { getServiceToken } from './monetaApi'

const PROXY_URL = (import.meta.env.VITE_MONETA_PROXY_URL as string | undefined) ?? 'https://moneta-proxy.fly.dev'

function nibssUrl(path: string) {
  return `${PROXY_URL}/api/v2${path}`
}

async function headers() {
  const token = await getServiceToken()
  return {
    'Content-Type':    'application/json',
    'Accept':          'application/json',
    'X-Service-Token': token,
  }
}

/** Step 1 — Initiate BVN query. Returns customer_reference and triggers OTP to user's phone. */
export async function initBvnVerification(bvn: string, phone?: string): Promise<string> {
  const res = await fetch(nibssUrl('/bvn/query'), {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({
      scope: 'profile',
      bvn,
      channel_code: 'mobile_app',
      ...(phone && { otp_method: phone }),
    }),
  })
  const data = await res.json() as {
    status: boolean
    data: Array<{ customer_reference: string }>
    message?: string
  }
  if (!res.ok || !data.status) throw new Error(data.message ?? `BVN query failed (${res.status})`)
  const ref = data.data?.[0]?.customer_reference
  if (!ref) throw new Error('No customer reference returned')
  return ref
}

/** Step 2 — Submit OTP received on user's phone. */
export async function verifyBvnOtp(customerReference: string, otp: string): Promise<void> {
  const res = await fetch(nibssUrl('/bvn/verify/otp'), {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({ customer_reference: customerReference, otp }),
  })
  const data = await res.json() as { status: boolean; message?: string }
  if (!res.ok || !data.status) throw new Error(data.message ?? `OTP verification failed (${res.status})`)
}

export interface BvnProfile {
  firstName: string
  surname:   string
  dob:       string
  gender:    string
  address:   string
}

/** Step 3 — Retrieve BVN profile. Waits 6s as required by the API before calling. */
export async function getBvnDetails(customerReference: string): Promise<BvnProfile> {
  await new Promise((r) => setTimeout(r, 6000))
  const res = await fetch(nibssUrl('/bvn/details'), {
    method: 'POST',
    headers: await headers(),
    body: JSON.stringify({ scope: 'profile', customer_reference: customerReference }),
  })
  const data = await res.json() as {
    status: boolean
    data?: {
      first_name?: string
      surname?:    string
      DateOfBirth?: string
      gender?:     string
      address?:    string
    }
    message?: string
  }
  if (!res.ok || !data.status) throw new Error(data.message ?? `BVN details failed (${res.status})`)
  return {
    firstName: data.data?.first_name ?? '',
    surname:   data.data?.surname    ?? '',
    dob:       data.data?.DateOfBirth ?? '',
    gender:    data.data?.gender     ?? '',
    address:   data.data?.address    ?? '',
  }
}
