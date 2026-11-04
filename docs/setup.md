# Setup checklist (Ahmad, when ready)

Everything below is a manual step in an account only Ahmad owns. Claude has written the code to
work as soon as these exist. Do them in order; each step says what it unblocks.

## 1. Supabase staging (unblocks: real data, login, live updates)

1. supabase.com → New project → name `7la2y-staging`, region **Frankfurt (eu-central-1)** (closest to Egypt), strong DB password (save it in a password manager).
2. Apply the database: SQL editor → run each file in `supabase/migrations/` **in filename order**. (Or connect the Supabase connector to this environment and Claude applies them to staging.)
3. Realtime → Settings: keep **public channels allowed** (the app uses public broadcast pings that carry no customer data).
4. Authentication → Providers → Email: enabled (staff log in with an email link). URL configuration: add the site URL and `https://<site>/auth/callback` once Vercel exists.
5. Authentication → Email templates → **Magic Link**: subject `لينك الدخول لحلاقي`, body:

   ```html
   <div dir="rtl" style="font-family: Arial, sans-serif; font-size: 16px; line-height: 1.7">
     <p>أهلاً،</p>
     <p>دوس على الزرار ده عشان تدخل على حلاقي. افتحه من نفس الموبايل اللي طلبت منه اللينك.</p>
     <p><a href="{{ .ConfirmationURL }}" style="background:#0b6b6b;color:#fff;padding:12px 20px;border-radius:12px;text-decoration:none;display:inline-block">ادخل على حلاقي</a></p>
     <p style="color:#4a535c;font-size:14px">اللينك ده لمرة واحدة. لو مطلبتش دخول، تجاهل الرسالة.</p>
   </div>
   ```
6. Settings → API: copy **Project URL** and **anon public key** into Vercel / `.env.local` (see `.env.example`). Copy the **service_role key** into Vercel only, marked sensitive. Never paste it in chat.

### First shop
Open `/login` on the deployed site, enter your email, open the link from the same phone, then
`/onboarding` creates the shop (default services included). Set prices and barbers in
`/settings/<shop>`; the counter is at `/counter`.

### Make yourself the platform admin (once)
After your first login, in the Supabase SQL editor (staging, later production):
`insert into public.platform_admins (user_id) select id from auth.users where email = 'you@example.com';`
Then `/admin` shows every shop, usage this month, and lets you record manual payments.

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
2. WhatsApp Manager → Message templates → Create: category **Utility**, name `queue_near_turn`, language **Arabic (ar)**. Body (exactly two variables):

   ```
   دورك قرب في {{1}}! قدامك شخصين بس. رقمك {{2}}. ارجع المحل دلوقتي عشان متفوتكش.
   ```
   Sample values for review: `{{1}}` = صالون النيل, `{{2}}` = 14. Approval can take days; if rejected, reword and resubmit the same day.
3. Vercel env: `WHATSAPP_TOKEN` (permanent system-user token), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME=queue_near_turn`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` (any random string), and `CRON_SECRET` (random).
4. App → WhatsApp → Configuration → Webhook: URL `https://<site>/api/whatsapp/webhook`, verify token = `WHATSAPP_VERIFY_TOKEN`, subscribe to **messages**.
5. Until all of this is set, the app simply sends nothing; alerts older than 30 minutes are closed unsent.

## 5. Sentry (error alerts)

sentry.io → new project (platform: Node.js, **EU data region**) → Settings → Client Keys → copy the DSN into Vercel `SENTRY_DSN`. Set an alert rule to email/phone you on new issues. Only server errors are sent; ticket/TV/invite links are masked.

## 6. Later

Supabase production project (same steps, separate keys), domain, backups check.
