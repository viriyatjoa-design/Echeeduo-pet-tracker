# STATE — progress tracker (GSD)

Branch: `claude/pwa-gsd-build-ze198d` · Milestone: **V1 + M2 shipped, live in production** · Updated: 2026-07-12

## BACKLOG — open items (check here first when resuming)
Owner-side (blocked on Rio):
- [ ] Run `003_inventory.sql` in Supabase SQL Editor (activates inventory; app degrades gracefully until then) — status unconfirmed
- [ ] Custom SMTP (resend.com) so magic-link emails aren't capped at ~2/hour — wife's login failed on this once
- [ ] Fill cat details (sex/birth/neutered) + first weights to unlock kcal targets — status unconfirmed
- [x] Kimi/Moonshot API key set by owner; vision capability + exact model ID still unverified (label scanner will surface any API error directly)

Build-side:
- [x] **Milestone AI SHIPPED** (Kimi/Moonshot): health brief + vet summary on cat Health tab; label scanner in food form; graceful no-key state. Owner may need to set MOONSHOT_MODEL to the exact console model ID (code defaults to "kimi-k2.6")
- [ ] Milestone 3 (SPEC §11): vet document vault, bloodwork tracking — NOT authorized yet
- [ ] **Prod error masking sweep**: Next.js masks thrown Server Action errors in production.
  AI actions converted to result objects (07-12); the OTHER actions (care, feeding, catalog,
  members…) still throw friendly messages that prod replaces with a generic banner. Convert
  user-facing expected errors to returned values app-wide.

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
