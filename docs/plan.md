# Plan — Get the Proposal Ready to Send

Each step feeds the next. See [review-summary.md](review-summary.md) for the reasoning.

## Step 1 — Verify the cost risk (1–2 days)

- [x] Check Meta's current WhatsApp Business pricing for Egypt — $0.0036/utility or service message (see [whatsapp-cost.md](whatsapp-cost.md)).
- [x] Confirm the customer-initiated `wa.me` flow is free — **it isn't** since Oct 1, 2026. Design changes to one alert, remote joiners only.
- [ ] Confirm rates against Meta's official rate-card CSV, and whether 14% VAT applies.
- [ ] Use Meta Cloud API directly (no BSP markup); note Meta business-verification time.
- [ ] Get the current EGP/USD rate and compare cost to the EGP 100–200 price.
- **Done when:** a known cost per alert and per shop/month.

## Step 2 — Owner interviews (1–2 weeks)

- [ ] Interview 10 barbershop owners, at peak hours.
- [ ] Ask: walk-aways per day, average ticket, current queue method, willingness to pay at EGP 100 / 150 / 200, how they'd pay (InstaPay, Vodafone Cash, Fawry, cash).
- [ ] Ask if they'd want a loyalty card, and how they treat regulars in the queue.
- **Done when:** ≥5 of 10 say they'd pay at the planned price (else revisit pricing or product).

## Step 3 — Numbers (2–3 days)

- [ ] Estimate barbershop count for Egypt and the target district (state the method).
- [ ] Lost revenue per shop/month = walk-aways/day × average ticket × 30.
- [ ] Unit economics table: price, WhatsApp cost, hosting, acquisition cost, gross margin, break-even shop count.

## Step 4 — Decide the ask

- [ ] Choose funding type: grant/accelerator vs. equity.
- [ ] Set amount, use of funds, and which roadmap phases it covers.
- [ ] Write team section (founder background, technical ability, advisors).

## Step 5 — Rewrite the proposal

- [ ] Executive summary: lead with lost revenue + loyalty card; include the ask.
- [ ] Problem: add interview results and lost-revenue figure.
- [ ] Competition: address Qme moving down-market; date/replace weak sources.
- [ ] Go-to-market: shops visited/week, trial-to-paid rate, cost per shop.
- [ ] Roadmap: dates and cost per phase.
- [ ] Risks: add payment collection, data protection (Law 151/2020), Meta verification, owners preferring visible crowds, reorder vs. fairness on the waiting-room display.
- [ ] Replace "network effects" with "referral-driven distribution".

## Step 6 — Send

- [ ] Shortlist recipients matching the funding type.
- [ ] Final read-through, then send.
