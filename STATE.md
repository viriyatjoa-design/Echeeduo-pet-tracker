# STATE — progress tracker (GSD)

Branch: `claude/pwa-gsd-build-ze198d` · Milestone: **V1** · Updated: 2026-07-11

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
- [~] Ultracode audit vs SPEC §9 DoD (workflow running)
- [x] `SETUP.md` owner runbook
- [x] Commit + push (continuous)
