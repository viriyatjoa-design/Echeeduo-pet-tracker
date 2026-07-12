# CONTEXT — decisions & shared memory (GSD)

Confirmed decisions that shape the build. Read alongside `SPEC.md`.
**Append every owner decision to the Decision log below — this file is the
cross-session memory; conversation context gets compacted, this doesn't.**

## Decision log (append-only, newest last)
| Date | Decision | Why |
|---|---|---|
| 07-11 | Auth: Zitadel → Supabase magic-link | Ship-by-tomorrow; only spec deviation (details below) |
| 07-11 | Scope: full V1 (SPEC steps 1–12), GSD multi-agent waves | Owner picked both explicitly |
| 07-11 | Milestone 2 (inventory/spend) authorized + built | Owner: "deliver new feature when I wake up" |
| 07-12 | Cat cards: water widget → one-tap "Feed {cat}" button + water one-liner | Owner picked from 3 options; honors ≤3-taps DoD |
| 07-12 | Water logging lives in FAB + Health tab only | Same decision |
| 07-12 | Vercel functions pinned sin1; Supabase in Singapore | Perf (was iad1) |
| 07-12 | Next.js 15.5.20 (CVE-2025-66478); Vercel blocks vulnerable versions | Deploy gate |
| 07-12 | Cat accent convention: `--cat-accent` takes RAW triplet (`var(--cat-N)`) | Double-hsl() bug made accents render invisible |
| 07-12 | Care rows: stacked layout, icon-only reschedule, no date repeat in groups | Owner screenshot: text crushed to 1 letter |
| 07-12 | "Already done?" toggle on New event → `logPastCareEvent` (backdated done_at, next chains from historical date) | Owner needs to enter historical vaccinations |
| 07-12 | Care events removable (soft delete, trash icon on /care + timeline); Done on not-yet-due events asks confirmation | Owner hit duplicate-done chain-march; wanted delete |
| 07-12 | Feeding gets "Now / Earlier" — backdate forgotten logs (quick feed + feed all, server rejects future) | Owner: "sometimes we forgot to log directly" |
| 07-12 | **Milestone AI approved, provider = Kimi/Moonshot** (OpenAI-compatible, plain fetch, `MOONSHOT_API_KEY`, no new deps). Build order: label scanner (needs vision-model check on owner's account) + health brief/vet summary. NOT built yet — owner said "later" | Owner chose Kimi over Claude API |
| 07-12 | Milestone AI built + shipped; owner confirmed working. K2.6 lessons (hard-won, 4 debug rounds): model id `kimi-k2.6`; NO temperature param (rejected); thinking model — big max_tokens or the budget dies in reasoning; AI actions return `{ok,...}` result objects because prod masks thrown Server Action errors | Debugging with owner screenshots |
| 07-12 | **Litter photo AI analysis** (owner-requested): photo upload auto-triggers stool/urine observation, stored on `litter_logs.ai_analysis` (migration 004), Refresh + Update-photo controls on journal/health litter rows; litter photos now deletable. Optional `MOONSHOT_VISION_MODEL` (non-thinking vision model, e.g. kimi-latest) speeds up photo jobs incl. label scan | Owner: "automatic stool/urine analysis… maybe we need a faster Kimi model" |

## Owner profile
Rio (viriyatjoa@gmail.com) + wife (sinamoroll08@gmail.com, display "Wife").
Cats: Enoki (accent 1 terracotta), Cheeto (2 teal), Tudou (3 plum).
Timezone Asia/Jakarta. Non-developer — give click-by-click instructions,
verify with screenshots. Deploys: Vercel (auto-deploy on push to
`claude/pwa-gsd-build-ze198d`), DB: Supabase (owner runs migrations by
pasting SQL in the SQL Editor — they are NOT auto-applied).

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
