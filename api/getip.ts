import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  const ip = await fetch('https://api.ipify.org?format=json').then((r) => r.json())
  res.status(200).json({ vercel_outbound_ip: ip.ip })
}
