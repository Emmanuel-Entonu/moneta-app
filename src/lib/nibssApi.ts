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
  const data = await res.json() as {
    status:   boolean | string
    data?: {
      firstName?:   string
      first_name?:  string
      surname?:     string
      lastName?:    string
      last_name?:   string
      dateOfBirth?: string
      DateOfBirth?: string
      dob?:         string
      gender?:      string
      phoneNumber?: string
      phone?:       string
    }
    message?: string
    error?:   string
  }
  const ok = data.status === true || data.status === 'success'
  if (!res.ok || !ok) throw new Error(data.message ?? data.error ?? `BVN query failed (${res.status})`)
  return {
    firstName: data.data?.firstName   ?? data.data?.first_name ?? '',
    surname:   data.data?.surname     ?? data.data?.lastName   ?? data.data?.last_name ?? '',
    dob:       data.data?.dateOfBirth ?? data.data?.DateOfBirth ?? data.data?.dob ?? '',
    gender:    data.data?.gender      ?? '',
    phone:     data.data?.phoneNumber ?? data.data?.phone ?? '',
  }
}
