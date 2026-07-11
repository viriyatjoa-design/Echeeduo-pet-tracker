# Purrfect Log v2

Family cat-care tracker PWA. **The spec is the source of truth: read [`SPEC.md`](./SPEC.md).**

- Stack: Next.js 15 (App Router, TS), Tailwind, shadcn/ui, lucide-react, recharts, Supabase
  (Postgres + Storage), deployed on Vercel.
- **Auth: Supabase magic-link (email OTP)** via `@supabase/ssr`. NOTE: this replaces the
  Zitadel/NextAuth described in SPEC §3–§4 — the *only* deviation from the spec. Authorization
  is unchanged: the `app_users` allowlist (see `CONTEXT.md` for the exact pattern).
- Data access is **server-side only** with the service-role key (`lib/db.ts`). RLS is
  deny-all on every table. Never import the service-role client into a Client Component.
- Principles are non-negotiable — see SPEC §2. Prefer boring code. One `lookups` table backs
  every dropdown; one `care_events` engine for all scheduled care; one `attachments` table.
- Progress + decisions live in `STATE.md` and `CONTEXT.md` (GSD memory).
- Setup/run instructions for the owner: `SETUP.md`.
