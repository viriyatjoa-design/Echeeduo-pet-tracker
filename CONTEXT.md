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
| 07-12 | **Morning report** (owner-approved after brainstorm): ONE household digest (not per-cat cards) written nightly at 04:30 Jakarta by Vercel cron (21:30 UTC, `CRON_SECRET`-protected), stored in new `ai_briefs` table (migration 005), collapsed card on dashboard with Refresh fallback; empty nights store "Quiet day" WITHOUT an AI call; fast model. Cat-page brief renamed **Health analysis** (deep, thinking model) and now persisted (+ vet summary) so reads are instant | Owner: "general brief… trigger automatically every night… in the morning we can just read it"; agreed to household-grain + 4-5am + quiet-day |
| 07-12 | **Consumables model (owner-approved after brainstorm):** inventory-first, but consumption RIDES existing activities, never a separate chore. Meds (flea tube, dewormer pill) = care-event link, consumed on ✓ (dose 0.5-steps; flea = 1 tube; historical "already done" records don't consume). Bulk litter/pads = "Opened one" per sealed bag/pack (Option A — no per-change logging). Units are lookups (stock_unit) — tube/bag/pack seeded in 006. Dashboard "Restock soon" warning = care schedule × stock + low + expiry; also in morning report | Owner: "should the item be added in inventory first and consumed through activity log?" + picks: Option A, 0.5/1 pills, per-tube flea, warnings yes |
| 07-12 | **Theme: "British Blue"** (owner picked from 3 mockup directions: mix of B soft-wellness + touch of A quiet-tools). Brand = BSH coat blue (`212 22% 43%` light / `213 28% 70%` dark); milk-paper light bg, INK-BLUE dark bg (never black); `--copper` token (BSH eye color) for MICRO-accents only (kcal ring tip, icon dots). Cat accents = real coats: 1 Enoki chocolate, 2 Cheeto red, 3 Tudou cream. Nunito variable (self-hosted `app/fonts/`, next/font/local — never CDN at build). Buttons = pills (rounded-full, semibold); cards = near-borderless soft surfaces; nav active = blue-milk pill around icon. PWA icon: blue + milk face + copper eyes; manifest/theme-color `#566c86`/`#efece4`/`#141922` | Owner: "doesn't look like AI slop Claude color (orange black)"; direction picked via artifact pitch |
| 07-12 | **AI prompt policy: SOFT DIAGNOSIS allowed** in family-facing outputs (health analysis, litter analysis, morning report tip): soft reads + 1-3 low-risk home suggestions (water/wet food/fiber/pacing), BUT red flags (blood, black stool, worms, watery diarrhea, 24h+ not eating, severity-3, sudden weight change) always escalate to "see your vet", never home tips. **Vet summary stays strictly factual** (own system prompt — no interpretation). Also: "logs may be incomplete" phrasing rule ("only X kcal logged"), litter-coating rule for photos, label scanner reads Indonesian + net-weight-only + per-can kcal conversion | Owner: "provide a soft diagnosis… 'stool looks firm, consider checking their drinking quantity, fiber'" + prompt audit |

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
