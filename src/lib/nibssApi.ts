export interface BvnProfile {
  firstName: string
  surname:   string
  dob:       string
  gender:    string
  phone:     string
}

export interface BvnInitResult {
  otpRequired: true
  reference:   string
  maskedPhone: string
}

function parseProfile(raw: Record<string, unknown>): BvnProfile {
  const str = (v: unknown) => (v ? String(v).trim() : '')

  const d1 = raw.data as Record<string, unknown> | undefined
  const profile: Record<string, unknown> =
    d1 && typeof d1 === 'object' && !Array.isArray(d1)
      ? ((d1.profile ?? d1.bvnData ?? d1.bvn_data ?? d1.details ?? d1) as Record<string, unknown>)
      : raw

  const firstName = str(
    profile.firstName ?? profile.first_name ?? profile.firstname ??
    profile.FirstName ?? profile.given_name ?? profile.givenName
  )
  const surname = str(
    profile.surname ?? profile.lastName ?? profile.last_name ??
    profile.lastname ?? profile.LastName ?? profile.family_name
  )
  const fullNameField = str(profile.name ?? profile.fullName ?? profile.full_name ?? '')
  const [splitFirst = '', ...rest] = fullNameField.split(' ')

  return {
    firstName: firstName || splitFirst,
    surname:   surname   || rest.join(' '),
    dob: str(
      profile.dateOfBirth ?? profile.DateOfBirth ?? profile.dob ??
      profile.date_of_birth ?? profile.birthDate
    ),
    gender: str(profile.gender ?? profile.Gender ?? profile.sex ?? ''),
    phone: str(
      profile.phoneNumber ?? profile.phone ?? profile.mobile ??
      profile.msisdn ?? profile.telephone ?? profile.phone_number
    ),
  }
}

// Recursively searches any object for the first string/number value whose key
// looks like a reference/session/tracking identifier.
const REF_KEY_RE = /ref|reference|session|track|request|token|id|key|correl/i
function findReference(obj: unknown, depth = 0): string {
  if (depth > 5 || obj === null || typeof obj !== 'object') return ''
  const record = obj as Record<string, unknown>

  // Priority 1 — well-known exact key names
  const priorityKeys = [
    'reference', 'ref', 'requestId', 'request_id', 'trackingId', 'tracking_id',
    'sessionId', 'session_id', 'verificationRef', 'referenceId', 'reference_id',
    'transRef', 'transactionRef', 'otpRef', 'bvnRef', 'refCode', 'correlationId',
    'reqId', 'token', 'id',
  ]
  for (const key of priorityKeys) {
    const val = record[key]
    if (typeof val === 'string' && val.length >= 4) return val
    if (typeof val === 'number' && val > 0) return String(val)
  }

  // Priority 2 — any key that matches the ref-pattern regex
  for (const [key, val] of Object.entries(record)) {
    if (REF_KEY_RE.test(key) && typeof val === 'string' && val.length >= 4) return val
    if (REF_KEY_RE.test(key) && typeof val === 'number' && val > 0) return String(val)
  }

  // Priority 3 — recurse into nested objects / arrays
  for (const val of Object.values(record)) {
    if (Array.isArray(val)) {
      for (const item of val) {
        const found = findReference(item, depth + 1)
        if (found) return found
      }
    } else if (val && typeof val === 'object') {
      const found = findReference(val, depth + 1)
      if (found) return found
    }
  }

  return ''
}

// Step 1 — sends OTP to the BVN owner's phone, returns a reference for step 2
export async function initiateBvn(bvn: string): Promise<BvnInitResult> {
  const res = await fetch('/api/nibss-bvn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bvn }),
  })
  const raw = await res.json() as Record<string, unknown>
  console.log('[nibss initiate] status:', res.status)
  console.log('[nibss initiate] raw:', JSON.stringify(raw))

  const ok = raw.status === true || raw.status === 'success' || raw.status === 'SUCCESSFUL'
    || (res.ok && raw.message !== undefined)
  if (!res.ok || !ok) {
    throw new Error(String(raw.message ?? raw.error ?? `BVN query failed (${res.status})`))
  }

  const reference = findReference(raw)
  console.log('[nibss initiate] extracted reference:', reference)

  const d = raw.data as Record<string, unknown> | undefined
  const maskedPhone = String(
    d?.maskedPhone ?? d?.masked_phone ?? d?.phoneNumber ?? d?.phone ??
    (raw as Record<string, unknown>).maskedPhone ?? ''
  )

  if (!reference) {
    // OTP was sent but the proxy didn't return any recognisable reference field.
    // Log everything so the actual keys are visible in the browser console.
    console.error('[nibss initiate] Could not find reference. Full response keys:', Object.keys(raw))
    if (d) console.error('[nibss initiate] data keys:', Object.keys(d))
    throw new Error(
      `OTP sent but no reference returned. Raw keys: ${Object.keys(raw).join(', ')}` +
      (d ? ` | data keys: ${Object.keys(d).join(', ')}` : '')
    )
  }

  return { otpRequired: true, reference, maskedPhone }
}

// Step 2 — verify OTP returned from NIBSS, get the actual profile data
export async function confirmBvnOtp(reference: string, otp: string): Promise<BvnProfile> {
  const res = await fetch('/api/nibss-bvn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'verify-otp', reference, otp }),
  })
  const raw = await res.json() as Record<string, unknown>
  console.log('[nibss confirm] status:', res.status)
  console.log('[nibss confirm] raw:', JSON.stringify(raw))

  const ok = raw.status === true || raw.status === 'success' || raw.status === 'SUCCESSFUL'
  if (!res.ok || !ok) {
    throw new Error(String(raw.message ?? raw.error ?? `OTP verification failed (${res.status})`))
  }

  return parseProfile(raw)
}
