# Server

Cloudflare Workers API (Hono) — auth, per-note sync, and image storage. See the root [README](../README.md) for what the app does; this file is about how this half is built and deployed.

## Tech stack

| Purpose | Package | Version |
| --- | --- | --- |
| Framework | `hono` | ^4.13.3 |
| Deploy/dev CLI | `wrangler` | ^4.110.0 |
| Database ORM | `drizzle-orm` (+ `drizzle-kit`) | ^0.45.2 |
| Database driver | `@neondatabase/serverless` | ^1.1.0 |
| Validation | `zod` + `@hono/zod-validator` | ^4.4.3 / ^0.9.0 |
| Session cache | `@upstash/redis` | ^1.38.2 |
| Image storage | Cloudflare R2 (native binding, no package) | — |
| Rate limiting | Cloudflare's native Workers Rate Limiting binding (no package) | — |

Database is Postgres, hosted on [Neon](https://neon.tech) (serverless, has a real free tier); session cache is [Upstash](https://upstash.com) Redis (REST-based, also a real free tier). Neither is a Cloudflare product — this Worker just talks to both over their APIs.

## Middleware (in request order)

Global, all routes: `requestId` (keyed off the `CF-Ray` header) → request logger → `secureHeaders` → `prettyJSON` (opt-in via `?pretty`) → `timing` (non-production only).

Scoped to `/api/v1/*`: `cors` + `csrf` (both trust exactly one origin — `FRONTEND_URL`) → `bodyLimit` (25MB) → the global `API_LIMITER` rate limit (100 req/min) → `zod-validator` per-route.

`/auth/signup` and `/auth/login` additionally sit behind `AUTH_LIMITER` (5 req/min) to blunt credential-stuffing/mass account creation.

Compression and structured logging aren't middleware here — Cloudflare's edge handles compression automatically, and `console.log`/`console.error` calls are picked up as structured logs by Workers Observability (enabled in `wrangler.jsonc`) without any logging library.

## Notable design points

- **Sessions**: PBKDF2-SHA256 password hashing (via Web Crypto's `crypto.subtle`), opaque random session tokens (`crypto.getRandomValues`) — only a SHA-256 hash of the token is ever stored, never the token itself. Cookies are httpOnly, `SameSite=Lax`, `secure` only in production (so local HTTP dev still works). No JWTs, no auth library, no token ever touches browser JS.
- **Sliding session expiry**: once a session is more than 50% of the way to its TTL, the next authenticated request silently extends it back out to a full TTL and re-sets the cookie — a user who's active regularly never gets logged out; one who's inactive past the full TTL does.
- **Session lookups are Redis-cached, DB-authoritative**: every `sessionAuth` check tries Redis first (keyed by the token's hash), falling back to a Postgres join on a cache miss. Any Redis failure (read or write) is logged and degrades to a plain DB read — Upstash being down never breaks auth, it just gets slower.
- **Notes sync is per-note, not one workspace blob**: each note has its own `version` column; a push is a single-statement `INSERT ... ON CONFLICT ... WHERE version = expected` compare-and-swap — a stale write for one note is rejected and reported back as a conflict without affecting the rest of the batch (up to `MAX_NOTES_PER_PUSH` = 200 notes per call). Pull is additive-only: a note that already exists locally is never overwritten by the server's copy.
- **Images**: uploads are verified by sniffing the actual RIFF/WEBP magic bytes server-side — the client-declared `Content-Type` is never trusted. Stored in R2 under `<userId>/<imageId>`, with a 25MB-per-account quota enforced atomically via a Postgres `CHECK` constraint (a reserve-then-write pattern, with compensating rollback if the R2 write or DB insert fails partway through).
- **Rate limiting** uses Cloudflare's native Workers binding (not a Redis-based scheme) — cheap, but keyed on the `cf-connecting-ip` header, so it only really works correctly behind Cloudflare's own edge (not in a from-scratch local environment lacking that header).

## Environment

Copy `.env.example` to `.env` and fill in real values for local dev (`wrangler dev` reads it):

```
DATABASE_URL=              # Neon direct connection string — used by drizzle-kit for migrations
DATABASE_URL_POOLED=       # Neon pooled connection string — used by the running Worker
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
```

Non-secret config (`ENVIRONMENT`, `FRONTEND_URL`, `BACKEND_BASE_URL`, `SESSION_TTL_SECONDS`) lives directly in `wrangler.jsonc`'s `vars`, not `.env`.

## First-time deploy checklist

None of this is optional — skipping any one of these means the deploy is either broken or serving with the wrong config:

1. **Create the R2 buckets first** — they are not auto-created by `wrangler deploy`. From this directory:
   ```
   npx wrangler r2 bucket create md-images-dev
   npx wrangler r2 bucket create md-images
   ```
   R2 needs a payment method on file to activate at all, even though usage stays free under 10GB. Leave both buckets on their default *private* setting — nothing here ever needs public bucket access; images are only ever read through the authenticated `/images/:id` route, which streams the object server-side.
2. **Replace the placeholder production URLs** in `wrangler.jsonc`'s `env.production.vars` (`BACKEND_BASE_URL`, `FRONTEND_URL`) with your real deployed domains. CORS/CSRF and cookies all key off `FRONTEND_URL` being exactly right — a mismatch here breaks login/sync outright, silently.
3. **Push the schema** — there are no versioned migrations in this repo (no `drizzle/` folder); the workflow is direct schema sync via `npm run db:push` against `DATABASE_URL`. Run this once against your real Neon database before the first deploy, and again after any future schema change.
4. **Upload secrets**: `npm run deploy` (see `package.json`) already passes `--secrets-file .env`, so a filled-in local `.env` gets uploaded on deploy. Alternatively use `wrangler secret put <NAME> --env production` per secret.
5. **Deploy with an explicit environment**: `wrangler deploy --env production` (or `npm run deploy`, already includes it) — running bare `wrangler deploy` targets the top-level (dev-flavored) config instead, which points at `localhost` URLs and the dev R2 bucket.

Sanity-check any config change with `npx wrangler deploy --dry-run --env production` before actually deploying — it validates bindings and bundles without publishing anything, and will loudly warn about the kind of environment-inheritance mistakes `wrangler.jsonc` is easy to get subtly wrong (e.g. `ratelimits` is **not** inherited from the top level by `env.production` — it must be declared again there, or every rate-limited route throws on the very first production request).

## Maintenance

A daily cron trigger (`0 3 * * *`, see `triggers.crons`) purges expired sessions from the database — no manual cleanup needed.
