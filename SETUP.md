# Setup — get Purrfect Log running

> **Already deployed? One pending step (added overnight):** the app now includes
> **Inventory & spending** (Milestone 2). To activate it, open Supabase → **SQL Editor**
> → New query → paste all of `supabase/migrations/003_inventory.sql` → **Run**
> ("Success. No rows returned"). Until then the app works exactly as before —
> the Inventory page just shows a "not set up yet" notice.

Roughly 20–30 minutes end to end. You need a Supabase account and a Vercel account (both
have free tiers that are plenty for a household).

## 1. Create the Supabase project
1. supabase.com → **New project**. Pick a region near you (Singapore is closest to Jakarta).
   Save the database password somewhere.
2. When it's ready, open **Project Settings → API** and copy:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_ROLE_KEY` (keep this secret — server only)

## 2. Create the schema
1. Supabase → **SQL Editor → New query**.
2. Paste all of `supabase/migrations/001_init.sql`, run it. (Creates the 13 tables, enables
   deny-all RLS, and creates the private `attachments` storage bucket.)
3. **Before** running the seed, edit `supabase/migrations/002_seed.sql`:
   - Replace the two placeholder member emails with the **real** emails you and your wife will
     sign in with (any email works — magic links are sent there).
   - Replace the three placeholder cats (Simba + 2) with real names/sex/birth/neuter.
   - Fix the example foods' `kcal_per_100g` to match your actual food labels.
4. Paste the edited `002_seed.sql`, run it.

## 3. Turn on magic-link email auth
1. Supabase → **Authentication → Providers → Email**: make sure it's **enabled** (it is by
   default). No password needed — we use magic links (OTP).
2. **Authentication → URL Configuration**:
   - **Site URL**: `http://localhost:3000` for local dev; set it to your Vercel URL once
     deployed (e.g. `https://purrfect-log.vercel.app`).
   - **Redirect URLs**: add `http://localhost:3000/auth/callback` and
     `https://<your-vercel-domain>/auth/callback`.
3. (Optional, recommended) The default Supabase email sender is rate-limited and can land in
   spam. For reliability, later add an SMTP provider under **Authentication → Emails → SMTP**.
   Fine to skip for the first run with 2 users.

## 4. Run it locally (optional but nice to verify)
```bash
cp .env.example .env.local     # then fill in the 3 Supabase values from step 1
npm install
npm run dev
```
Open http://localhost:3000 → you'll hit `/login`. Enter your seeded email, click the magic
link in your inbox (open it on the same device/browser), and you're in. An email that isn't in
`app_users` is rejected with a friendly message — that's the allowlist working.

## 5. Deploy to Vercel
1. Push this branch and import the repo at vercel.com → **New Project**.
2. **Environment Variables** — add the same four as in `.env.example`:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `APP_TZ=Asia/Jakarta`. (Also set `NEXT_PUBLIC_SITE_URL` to your Vercel URL.)
3. Deploy. Then go back to Supabase **URL Configuration** and set Site URL + add the
   `/auth/callback` redirect for your Vercel domain (step 3.2).
4. Open the Vercel URL on your phone → Safari/Chrome **Add to Home Screen** to install the PWA.

## 6. Add your wife (no redeploy needed)
Sign in, go to **Settings → Members → Add**, enter her email + name. She can now sign in with
a magic link immediately. Deactivating a member blocks them but keeps their history.

## Notes
- **Auth choice:** we use Supabase magic-link instead of the Zitadel described in `SPEC.md`
  (see `CONTEXT.md` for why + the exact pattern). The authorization model — the `app_users`
  allowlist — is unchanged.
- **Security:** the anon key is safe to expose; deny-all RLS means it can read/write nothing.
  All data access is server-side with the service-role key, which never reaches the browser.
- **Photos:** stored in the private `attachments` bucket, served via short-lived signed URLs.
- To regenerate the app icons after changing the design: `node scripts/generate-icons.mjs`.
