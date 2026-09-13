# Client

Vite + TypeScript SPA, no framework — vanilla DOM, no virtual DOM, no React/Vue/Svelte. See the root [README](../README.md) for what the app actually does; this file is about how this half is built.

## Tech stack

| Purpose | Package | Version |
| --- | --- | --- |
| Build tool | `vite` | ^8.2.0 |
| Language | `typescript` | ~6.0.2 |
| Editor | `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`, `@codemirror/lang-markdown`, `@codemirror/language`, `@codemirror/language-data` | ^6.x |
| Editor syntax highlighting | `@lezer/highlight` | ^1.2.3 |
| Markdown parsing | `marked` | ^18.0.11 |
| HTML sanitization | `dompurify` | ^3.4.14 |
| Preview code highlighting | `shiki` (core + JS regex engine, not the default WASM build) | ^4.4.3 |
| Zip export/import | `fflate` | ^0.8.3 |

No UI framework, no state management library, no CSS framework. Storage is IndexedDB (via a small hand-written wrapper, `src/storage/db.ts`), not a library like Dexie.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc` (typecheck only, no emit) then `vite build` |
| `npm run preview` | Serve the production build locally |
| `npm run generate:syntax-colors` | Regenerates `src/editor/syntax-colors.generated.ts` from Shiki's `github-light`/`github-dark` themes — re-run this after bumping the `shiki` dependency |

## Environment

Copy `.env.example` to `.env` for local dev — it already points at the server's default local port:

```
VITE_API_BASE=http://localhost:8787/api/v1
```

For a production build, this needs to point at your *actual deployed* API URL — either commit a `.env.production` with the real value, or set `VITE_API_BASE` as a build-time environment variable in whatever CI/host builds the client (e.g. Cloudflare Pages' dashboard). Vite bakes this in at build time; there's no runtime way to change it afterward. `.env` itself is gitignored (`.env.example` is the tracked template) — don't put anything sensitive in it anyway, since anything in a client bundle is public regardless.

## Architecture notes

- **Local-first, for real**: every read/write goes through IndexedDB first (`src/storage/`); the server (`src/api/`) is only ever touched by explicit user action (login, push, pull, image upload). The app is fully usable offline.
- **Two independent syntax-highlighting paths**: the live editor highlights via CodeMirror 6 (`@codemirror/language` + a small 14-color table auto-generated from Shiki's themes, `src/editor/highlight.ts`) — this is *not* Shiki, just Lezer's own tokenizer. The *rendered preview's* code blocks use actual Shiki (`src/preview/shiki.ts`), lazy-loaded and idle-prefetched after boot so it never blocks first paint, but still warm by the time you likely need it.
- **Images**: pasted/dropped images are converted to WebP client-side (`src/images/convert.ts`, capped at 2000px on the longest side), stored as blobs in IndexedDB under a `local-image:<uuid>` pseudo-URL, and uploaded to the server in the background as a separate, best-effort step — a logged-out or offline user still gets a fully working local-only image.
- **Themes and fonts** live in `src/lib/appearance.ts` + `src/styles/theme.css`, purely as CSS custom properties toggled via `data-theme`/`data-font` attributes on `<html>` — switching either is a zero-JS-recalculation attribute flip. Currently: 6 base themes (sage/iris/frost/paper/sepia light, pine/carbon/plum/oled dark) and 6 fonts (JetBrains Mono, IBM Plex Mono, Inter, system sans, Source Serif 4, OpenDyslexic).
- **`reference.html`** (repo root, not under `client/`) is a standalone, zero-build-step HTML/JS/CSS prototype of this same app — CDN-loaded `marked`/`dompurify`, its own from-scratch sync logic. It predates this Vite/TypeScript client and isn't wired into the build; it's kept around as an early design reference, not a second entry point.
