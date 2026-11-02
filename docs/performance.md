# Performance results

Targets from `build-plan.md`: customer page JS < 150 KB; p95 < 300 ms; 1,000 shops; bursts of 50 joins/s.

## Customer page JavaScript (checked in CI: `npm run budget`)

Brotli (how Vercel serves it), legacy `nomodule` polyfills excluded (modern phones never download them).

| Page | JS | Budget |
|---|---|---|
| `/<shop>` (QR page) | 122 KB | 150 KB |
| `/t/<token>` (ticket) | 118 KB | 150 KB |

About 114 KB of that is React + Next.js itself. The Supabase client (~56 KB) is loaded with
`import()` after the page is shown, so live updates start a moment later but the page is usable
first. Before that change the ticket page was 208 KB.

## Database under load (`npm run load:db`)

Real queue functions on Postgres 16, 1,000 shops, pool of 60 connections, 4-core cloud container
(2026-11-03). Indicative: rerun on Supabase staging before launch.

| Load | Join p95 | Next p95 | Ticket status p95 | Errors |
|---|---|---|---|---|
| Plan target: 50 joins/s, 20 nexts/s, 200 status/s | 27 ms | 25 ms | 24 ms | 0 |
| 4x target: 200 joins/s, 80 nexts/s, 800 status/s | 70 ms | 70 ms | 74 ms | 0 |

Not yet measured (needs staging): network time Egypt → Frankfurt, Vercel function cold starts,
Supabase Realtime fan-out to 10,000 open pages. The k6 test in Phase 8 covers these.
