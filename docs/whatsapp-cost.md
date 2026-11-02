# WhatsApp Business Cost — Egypt

Checked 2026-10-31. Rates are Meta list prices per **delivered** message, rate card effective **Oct 1, 2026**, from aggregators (two agree). Confirm against Meta's official rate-card CSV before budgeting.

## Rates (USD per message, Egypt)

| Category | Rate | Use for us |
|---|---|---|
| Utility (template) | $0.0036 | "Your turn is close" alert, any time |
| Service (free-form, inside 24h window) | $0.0036 | Reply after customer messages first |
| Marketing | $0.0644 | Avoid — never use for alerts |
| Authentication | $0.0036 | Not needed |

Messages **from** customers are free.

## What changed on Oct 1, 2026 (important)

- Utility templates sent inside the 24h customer service window are **no longer free**.
- Service messages: only the **first 1,000 per business phone number per month** are free, then $0.0036.
- Result: the "customer messages first, replies are free" idea from the review **no longer works**. The only remaining free path is Click-to-WhatsApp ads (free replies for up to 7 days), which doesn't fit a QR flow.

## Cost per shop per month

Messages/month = customers/day × alerts per customer × 30. Cost = messages × $0.0036.

| Scenario | Messages/month | Cost/month |
|---|---|---|
| 30 customers/day, 2 alerts each | 1,800 | **$6.48** |
| 30 customers/day, 1 alert each | 900 | $3.24 |
| 30/day, only remote joiners alerted (~40%), 1 alert | 360 | $1.30 |
| 15 customers/day, 1 alert | 450 | $1.62 |

Not included: VAT (one source says 14% may apply — unconfirmed), provider markup if using a BSP instead of Meta's Cloud API directly, and the 1,000 free service messages (shared across all shops if we use one number).

## Against the planned price

At EGP 100–200/month (convert at the current EGP/USD rate — check before use), the **2-alerts-for-everyone** design can cost about as much as, or more than, the subscription. It does not work.

## Decisions this forces

1. **One alert, not two.** Send only "you're next / 2 ahead".
2. **Alert only remote joiners.** People waiting inside see the live page and the TV display; they don't need WhatsApp.
3. **Free channels first.** The customer web page shows live position at no cost; add browser push (free) as an option.
4. **Use Meta Cloud API directly** — no BSP per-message markup. Budget time for Meta business verification.
5. **Price on usage if needed:** e.g. Basic includes N alerts/month, overage billed. Set N from pilot data.
6. **Pilot must measure:** customers/day per shop and the share who join remotely — these drive the real cost.

## Sources

- [Meta — WhatsApp Business Platform pricing](https://developers.facebook.com/docs/whatsapp/pricing)
- [Nonito — WhatsApp API pricing in Egypt](https://www.nonito.io/whatsapp-business-api-pricing/egypt)
- [ChatMaxima — WhatsApp API pricing Egypt](https://chatmaxima.com/whatsapp-api-pricing/egypt/)
- [wSmartSender — WhatsApp API pricing Egypt](https://wsmartsender.com/whatsapp-api-pricing/egypt)
