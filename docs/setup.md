# Setup checklist (Ahmad, when ready)

Everything below is a manual step in an account only Ahmad owns. Claude has written the code to
work as soon as these exist. Do them in order; each step says what it unblocks.

## 1. Supabase staging (unblocks: real data, login, live updates)

1. supabase.com → New project → name `7la2y-staging`, region **Frankfurt (eu-central-1)** (closest to Egypt), strong DB password (save it in a password manager).
2. Apply the database: SQL editor → run each file in `supabase/migrations/` **in filename order**. (Or connect the Supabase connector to this environment and Claude applies them to staging.)
3. Realtime → Settings: keep **public channels allowed** (the app uses public broadcast pings that carry no customer data).
4. Authentication → Providers → Email: enabled (staff log in with an email link). URL configuration: add the site URL and `https://<site>/auth/callback` once Vercel exists.
5. Settings → API: copy **Project URL** and **anon public key** into Vercel / `.env.local` (see `.env.example`). Copy the **service_role key** into Vercel only, marked sensitive. Never paste it in chat.

## 2. Cloudflare Turnstile (unblocks: the join form's bot check)

1. dash.cloudflare.com → Turnstile → Add site → domain of the app, mode **Managed**.
2. Put the site key in `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, the secret in `TURNSTILE_SECRET_KEY`.
3. Until then, staging can use Cloudflare's documented always-pass test keys listed in `.env.example`.

## 3. Vercel (unblocks: trying everything on a real phone)

1. vercel.com → Import the GitHub repo `A7madAdelll/7la2y`. Plan: Pro for commercial use.
2. Environment variables: all names from `.env.example` (Preview = staging values).
3. After the first deploy, open `/demo` on your phone; then a real shop link once a shop exists.

## 4. Meta WhatsApp (unblocks: the one opt-in alert)

1. Meta Business account + WhatsApp Business app; start **business verification**.
2. Submit the Arabic utility template (text in `docs/whatsapp-cost.md` / build plan). Approval can take days.

## 5. Later

Supabase production project (same steps, separate keys), Sentry, domain, backups check.
