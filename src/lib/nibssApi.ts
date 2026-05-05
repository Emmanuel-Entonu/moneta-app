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

// Step 1 — sends OTP to the BVN owner's phone, returns a reference for step 2
export async function initiateBvn(bvn: string): Promise<BvnInitResult> {
  const res = await fetch('/api/nibss-bvn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bvn }),
  })
  const text = await res.text()
  console.log('[nibss initiate] status:', res.status)
  console.log('[nibss initiate] raw text:', text)

  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(text) as Record<string, unknown>
  } catch {
    throw new Error(`BVN query returned non-JSON (${res.status}): ${text.slice(0, 300)}`)
  }

  const ok = raw.status === true || raw.status === 'success' || raw.status === 'SUCCESSFUL'
  if (!ok) {
    throw new Error(String(raw.message ?? raw.error ?? `BVN query failed (${res.status})`))
  }

  // The proxy always injects customer_reference into a successful Step 1 response
  const reference = String(raw.customer_reference ?? '')
  console.log('[nibss initiate] customer_reference:', reference)

  if (!reference) {
    console.error('[nibss initiate] No customer_reference in response. Keys:', Object.keys(raw))
    throw new Error(`BVN query succeeded but returned no reference. Keys: ${Object.keys(raw).join(', ')}`)
  }

  const d = raw.data as Record<string, unknown> | undefined
  const maskedPhone = String(
    d?.maskedPhone ?? d?.masked_phone ?? d?.phoneNumber ?? d?.phone ??
    raw.maskedPhone ?? ''
  )

  return { otpRequired: true, reference, maskedPhone }
}

// Step 2 — verify OTP returned from NIBSS, get the actual profile data
export async function confirmBvnOtp(reference: string, otp: string): Promise<BvnProfile> {
  const res = await fetch('/api/nibss-bvn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'get-bvn-details', reference, otp }),
  })

  const text = await res.text()
  console.log('[nibss confirm] status:', res.status)
  console.log('[nibss confirm] raw text:', text)

  let raw: Record<string, unknown>
  try {
    raw = JSON.parse(text) as Record<string, unknown>
  } catch {
    // Not JSON — surface the raw text so we know the real problem
    throw new Error(`OTP verify returned non-JSON (${res.status}): ${text.slice(0, 300)}`)
  }

  const ok = raw.status === true || raw.status === 'success' || raw.status === 'SUCCESSFUL'
  if (!res.ok || !ok) {
    throw new Error(String(raw.message ?? raw.error ?? `OTP verification failed (${res.status})`))
  }

  return parseProfile(raw)
}
