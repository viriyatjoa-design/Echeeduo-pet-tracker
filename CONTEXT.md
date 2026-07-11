# CONTEXT — decisions & shared memory (GSD)

Confirmed decisions that shape the build. Read alongside `SPEC.md`.

## Auth architecture (the one deviation from SPEC)
SPEC §3–§4 specify Zitadel + NextAuth v5. **We use Supabase magic-link (email OTP) instead**
— confirmed with the owner as the biggest lever for shipping fast. Everything else in the
spec is built as written.

**Exact pattern:**
- `@supabase/ssr` provides the browser + server + middleware Supabase clients used **only for
  the auth session** (cookie-based). Login page: `supabase.auth.signInWithOtp({ email })` →
  user clicks the emailed magic link → session cookie set.
- `middleware.ts` refreshes the session and redirects unauthenticated users to `/login`.
- **Authorization = `app_users` allowlist (unchanged from SPEC §4):** after Supabase confirms
  an email, look up an active `app_users` row where `lower(email)` matches. No match → sign
  out + deny (show "not a member"). On first login, fill `auth_sub` (Supabase `user.id`) +
  `display_name`. Resolve `app_user_id` and expose it to server code for `created_by`.
- **Data access is separate and server-only:** all reads/writes use the service-role client
  in `lib/db.ts`. The anon key is used only for the auth handshake.

**Schema tweak:** `app_users.zitadel_sub` → `auth_sub` (same "null until first login"
semantics). No other schema change from SPEC §5.

**Security note (DoD "no Supabase keys in client bundle"):** `NEXT_PUBLIC_SUPABASE_ANON_KEY`
does ship to the client — by design, and harmless: under deny-all RLS the anon key can
read/write nothing. The **service-role key never ships** (server-only). DoD satisfied.

## Env vars
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=   # auth handshake only; harmless under deny-all RLS
SUPABASE_SERVICE_ROLE_KEY=       # server-only; all data access
APP_TZ=Asia/Jakarta
```

## Scope
Full V1 = SPEC steps 1–12. Nothing deferred. Milestones 2 & 3 (SPEC §11) are NOT built
(schema-awareness only — don't add tables for them, don't block them).

## Open seed data (owner fills before first deploy)
- A5: real cat data (names/sex/birth/neuter/weight/microchip) — placeholders in `002_seed.sql`.
- A6: real member emails (Rio + wife) — placeholders in `002_seed.sql`.

## Conventions (from SPEC §2)
uuid PKs (`gen_random_uuid()`); `timestamptz` UTC stored, displayed `Asia/Jakarta`; weights
= grams `int`; money = `bigint` whole IDR (M2, convention only); soft delete via `is_active`;
`created_by` on every user row; kcal denormalized at write time; UI strings in `lib/strings.ts`.
