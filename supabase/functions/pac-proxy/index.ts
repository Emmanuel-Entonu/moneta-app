import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const PAC_BASE = 'https://api.dev.mywealthcare.io'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pac-path, x-pac-method, x-pac-body',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS })
  }

  try {
    const path    = req.headers.get('x-pac-path') ?? ''
    const method  = req.headers.get('x-pac-method') ?? 'GET'
    const body    = req.headers.get('x-pac-body') ?? undefined
    const token   = req.headers.get('x-pac-token') ?? ''
    const tenant  = 'pac'

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-tenant-id': tenant,
    }
    if (token) headers['Authorization'] = `Bearer ${token}`

    const res = await fetch(`${PAC_BASE}${path}`, {
      method,
      headers,
      body: body || undefined,
    })

    const data = await res.text()
    return new Response(data, {
      status: res.status,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
