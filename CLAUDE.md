# حلاقي (7la2y) — Barbershop virtual queue

Plan and decisions live in `docs/` — start with `docs/build-plan.md`. Ahmad supervises; Claude builds.

## Product rules
- Customers join **in the shop only** (QR + rotating presence code). No remote joining, no check-in step.
- WhatsApp alert is **opt-in**, one message per entry, sent when 2 are ahead. Never more than one.
- App is a **PWA** (installable, one codebase for counter + customer). Customers pick services (prices in EGP shown before joining); wait time = sum of service minutes.
- Arabic-first, RTL, mobile-first (360 px). Egyptian phone format: `01` + 9 digits.

## Stack
Next.js (App Router, TypeScript strict) · Tailwind · Supabase (Postgres, Auth, Realtime, RLS) · Meta WhatsApp Cloud API direct · Vercel.
Next.js here has breaking changes: read `node_modules/next/dist/docs/` before using an API (see `AGENTS.md`).

## Rules
- Queue state changes happen in **Postgres functions inside one transaction with row locks**, never as multi-step client calls.
- RLS on every table. Customers reach data only through functions. Test that shop A cannot see shop B.
- Validate all input on the server. Rate-limit every public endpoint.
- No secrets in code or git. Use `.env.local` (git-ignored) and Vercel env vars. Never commit `.env*`.
- Schema changes only through migration files in `supabase/migrations/`.
- Every new logic path gets a test. CI (`lint`, `typecheck`, `test`, `build`) must pass before merge.
- Work on a branch, small slices. Do not touch production Supabase from the agent; staging only.

## Commands
`npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build`
