// Moneta Static IP Proxy
// Deploy this on any server with a static IP (Oracle Cloud Free, Fly.io, etc.)
// Then set VITE_MONETA_PROXY_URL=http://your-server-ip:3001 in Vercel env vars

const express = require('express')
const app = express()
app.use(express.json())

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Auth-Token,X-Service-Token')
  if (req.method === 'OPTIONS') return res.status(204).end()
  next()
})

app.get('/ip', async (req, res) => {
  const r = await fetch('https://api.ipify.org?format=json')
  const data = await r.json()
  res.json(data)
})

app.all('/api/v2/*', async (req, res) => {
  const url = `https://api.moneta.ng${req.path}${req.url.includes('?') ? '?' + req.url.split('?')[1] : ''}`
  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(req.headers['x-auth-token']    && { 'X-Auth-Token':    req.headers['x-auth-token'] }),
        ...(req.headers['x-service-token'] && { 'X-Service-Token': req.headers['x-service-token'] }),
      },
      body: req.method !== 'GET' && req.body ? JSON.stringify(req.body) : undefined,
    })
    const data = await upstream.json()
    res.status(upstream.status).json(data)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.listen(3001, () => console.log('Moneta proxy running on port 3001'))
