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
- [ ] `/admin/lists` lookups manager
- [ ] Cats CRUD + `/settings` (cats + members)
- [ ] `/catalog` (foods + meal templates)
- [ ] `/log/feed` quick-log + treat rule
- [ ] Weight/BCS + chart + trend badge
- [ ] Care engine + med course + `/care`
- [ ] Attachments (storage + signed URLs + compress)
- [ ] Observation (water/litter/symptom/`/journal`/health tab)

## Phase C — Integration + ship
- [ ] Today dashboard `/` (kcal ring, sparkline, care chips, feed-all, FAB)
- [ ] PWA manifest + icons
- [ ] `npm run build` + `tsc --noEmit` green
- [ ] Ultracode audit vs SPEC §9 DoD
- [ ] `SETUP.md`
- [ ] Commit + push
