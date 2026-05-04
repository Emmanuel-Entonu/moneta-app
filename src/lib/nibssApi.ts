export interface BvnProfile {
  firstName: string
  surname:   string
  dob:       string
  gender:    string
  phone:     string
}

export async function queryBvn(bvn: string): Promise<BvnProfile> {
  const res = await fetch('/api/nibss-bvn', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bvn }),
  })
  const raw = await res.json()
  console.log('[nibss] raw response:', JSON.stringify(raw).slice(0, 800))

  const data = raw as Record<string, unknown>
  const ok = data.status === true || data.status === 'success' || data.status === 'SUCCESSFUL'
  if (!res.ok || !ok) {
    const msg = String(data.message ?? data.error ?? data.data ?? `BVN query failed (${res.status})`)
    throw new Error(msg)
  }

  // Profile may be nested at data.data, data.data.profile, data.profile, or at top-level data
  const d1 = data.data as Record<string, unknown> | undefined
  const profile: Record<string, unknown> =
    (d1 && typeof d1 === 'object' && !Array.isArray(d1))
      ? ((d1.profile ?? d1.bvnData ?? d1.bvn_data ?? d1.details ?? d1) as Record<string, unknown>)
      : data

  const str = (v: unknown) => (v ? String(v).trim() : '')

  const firstName = str(
    profile.firstName ?? profile.first_name ?? profile.firstname ??
    profile.FirstName ?? profile.given_name ?? profile.givenName
  )
  const surname = str(
    profile.surname ?? profile.lastName ?? profile.last_name ??
    profile.lastname ?? profile.LastName ?? profile.middleName ?? profile.family_name
  )
  // Some APIs return one combined "name" field — split it
  const fullNameField = str(profile.name ?? profile.fullName ?? profile.full_name ?? '')
  const [splitFirst = '', ...rest] = fullNameField.split(' ')

  const dob = str(
    profile.dateOfBirth ?? profile.DateOfBirth ?? profile.dob ??
    profile.date_of_birth ?? profile.birthDate ?? profile.BirthDate
  )
  const phone = str(
    profile.phoneNumber ?? profile.phone ?? profile.mobile ??
    profile.msisdn ?? profile.telephone ?? profile.phone_number
  )
  const gender = str(profile.gender ?? profile.Gender ?? profile.sex ?? '')

  return {
    firstName: firstName || splitFirst,
    surname:   surname   || rest.join(' '),
    dob,
    gender,
    phone,
  }
}
