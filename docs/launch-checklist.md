# Launch checklist

Code side is done and tested (see `docs/performance.md`, CI). What remains needs accounts or
people. Order matters: each block unblocks the next.

## A. Accounts (Ahmad) — `docs/setup.md`
- [ ] Supabase staging (Frankfurt), migrations applied in order, platform admin row added
- [ ] Cloudflare Turnstile keys (test keys are fine for staging)
- [ ] Vercel project + env vars from `.env.example`; `CRON_SECRET` set
- [ ] Merge PRs #1 → #15 in order (each is green); `main` deploys to staging

## B. Staging checks (Claude runs, Ahmad watches)
- [ ] Re-run DB tests' security assumptions on real Supabase: anon key cannot read tables or call staff/server functions
- [ ] Confirm `x-real-ip` on Vercel is the client IP (rate limits depend on it)
- [ ] Realtime: ticket page updates within 2 s of "Next" (two phones side by side)
- [ ] `k6 run load/k6-staging.js` passes thresholds
- [ ] Full flow on a cheap Android over mobile data: QR → join → status → Next → done; WhatsApp alert received once

## C. Product decisions (Ahmad)
- [ ] Women's salons later as booking mode? (recommended)
- [x] No-show limit: per-shop setting (default 10 min) shown to the called customer; cashier presses «مجاش» (no auto-cancel: "Next" seats directly, so a timer would flag every haircut)
- [ ] Unpaid shops: show only (current) or block after N days?
- [ ] Retention 90 days OK? (`RETENTION_DAYS`)
- [ ] Look approved (mockups / `/demo`)

## D. Legal and Meta (Ahmad)
- [ ] Lawyer reviews `/privacy` (PDPL 151/2020): company name, address, contact
- [ ] Meta business verification; template `queue_near_turn` approved
- [ ] Commercial registry

## E. Production
- [ ] Supabase production project (Pro plan for daily backups), same migrations
- [ ] One real backup restore into staging
- [ ] `NEXT_PUBLIC_SITE_URL` = real domain (QR posters must not point at preview URLs)
- [ ] Sentry (not wired yet: choose server-only to keep the customer page budget)
- [ ] One friendly shop for 2–3 days → fix issues → 5-shop pilot
