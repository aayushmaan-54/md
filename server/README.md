# Deploy: Cloudflare Workers

# Tech Stack
- Hono
- Wrangler
- Drizzle (Postgres via Neon)
- Zod
- Upstash Redis (session cache)
- Cloudflare R2 (image storage)

# Middlewares
- secure-headers
- cors
- csrf
- body-limit (25 mb)
- zod-validator
- cf-ray (cloudflare gave us)
- prettyJSON (dev only)
- compression (cloduflare auto do it so no need explicitly)
- logging (use console.log as cloduflare obeservability does structured logs)
- ratelimit wrangler

# Fetures
- If session is expired less than 50% -> now() + 30 days so new session token.
- Notes sync is per-note now (`notes` table), not one workspace blob. Push
  sends only changed notes, each whole (no diffing), own version each.
  Delete is its own endpoint now (`DELETE /notes/:id`). See ../docs/SYNC.md.
