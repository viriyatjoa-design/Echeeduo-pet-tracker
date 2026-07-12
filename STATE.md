# STATE — progress tracker (GSD)

Branch: `claude/pwa-gsd-build-ze198d` · Milestone: **V1 + M2 shipped, live in production** · Updated: 2026-07-12

## BACKLOG — open items (check here first when resuming)
Owner-side (blocked on Rio):
- [ ] Run `003_inventory.sql` in Supabase SQL Editor (activates inventory; app degrades gracefully until then) — status unconfirmed
- [ ] **Run `004_litter_ai.sql` in Supabase SQL Editor** (2 columns on litter_logs; litter AI analysis can't be saved until then — the error says so)
- [ ] **Run `005_ai_briefs.sql` in Supabase SQL Editor** (ai_briefs table; morning report + saved analyses need it)
- [ ] **Run `006_care_consume.sql` in Supabase SQL Editor** (AFTER 003 — care↔inventory consume link, 'opened' reason, tube/bag/pack units)
- [ ] **Set `CRON_SECRET` in Vercel** (any long random string) + redeploy — the nightly morning report is rejected until then (manual Refresh works once 005 is run)
- [ ] Optional: set `MOONSHOT_VISION_MODEL` in Vercel (vision-capable non-thinking model, e.g. `kimi-latest` — verify ID in console) for faster photo analysis + morning report
- [ ] Custom SMTP (resend.com) so magic-link emails aren't capped at ~2/hour — wife's login failed on this once
- [ ] Fill cat details (sex/birth/neutered) + first weights to unlock kcal targets — status unconfirmed
- [x] Kimi/Moonshot API key set by owner; model `kimi-k2.6` confirmed working (briefs + scanner)

Build-side:
- [x] **Milestone AI SHIPPED** (Kimi/Moonshot): health brief + vet summary on cat Health tab; label scanner in food form; graceful no-key state. Owner may need to set MOONSHOT_MODEL to the exact console model ID (code defaults to "kimi-k2.6")
- [ ] Milestone 3 (SPEC §11): vet document vault, bloodwork tracking — NOT authorized yet
- [ ] **Prod error masking sweep**: Next.js masks thrown Server Action errors in production.
  AI actions converted to result objects (07-12); the OTHER actions (care, feeding, catalog,
  members…) still throw friendly messages that prod replaces with a generic banner. Convert
  user-facing expected errors to returned values app-wide.

## Recent session (2026-07-12, day — vertical-space audit)
- [x] **Vertical-space audit** (owner-requested with screenshots): page subtitles removed
  app-wide; page H1s 2xl→xl (Today merges the date inline, greeting dropped); dialog
  descriptions → sr-only (a11y kept, pixels saved); Card paddings p-5→p-4 + CardTitle
  lg→base; main pb 9rem→8rem pt-4→3; Journal add-buttons share the title row + filter
  chips one scrollable line; photo thumbs grid 3→4 cols; Settings: card descriptions
  removed, Lists+Inventory merged into one two-link card, cat Edit → icon-only (fixes
  "Ch…" truncation); catalog food cards meta+actions one row, redundant Foods/Items h2s
  removed; care rows + cat card rhythm tightened. 44px tap targets preserved.

## Feature (2026-07-12, overnight — Health Scorecard)
- [x] **Health Scorecard** (per cat, cat profile → Health tab): grades weight / body condition /
  eating / hydration / preventive-care against the British Shorthair references (BREED_REF in
  cat-care-facts.ts). Pure engine `lib/health-score.ts` (status good/watch/attention/info/unknown,
  overall rollup gated on a real health signal) + server gatherer `lib/health-score-data.ts`
  (14-day Jakarta window: avg kcal on fed-days, avg logged water, overdue care) + `ScorecardView`
  UI. Hydration is INFORMATIONAL only (wet-fed cats never false-flag). NO migration — computes
  from existing data, degrades with "log a weight" nudges. 25 unit tests (64 total). Build green,
  visually verified light+dark.
- [x] **Scorecard audit** (24-agent workflow, find→refute→fix): 13 confirmed findings fixed.
  Notably: hydration no longer greenlights excessive drinking (>100 ml/kg = polydipsia → info
  + vet note, never "Good"); eating graded against IDEAL-weight kcal target (overweight cats
  no longer read "on track"); eating coverage gate (<3 fed-days = can't grade) + honest
  "based on N days"; BCS falls back to the most recent weigh-in that recorded one; lean
  feeding query (dropped 2 discarded join queries); softened all-clear headline when only a
  lone weight is known; `--destructive-strong` text token for AA "Look" label in dark mode;
  +7 boundary/precedence tests (71 total). Accepted: the Health tab still fetches eagerly like
  the other tabs (a full lazy-tab refactor is out of scope; the lean query keeps it to ~3
  extra queries).

## Hardening session (2026-07-12, evening — 5-track multi-agent)
- [x] **Adversarial audit** (55-agent workflow, find→refute→fix): 20 verified findings fixed
  (0 critical, 5 major, 15 minor). Majors: deactivated-cat care leak (getOpenCareEvents inner-
  joins active cats); morning report dropped litter pre-004 (stopped naming ai_analysis in the
  select) → false quiet days; quiet-day reports now append restock + overdue/due-today care
  heads-up with NO ai call; refresh/generate no longer discard a paid report on save failure
  (best-effort save). Minors incl. per-item consume rollback (care + feeding hooks), recurring
  due_time carry, logPastCareEvent 006 hint, feeding treat-check created_at tiebreaker,
  getLatestBrief error discrimination, parseAIJson fallback guard, and the systemic theme fix.
- [x] **Theme alpha bug class killed**: every color token now carries `<alpha-value>` in
  tailwind.config, so `bg-x/60` / `text-x/70` opacity modifiers stop silently no-opping.
- [x] **Test suite from zero**: vitest (native tsconfig paths, no plugin) + 39 tests over
  kcal / care scheduling / weight-trend / time helpers. `npm test`.
- [x] **Visual audit**: browser-driven light+dark gallery screenshots (throwaway harness,
  removed) → dark-mode Feed-button contrast fixed (dark ink text on lightened accents;
  Tudou caramel deepened for AA).
- [x] **Error-masking sweep** (10-agent workflow, disjoint files): all value-returning server
  actions (feeding/observation/weight/care/inventory/foods/meal-templates/cats/members/lookups)
  return {ok,error} result objects so prod shows the REAL message, not a generic banner.
  Shared ActionButton made result-aware (accepts throwing OR result actions). The Promise<void>
  toggles still throw through the result-aware wrappers.
- [x] **BSH care handbook**: `lib/cat-care-facts.ts` (cross-checked vet research), new
  `/care-guide` page linked from Settings, and the real breed numbers injected into the
  litter/health/morning-report AI prompts.

## Recent session (2026-07-12, day — British Blue retheme)
- [x] **Compact kcal layout** (owner-picked "B + thin bar" over the big ring): progress arc
  around the cat's avatar (`AvatarKcalRing` in cat-card) + kcal numbers right-aligned in the
  header + thin `KcalBar` with copper tip under it (treat/over badges live on the bar row).
  Big `kcal-ring.tsx` deleted; card is ~140px shorter per cat.
- [x] **Full retheme to "British Blue"** (owner picked B+A mix from a 3-direction artifact
  pitch): new token layer in globals.css (coat-blue primary, milk/ink-blue grounds, --copper
  micro-accent token, cat accents = real coats choco/red/cream), Nunito variable self-hosted
  (app/fonts + next/font/local + font-sans), Button→pills, Card→soft near-borderless,
  BottomNav→active icon pill, KcalRing→copper progress-tip dot, PWA icons regenerated (blue
  cat, copper eyes) + manifest/theme-color/theme-script colors + global-error inline colors.
  Everything token-driven — no per-component color edits were needed beyond primitives.

## Recent session (2026-07-12, day — consumables)
- [x] **Consumables ride existing activities** (owner-approved after brainstorm; migration 006):
  care events carry `consume_item_id`/`consume_qty` — the ✓ consumes stock (best-effort,
  never blocks care; clamps cached qty at 0; ledger ref = care_event). Chain + med-course
  doses carry the link; "Already done?" historical records DON'T consume (stock predates
  tracking). Dose steps 0.5 (dewormer half-pill). Forms: "Uses from inventory" select +
  amount (care event + med course; food-linked items excluded — feeding already consumes).
- [x] **Opened-a-pack** (Option A): stock = sealed packs; `openOnePack` action (−1, reason
  'opened') + "Opened one" button on litter/other non-food items; 'opened' now counts as
  usage so days-left/low derive from opening cadence. Units seeded: tube/bag/pack.
- [x] **Restock warnings** (`lib/restock.ts`): care shortfall within 30 d (needed vs on
  hand, e.g. "short 1 tube for Flea treatment"), low stock, expiring — dashboard
  "Restock soon" banner (amber, → /inventory) + fed into the morning report's Heads up.
  All graceful pre-003/006.

## Recent session (2026-07-12, day — morning report)
- [x] Owner trio: (1) photo pickers offer camera OR gallery (`capture="environment"`
  removed from all 5 file inputs); (2) cat avatar photos now show on dashboard cards
  (page passes signed URLs into `CatAvatar`); (3) AI loading survives navigation —
  `lib/ai-jobs.ts` module-level job store + `useAIJob` (keys: morning-report,
  health:{catId}:{kind}, litter:{id}); health card shows newest of local/stored result;
  litter form's background analysis lights the journal entry's spinner too.
- [x] **Prompt audit + soft-diagnosis policy** (owner-requested): family/vet prompts split
  (family = soft reads + home suggestions + red-flag escalation; vet = strictly factual);
  litter analysis gains "What you can try" section + litter-coating rule; morning report
  gains incomplete-logs phrasing + no-absence-narration + one-tip allowance; label scanner
  reads any language (incl. Indonesian), net-weight-only guard, per-can kcal conversion.
- [x] Stale-PWA fix (owner hit it logging litter after the deploy): `lib/action-error.ts`
  translates Next's 'Server Action "<hash>" was not found' into "close and reopen the app",
  applied at all 27 toast catch sites + 2 previously-uncaught action awaits.
- [x] **Morning report** (owner-approved shape from brainstorm): nightly household digest.
  `lib/briefs.ts` (gather last-24h logs across cats → fast model → store in `ai_briefs`,
  migration 005; empty night = stored "Quiet day" line, NO AI call). Cron route
  `/api/cron/morning-report` (Bearer CRON_SECRET; vercel.json cron 21:30 UTC = 04:30 WIB).
  Dashboard: collapsed `MorningReportCard` (date + first-line preview, expand, Refresh
  fallback via `refreshMorningReport` action, "Generate now" empty state). Cat page: brief
  renamed **Health analysis**; health analysis + vet summary now persisted per cat
  (best-effort pre-005) and shown instantly on next visit. Reads of `ai_briefs` degrade to
  null pre-migration.

## Recent session (2026-07-12, day — litter AI)
- [x] **Litter photo AI analysis** (owner-requested): `analyzeLitterPhoto` action reads the
  entry's newest photo (signed URL → data URL → vision model) and stores a short stool/urine
  observation on the row (`ai_analysis`/`ai_analyzed_at`, migration 004). Auto-runs after a
  photo upload in the litter form (fire-and-forget, toasts on done/fail); Refresh +
  Update-photo controls on journal + cat-health litter rows (`LitterAnalysis` component);
  litter photos deletable now so a photo can be replaced. Health-brief data includes stored
  observations. `MOONSHOT_VISION_MODEL` env (optional) routes photo jobs (litter + label
  scan) to a faster non-thinking vision model. Pre-migration the app degrades with a clear
  "run 004" message. Build green (14 routes).

## Recent session (2026-07-12, morning→day)
- [x] "Already done?" toggle on New event — backdated care records (historical vaccinations); next occurrence chains from historical date (`logPastCareEvent`)
- [x] Care page rows restacked (owner-reported crushed layout); cat name on rows
- [x] Fixed invisible Feed buttons (double-hsl accent bug) — accents now render everywhere

## Overnight session (2026-07-11 → 12)
- [x] Perf: functions pinned to sin1 (was iad1 ↔ Singapore DB); dashboard N+1 batched (~15 flat queries)
- [x] UX: loading skeletons all routes; error boundaries; login handles expired links
- [x] V1 live on Vercel; owner logged in; cats seeded (Enoki/Cheeto/Tudou)
- [x] **Milestone 2 (SPEC §11, owner-authorized 2026-07-11):** 003_inventory.sql + types;
  backend (queries/actions); feeding auto-consume hook (best-effort, can't break feeding);
  /inventory UI (stock + spending tabs) linked from Catalog + Settings. Degrades gracefully
  until owner runs migration 003.
- [x] Overnight re-audit (3 reviewers over the diff): 2 majors fixed (consume hook now
  grams-unit-only + one-item-per-food), 4 minors fixed (trailing-14d off-by-one, createItem
  orphan on lookup failure, opening stock counted as spend, stale history dialog), plus MRU
  fallback + explicit query limits + rounded consume grams.
- Known limitation (accepted, family scale): stock quantity uses read-modify-write — two
  simultaneous stock writes can drift the cached quantity (ledger stays correct; fix via
  Adjust). A DB-side increment RPC would close it if it ever matters.
- [x] Final green build (14 routes) + push

## Morning session (2026-07-12)
- [x] **Complete UI/UX audit** (owner-requested): 3 inspectors (forms/dialogs, pages/nav/
  theming, core flows) → ~20 confirmed findings, ALL fixed. Highlights: viewportFit=cover
  (iOS safe-area insets were silently 0), stale 85vh overrides on feed dialogs (unreachable
  Save with keyboard open), invalid bg-destructive/12 (overdue chips lost their red pill),
  warning-strong contrast token, decimal portion input ("0.75" now typeable), required-select
  submit guards, per-chip water spinners, photo-upload failure no longer invites duplicate
  rows, controlled FAB dialogs (menu closes cleanly), nav highlights owning tab on sub-routes,
  44px tap targets on ✓ / reorder arrows.
- [x] **Dashboard change (owner-approved):** water widget on cat cards → one-tap "Feed {cat}"
  button (FeedDialog preselected; ≤3 taps honored per SPEC §9) + compact water one-liner.
  Water logging remains in FAB + Health tab.
- [x] Login: surface real Supabase send errors; dialog primitive max-h-[85dvh] scroll fix.
- [x] Final green build + push (b0680ca)

## Phase A — Foundation
- [x] Config scaffold (Next 15 + TS + Tailwind v3 + shadcn tokens), light/dark token layer
- [x] `lib/strings.ts`, `lib/types.ts`, `lib/time.ts`, `lib/utils.ts`
- [x] Supabase magic-link auth contract: `lib/supabase/*`, `middleware.ts`, `lib/auth.ts` (app_users allowlist + created_by resolution)
- [x] `supabase/migrations/001_init.sql` + `002_seed.sql` (auth_sub, storage bucket)
- [x] `lib/db.ts` (service-role), `lib/lookups.ts` (per-request cache)
- [x] Domain helpers: `lib/kcal.ts`, `lib/care.ts`, `lib/weight.ts`
- [~] UI primitives + login page + auth callback + app shell + placeholder dashboard (subagent in progress)
- [ ] `npm run build` green (subagent verifying)

## Phase B — Feature slices
Wave 1 (done, build green):
- [x] `/admin/lists` lookups manager
- [x] Cats CRUD + `/settings` (cats + members)
- [x] `/catalog` (foods + meal templates)
- [x] Attachments (storage + signed URLs + compress) — `components/attachments/*`, `lib/storage.ts`
Wave 2 (done, build green):
- [x] `/log/feed` quick-log + feed-all + treat rule
- [x] Weight/BCS + chart + trend badge (components for cat profile)
- [x] Care engine + med course + `/care`
- [x] Observation (water/litter/symptom/`/journal`/health section)

## Phase C — Integration + ship
- [x] Today dashboard `/` (kcal ring, sparkline, care chips, feed-all, FAB)
- [x] Cat profile `/cats/[id]` (feeding/weight/health/care tabs, avatar upload)
- [x] `/admin/lists` linked from Settings
- [x] PWA manifest + icons (sharp-generated, maskable + apple-touch)
- [x] `npm run build` + `tsc --noEmit` green (13 routes)
- [x] Ultracode audit vs SPEC §9 DoD — 16 agents, 11 confirmed findings, all fixed (incl. open-redirect, double-completion race, invisible anytime events)
- [x] `SETUP.md` owner runbook
- [x] Commit + push (continuous)
