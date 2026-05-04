const CLIENT_ID  = (import.meta.env.VITE_MONETA_CLIENT_ID     as string | undefined) ?? ''
const CLIENT_SEC = (import.meta.env.VITE_MONETA_CLIENT_SECRET as string | undefined) ?? ''

let _nibssToken: string | null = null

async function getNibssToken(): Promise<string> {
  if (_nibssToken) return _nibssToken
  const basic = btoa(`${CLIENT_ID}:${CLIENT_SEC}`)
  const res = await fetch('https://www.nips.moneta.ng/api/access-token', {
    headers: { 'Authorization': `Basic ${basic}`, 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`NIBSS auth failed (${res.status})`)
  const data = await res.json() as { token?: string; access_token?: string; data?: string }
  _nibssToken = data.token ?? data.access_token ?? (typeof data.data === 'string' ? data.data : '') ?? ''
  if (!_nibssToken) throw new Error('No NIBSS token returned')
  return _nibssToken
}

function genRef(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export interface BvnProfile {
  firstName: string
  surname:   string
  dob:       string
  gender:    string
  phone:     string
}

export async function queryBvn(bvn: string): Promise<BvnProfile> {
  const token = await getNibssToken()
  const res = await fetch('https://app.moneta.ng/api/bvn/bvn_query', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Accept':        'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      bvn,
      bvn_query_type:     'igree',
      customer_reference: genRef(),
      scope:              'profile',
      channel_code:       'mobile_app',
    }),
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
  }
  const ok = data.status === true || data.status === 'success'
  if (!res.ok || !ok) throw new Error(data.message ?? `BVN query failed (${res.status})`)
  return {
    firstName: data.data?.firstName   ?? data.data?.first_name ?? '',
    surname:   data.data?.surname     ?? data.data?.lastName   ?? data.data?.last_name ?? '',
    dob:       data.data?.dateOfBirth ?? data.data?.DateOfBirth ?? data.data?.dob ?? '',
    gender:    data.data?.gender      ?? '',
    phone:     data.data?.phoneNumber ?? data.data?.phone ?? '',
  }
}
