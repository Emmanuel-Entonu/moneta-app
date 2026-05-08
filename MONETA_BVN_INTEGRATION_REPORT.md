# BVN Integration – Status & Blockers

**Date:** 6 May 2026  
**Project:** Moneta Stock Trading App (SEC Digital Sub-Broker Demo)

---

## What We're Trying to Do

Integrate Moneta's BVN verification API into our KYC flow so users can verify their identity before trading. We have valid API credentials from Moneta and a static-IP proxy deployed on Fly.io.

---

## What's Working

**Token generation is fully working.**

- Endpoint: `POST https://api.moneta.ng/api/v2/generate-access-token`
- Auth: `X-Auth-Token: base64(CLIENT_ID:CLIENT_SECRET:SERVICE_KEY)`
- Returns a valid bearer token every time, no issues.

---

## What's Not Working

Every BVN query endpoint we've tried either returns an HTML page instead of JSON, a 404, or an IP whitelist error. Here's the full list of what we tried:

| Endpoint | Method | Result |
|----------|--------|--------|
| `staging-nips.moneta.ng/api/bvn/bvn_onboard` | Direct from Vercel | Cloudflare block (HTML 403) |
| `staging-nips.moneta.ng/api/bvn/bvn_onboard` | Via Fly.io proxy | Cloudflare block (HTML 403) |
| `www.nips.moneta.ng/api/v2/bvn/bvn_onboard` | Via proxy | Cloudflare block (HTML 403) |
| `app.moneta.ng/api/bvn/bvn_query` | Via proxy | 404 Not Found |
| `api.moneta.ng/api/v2/bvn/query` (`igree` type) | Via proxy | HTML response (not JSON) |
| `api.moneta.ng/api/v2/bvn/query` (`casual` type) | Via proxy | HTML response (not JSON) |
| `api.moneta.ng/api/v2/bvn/query` | Direct from Vercel | "IP address not whitelisted" |

The error we keep seeing on the client side is `SyntaxError: Unexpected token '<'` — meaning the API is returning an HTML page and our JSON parser chokes on it.

---

## Root Causes Identified

1. **`staging-nips.moneta.ng` has Cloudflare bot protection** that blocks server-to-server requests, even from our whitelisted proxy IP.

2. **`igree` query type appears to be browser-only.** Based on the response we're getting, it seems like `igree` triggers a web redirect/consent flow rather than an SMS OTP — it was never going to work from a server.

3. **`casual` type on `api.moneta.ng` returns HTML instead of JSON.** We're sending a correctly authenticated request (bearer token confirmed working) with a valid payload, but the response isn't JSON. Either the endpoint doesn't exist at that path, or there's something wrong with how our request is being handled.

4. **Calling `api.moneta.ng` directly from Vercel returns "IP not whitelisted"** — so we have to go through the proxy, but the proxy + BVN query combination keeps failing.

---

## Current State of the App

BVN verification is temporarily bypassed in the app with a "Skip BVN for now" button so the rest of the KYC and onboarding flow can be tested. The BVN number is still collected and stored — it just isn't verified against NIBSS.

---

## What We Need

To unblock this we need one of the following from Moneta:

- The correct server-to-server endpoint for BVN verification (with a working cURL example)
- Confirmation of whether `casual` type works on `api.moneta.ng/api/v2/bvn/query` and if so, the expected payload
- Confirmation that our proxy IP is whitelisted for BVN query endpoints (not just token generation)
- An alternative flow if `igree` is browser-only — specifically whether there's a REST endpoint that sends an OTP to the BVN-linked phone and accepts verification via API call

---

## Credentials (for reference)

- CLIENT_ID: `4pPfDvXQHnwQB6Phem6JV3JaNLxIOIl1OZlu9a6V`
- SERVICE_KEY: `mnt_voOJoZrjOAuuwxCll4Rv4U7pHGSRC6`
- Proxy IP: available on request (Fly.io static IP, already whitelisted for token generation)
