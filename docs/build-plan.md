# Build Plan — Production-Grade Virtual Queue

Goal: secure, good-looking, fully functional, scales to many shops, and tested — not a 2-day demo.
Built by Claude (AI developer); Ahmad supervises, owns accounts/secrets, tests on real phones, and makes product decisions.

Estimated: **~3 weeks to a launch-ready pilot**, then Phase 2 after the pilot gate. Meta verification and company paperwork run in parallel from day 1.

---

## Status (3 Nov 2026)

Code for Phases 0–7 is built and tested; Phase 8 is prepared. Everything left needs accounts,
people or decisions: see [launch-checklist.md](launch-checklist.md). PRs are stacked; merge in order.

| Phase | Status | PR |
|---|---|---|
| 0 Foundations | Done (CI fixed) | #1, #3 |
| 1 Data + security core | Done, tested on Postgres | #2 |
| 2 Design system | Done; screens built from approved mockups | #4, #5 |
| 3 Counter screen | Done: email login, live counter, TV link | #8 |
| 4 Customer page | Done: join (bot check, rate limits), live ticket | #6, #7 |
| 5 WhatsApp | Done: sender + webhook; waits for Meta template | #9 |
| 6 Shop features | Done: onboarding, settings, QR poster, invites, admin | #10–#12 |
| 7 Hardening | Done: privacy/retention, security pins + CSP, performance | #13–#15 |
| 8 Launch | Prepared: browser tests in CI, k6 script, checklist | #16 |

**Adjustments made while building** (Ahmad said to adjust the plan as needed):
- Customer joining is server-only (found a gap: the public key could call it directly).
- Live updates use one data-free broadcast per shop instead of per-page polling (cheaper at scale).
- Reorder uses up/down buttons (reliable on every tablet and screen reader); drag can come later.
- QR poster is a printable page, not a server PDF (correct Arabic shaping).
- The Supabase client loads after the customer page renders (JS budget 150 KB met: 118–122 KB).
- No-show: a per-shop limit shown to the called customer instead of an auto-cancel timer (an auto timer would flag every normal haircut, since "Next" seats directly).
- Error tracking: server-only Sentry via Next's onRequestError and a small envelope sender (no SDK in the browser; tokens masked). Needs only `SENTRY_DSN`.
- Not built yet, on purpose: women's booking mode (after the pilot, if wanted).

## Quality bar (definition of done for the whole product)

| Area | Target |
|---|---|
| Security | No shop can read or change another shop's data (proven by tests). No secrets in code. All inputs validated server-side. Rate limits on every public endpoint. |
| Scale | 1,000 shops, 10,000 concurrent customer pages, burst of 50 joins/sec — no errors, p95 API < 300 ms. |
| Speed | Customer page usable in < 2 s on a cheap Android over 3G; customer page JS < 150 KB. |
| Realtime | Queue changes visible on all screens in < 2 s. |
| Correctness | Double-tapping "Next" or two cashiers pressing at once never skips or duplicates a customer. One WhatsApp alert per entry, never two. |
| Design | Arabic-first RTL, consistent design system, works from 360 px phones to TV screens, WCAG AA contrast, Lighthouse accessibility ≥ 95. |
| Tests | Queue logic unit-tested; RLS tested; E2E for every user flow; load test passes the scale target; CI blocks merging on failure. |
| Operations | Error tracking, uptime alerts, daily backups with one tested restore. |

---

## Stack

| Part | Choice | Notes |
|---|---|---|
| App | Next.js (App Router) + TypeScript | One codebase for pages and API |
| UI | Tailwind CSS + shadcn/ui, Arabic font (IBM Plex Sans Arabic or Cairo) | RTL from the start |
| DB / Auth / Realtime | Supabase (Postgres) | Row Level Security, Realtime channels per shop |
| Hosting | Vercel Pro | Hobby plan is non-commercial |
| Supabase plan | Pro | Free plan pauses idle projects; Pro gives daily backups |
| WhatsApp | Meta Cloud API, direct | No reseller markup |
| Bot protection | Cloudflare Turnstile on the join form | Invisible for most users |
| Errors / uptime | Sentry + an uptime monitor | Alerts to Ahmad's phone |
| Tests | Vitest, Playwright, k6 | Unit / E2E / load |
| CI | GitHub Actions | Lint, typecheck, tests on every push |

Environments: **local → staging → production**, each with its own Supabase project and its own secrets.

---

## Phase 0 — Foundations (day 1)

**Ahmad:** create GitHub, Supabase (2 projects: staging, prod), Vercel, Sentry, Meta Business + WhatsApp app, domain. Start Meta business verification and commercial registry. Put secrets in `.env.local` and Vercel yourself.

**Claude:**
- [ ] Repo outside OneDrive (`C:\dev\7la2y`), Next.js + TypeScript strict, Tailwind, shadcn/ui, RTL root layout.
- [ ] `CLAUDE.md` with stack, folder layout, and rules.
- [ ] GitHub Actions: lint, typecheck, unit tests, E2E on every PR.
- [ ] Supabase migrations in the repo (no manual DB edits).

**Done when:** an empty RTL page deploys to staging through CI.

## Phase 1 — Data model and security core (days 2–3)

- [ ] Tables: `shops`, `shop_members` (owner/cashier roles), `barbers`, `customers`, `queue_entries`, `message_log`, `subscriptions`.
- [ ] Constraints: one active entry per phone per shop (partial unique index), valid status transitions, foreign keys with indexes.
- [ ] Queue actions as **Postgres functions in one transaction with row locks** (`next`, `join` — validates the shop's presence code, `no_show`, `leave`, `reorder`) — fixes double-tap and race conditions at the root.
- [ ] RLS on every table; customers never get direct table access, only through functions.
- [ ] Tests: queue functions (concurrency included) and RLS (shop A can't see shop B).

**Done when:** all queue rules are enforced by the database and tested.

## Phase 2 — Design system (day 4, then ongoing)

- [ ] Colors, type scale, spacing, components (buttons, cards, queue tile, toast) — light theme first.
- [ ] Mockups for the 4 main screens reviewed by Ahmad **before** building them.
- [ ] Logo/name placeholder until branding is decided.

**Done when:** Ahmad approves the look.

## Phase 3 — Counter screen (days 5–6)

- [ ] Login for owner and cashier (email magic link; cashier invited by owner).
- [ ] One column per barber, live via Realtime.
- [ ] "Next", "No-show", quick-add walk-in (name only), drag-to-reorder.
- [ ] Shows the current **presence code** (rotates every few minutes) so only people physically in the shop can join.
- [ ] Works on a phone and a tablet; large touch targets.
- [ ] E2E tests for every action.

## Phase 4 — Customer page (days 7–8)

- [ ] `/{shop}` from QR: name, Egyptian phone (`01` + 9 digits), barber or "anyone".
- [ ] Turnstile + rate limits per IP and per phone.
- [ ] Live position and estimated wait (average service time per barber; default 20 min until data exists).
- [ ] **In-shop joining only:** the form needs the current presence code (shown on the counter screen and TV); no remote joining, no check-in step.
- [ ] Optional checkbox "message me on WhatsApp when I'm close" (opt-in, unchecked by default) for customers who step out.
- [ ] Leave-queue button. Privacy notice and consent line on the form.
- [ ] Ends with "Want this for your shop?" link.
- [ ] Performance budget enforced in CI.

## Phase 5 — WhatsApp (days 9–10)

- [ ] Arabic utility template submitted on day 1; approved by now.
- [ ] **Outbox pattern:** queue change writes a row to `message_log`; a worker sends it. Unique key per entry ⇒ one alert max, safe to retry.
- [ ] Only customers who opted in, one alert when 2 ahead.
- [ ] Webhook: verify Meta signature (`X-Hub-Signature-256`), record delivered/failed.
- [ ] Per-shop monthly alert counter (for cost and future usage pricing).
- [ ] Alert if failure rate spikes.

## Phase 6 — Remaining Phase 1 features (days 11–12)

- [ ] Shop onboarding: sign up, add barbers, print QR poster (A5 PDF).
- [ ] Waiting-room TV display `/{shop}/tv` (read-only, large type, auto-refresh, no login needed beyond a secret link).
- [ ] Owner settings: hours, barbers on/off today, open/close the queue.
- [ ] Super-admin panel: shops list, subscription status, record manual payments (InstaPay / Vodafone Cash), alert usage.

## Phase 7 — Hardening and scale (days 13–15)

- [ ] Security review (subagent) of every endpoint and RLS policy; fix findings.
- [ ] Security headers (CSP, HSTS), dependency audit in CI.
- [ ] Data retention: delete customer phone numbers after N days (decide N); "delete my data" path. Privacy policy page (PDPL 151/2020 — have a lawyer check).
- [ ] Indexes checked against real queries; connection pooling on.
- [ ] Load test with k6 against staging to the scale target; fix bottlenecks; rerun until it passes.
- [ ] Backups: confirm daily backups, do one real restore to staging.

## Phase 8 — Launch (days 16–18)

- [ ] Full E2E pass on staging + manual test on a cheap Android over mobile data.
- [ ] Promote to production.
- [ ] One friendly shop for 2–3 days; fix issues.
- [ ] Then the 5-shop pilot (step 3 in [plan.md](plan.md)).

---

## Phase 9 — After the pilot gate (Phase 2 of the proposal)

Only if the pilot meets its success criterion:
- [ ] Digital loyalty card (stamp per visit via the same QR).
- [ ] Owner reports: peak hours, barber performance, walk-aways recovered.
- [ ] Online subscription payments (Paymob / Fawry).
- [ ] Usage-based alert pricing if pilot data calls for it.

---

## How we work each day

1. Claude builds one slice on a branch, with its tests.
2. CI must pass.
3. Claude deploys a preview; Ahmad tests it on his phone and approves or asks for changes.
4. Merge to main → staging. Production only at phase ends.

**Ahmad only:** accounts, secrets, payments, Meta verification, legal, product decisions, field testing.

## Risks to the timeline

- **Meta verification** slow → pilot runs on the unverified limit (~250 unique customers/day — confirm in Meta's dashboard); scale beyond the pilot needs verification.
- **Template rejected** → reword and resubmit the same day.
- **Design back-and-forth** → mockups approved before Phase 3 to avoid rebuilding screens.
- **Load test fails** → Phase 7 has buffer; Realtime may need tuning per shop channel.

## Monthly running cost (pilot)

Vercel Pro ~$20 + Supabase Pro ~$25 + WhatsApp ~$7 for 5 shops + domain ≈ **$55/month**. Prices are from general knowledge — confirm before budgeting.

---

## Deferred: connectors (set up later, not blocking)

Supabase, Vercel and Sentry connectors are postponed. Until connected, Claude writes SQL migrations as files in `supabase/migrations/` and Ahmad applies them (or connects Supabase staging when ready). Connect, in order: Supabase (staging only) before Phase 1 is applied, Vercel at first deploy, Sentry before Phase 7.
