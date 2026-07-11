# Purrfect Log v2 — Family Cat Care Tracker

**Spec for Claude Code · v1.1 · 2026-07-11 — expanded V1 scope**
Owner: Rio. Users: household members — Rio + wife to start; more can be added in-app, no redeploy. Subjects: 3 British Shorthair cats.

---

## 0. Execution notes for Claude Code

- **Build V1 only** (§5–§9). Later milestones (§11) are documented for schema-awareness — do not implement them, and do not make choices that block them.
- When ambiguous, pick the **simplest option** that doesn't violate §2. This is a family app, not a SaaS product. No multi-tenancy, no roles, no feature flags, no abstractions "for later".
- Do not add dependencies beyond §3 without asking.
- Respect any existing repo harness/hooks if present.
- Drop this file at repo root as `SPEC.md`; keep `CLAUDE.md` short and point it here.

**A1–A3 are confirmed decisions.** Open items: A4 (Zitadel credentials → `.env.local`), A5 (real cat data → seed or `/settings`), A6 (initial member emails → seed). None block the build.

---

## 1. What this is

A private, mobile-first **PWA** for a handful of household members to run daily care for three cats:

1. Per-cat feeding (dry/wet/snack), logged in grams **or in portions of a defined unit** (e.g. ½ × 85 g can → 42.5 g), auto-converted to **calories** and scored against each cat's daily target.
2. **Meal templates + "feed all"**: define standard meals once (e.g. morning: 40 g dry each; evening: ½ can each), then log all three cats in one tap.
3. Weight + Body Condition Score with trend flags.
4. **Observation layer**: litter/output log (photos + consistency), per-cat water intake, symptom journal with photos.
5. All recurring care — vaccine, vet visits, medicine courses, flea, deworm, bath — through **one unified event engine** with one "what's due / overdue" view.
6. A Today dashboard that answers: *has each cat eaten enough, who fed them last, what care is due* — with 7-day trends.

**Non-goals for V1:** inventory & spending (Milestone 2 — fast-follow), push notifications, offline writes, i18n framework, multi-tenant, roles, barcode scanning.

---

## 2. Principles (non-negotiable)

1. **No over-engineering.** One household, a few members, three cats. Prefer boring code.
2. **Extensibility via one `lookups` table.** Every dropdown/category in the app reads from it. Adding a new care type, food type, or (later) inventory type = **one row, zero code changes**.
3. **Typed log tables.** `feeding_logs`, `weight_logs`, etc. Never a generic EAV "observations" table.
4. **One `care_events` engine** for all scheduled/recurring care. New care kinds are lookup rows, not new tables.
5. **One polymorphic `attachments` table** so photos work on any record, now and in future phases.
6. **Soft delete** via `is_active`; never hard-delete user data.
7. **`created_by` on every user-generated row** — this is also the "who fed / who dosed" feature.
8. **Money = `bigint` whole IDR** (Milestone 2; establish the convention now).
9. **Time:** store `timestamptz` (UTC); display in `Asia/Jakarta`. Weights stored as **grams, `int`** (e.g. 4550 = 4.55 kg).
10. **`uuid` primary keys everywhere** (`gen_random_uuid()`).

---

## 3. Stack

| Layer | Choice |
|---|---|
| App | Next.js 15+ (App Router, TypeScript), Tailwind, shadcn/ui, lucide-react, recharts |
| DB / files | Supabase Postgres + Supabase Storage (private bucket `attachments`, signed URLs) |
| DB access | **Server-side only**: service-role key inside Server Actions / Route Handlers. No client-side Supabase. RLS **enabled on all tables with zero policies** (deny-all); anon key unused. |
| Auth | **Zitadel** (OIDC) via **Auth.js / NextAuth v5** `ZITADEL` provider, Authorization Code + PKCE. Middleware protects every route. Authorization = **member list in `app_users`** (add/deactivate in-app). No roles — every active member has full access. |
| PWA | Web manifest + icons, installable. No offline write queue in V1. |
| Deploy | Vercel (confirmed) |

Rationale for the auth/data pattern: Zitadel handles *identity*; the `app_users` member list handles *authorization* (works the same for 2 or 10 members, managed from the phone); and keeping the service-role key server-only means **no RLS policy maintenance at all**. (Alternative — Supabase Third-Party Auth with Zitadel JWTs + RLS — is deliberately rejected as over-engineering here.)

---

## 4. Auth flow

1. Middleware: unauthenticated → Zitadel login.
2. `signIn` callback: allow only if `app_users` has a row matching `lower(profile.email)` with `is_active = true`. **Membership lives in the DB, not an env var** — adding a user never needs a redeploy.
3. First successful login: fill `zitadel_sub` + `display_name` on that member's row. Put `app_user_id` on the JWT/session.
4. Every write attributes `created_by = session.app_user_id`.
5. **Member management** (in `/settings`): add = insert a row with email + display name (`zitadel_sub` stays null until their first login); remove = set `is_active = false` (their history stays attributed). Initial members come from `002_seed.sql`.

```ts
// auth.ts (illustrative — follow current Auth.js v5 ZITADEL provider docs)
import NextAuth from "next-auth";
import Zitadel from "next-auth/providers/zitadel";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [Zitadel], // reads AUTH_ZITADEL_ID / _SECRET / _ISSUER
  callbacks: {
    async signIn({ profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) return false;
      return await isActiveMemberByEmail(email); // app_users: lower(email) match + is_active
    },
    // jwt/session callbacks: upsert app_users on first sign-in, expose app_user_id
  },
});
```

**Zitadel console setup (manual, one-time):** Project → Application → type **Web**, Auth method **PKCE** (or Basic + secret), Grant **Authorization Code**. Redirect URIs: `http://localhost:3000/api/auth/callback/zitadel` and the production equivalent. Scopes: `openid profile email`.

### `.env.example`

```
AUTH_SECRET=
AUTH_ZITADEL_ID=
AUTH_ZITADEL_SECRET=            # omit if pure PKCE public client
AUTH_ZITADEL_ISSUER=https://<instance>.zitadel.cloud   # A4: Rio's issuer URL
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
APP_TZ=Asia/Jakarta
```

---

## 5. Data model — V1 migrations

One migration file `001_init.sql` + `002_seed.sql`. All tables get `enable row level security` (no policies).

```sql
create extension if not exists "pgcrypto";

-- ── The extensibility backbone ────────────────────────────────
create table lookups (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,          -- 'care_event_type' | 'food_type' | 'food_unit' | 'stool_consistency' | 'symptom_type' | (future: anything)
  code        text not null,          -- stable machine code, e.g. 'vaccine'
  label       text not null,          -- what the UI shows
  sort_order  int  not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (category, code)
);

create table app_users (
  id           uuid primary key default gen_random_uuid(),
  zitadel_sub  text unique,            -- null until the member's first login
  email        text not null unique,
  display_name text not null,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table cats (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  sex                text check (sex in ('male','female')),
  birth_date         date,
  breed              text not null default 'British Shorthair',
  neutered           boolean not null default false,
  microchip_no       text,
  photo_path         text,               -- primary avatar (storage path)
  weight_target_grams int,
  bcs_target_min     smallint not null default 4,
  bcs_target_max     smallint not null default 5,
  daily_kcal_override int,               -- vet-set target; wins over computed MER
  notes              text,
  is_active          boolean not null default true,
  created_at         timestamptz not null default now()
);

create table food_catalog (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  brand                 text,
  food_type_id          uuid not null references lookups(id),  -- category 'food_type'
  kcal_per_100g         numeric(6,1) not null check (kcal_per_100g > 0),
  unit_id               uuid references lookups(id),            -- category 'food_unit' (can/pouch/scoop/…); null = grams-only
  unit_grams            numeric(6,1) check (unit_grams > 0),    -- e.g. 85.0 for one can
  default_serving_grams int,                                    -- grams-mode prefill; portion mode defaults to qty = 1
  notes                 text,
  is_active             boolean not null default true,
  created_at            timestamptz not null default now()
);

create table feeding_logs (
  id         uuid primary key default gen_random_uuid(),
  cat_id     uuid not null references cats(id),
  food_id    uuid not null references food_catalog(id),
  grams      numeric(6,1) not null check (grams > 0),  -- canonical amount; portions convert to grams
  qty        numeric(6,2),            -- portion entered (0.5 = half); null when logged directly in grams
  unit_label text,                    -- snapshot ('can', 'pouch'…) so history survives catalog edits
  kcal       numeric(7,1) not null,   -- DENORMALIZED at write time (see §6.1)
  fed_at     timestamptz not null default now(),
  notes      text,
  created_by uuid not null references app_users(id),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_feeding_cat_time on feeding_logs (cat_id, fed_at desc);

create table weight_logs (
  id           uuid primary key default gen_random_uuid(),
  cat_id       uuid not null references cats(id),
  weight_grams int not null check (weight_grams > 0),
  bcs          smallint check (bcs between 1 and 9),
  measured_at  date not null default ((now() at time zone 'Asia/Jakarta')::date),
  notes        text,
  created_by   uuid not null references app_users(id),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index idx_weight_cat_date on weight_logs (cat_id, measured_at desc);

-- ── One engine for ALL scheduled care ─────────────────────────
create table care_events (
  id            uuid primary key default gen_random_uuid(),
  cat_id        uuid not null references cats(id),
  event_type_id uuid not null references lookups(id), -- category 'care_event_type'
  title         text not null,        -- "Rabies booster", "Amoxicillin 50mg"
  due_date      date,
  due_time      time,                 -- mainly for med doses; null = anytime that day
  done_at       timestamptz,          -- null = open
  interval_days int check (interval_days > 0),  -- null = one-off
  vet_name      text,
  notes         text,
  created_by    uuid not null references app_users(id),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create index idx_care_open on care_events (due_date) where done_at is null and is_active;
create index idx_care_cat  on care_events (cat_id, due_date desc);

-- ── Photos on anything ────────────────────────────────────────
create table attachments (
  id           uuid primary key default gen_random_uuid(),
  entity_type  text not null,         -- 'cat' | 'care_event' | 'litter_log' | 'symptom_log' | (future: anything)
  entity_id    uuid not null,
  storage_path text not null,         -- 'attachments/{entity_type}/{entity_id}/{uuid}.{ext}'
  caption      text,
  created_by   uuid not null references app_users(id),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);
create index idx_attach_entity on attachments (entity_type, entity_id);

-- ── Meal templates ("feed all") ───────────────────────────────
create table meal_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,               -- 'Morning', 'Evening'
  sort_order int  not null default 0,
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

create table meal_template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references meal_templates(id),
  cat_id      uuid not null references cats(id),
  food_id     uuid not null references food_catalog(id),
  qty         numeric(6,2) check (qty > 0),      -- portion (food has a unit)
  grams       numeric(6,1) check (grams > 0),    -- direct grams (food has no unit)
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  check ((qty is null) <> (grams is null))       -- exactly one of the two
);

-- ── Observation layer ─────────────────────────────────────────
create table litter_logs (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid references cats(id),            -- NULLABLE: unattributed household observation
  observed_at timestamptz not null default now(),
  urine boolean not null default false,
  stool boolean not null default false,
  stool_consistency_id uuid references lookups(id),   -- category 'stool_consistency'
  notes text,
  created_by uuid not null references app_users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_litter_time on litter_logs (observed_at desc);

create table water_logs (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references cats(id),
  ml int not null check (ml > 0),
  logged_at timestamptz not null default now(),
  created_by uuid not null references app_users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_water_cat_time on water_logs (cat_id, logged_at desc);

create table symptom_logs (
  id uuid primary key default gen_random_uuid(),
  cat_id uuid not null references cats(id),
  symptom_type_id uuid not null references lookups(id),  -- category 'symptom_type'
  severity smallint check (severity between 1 and 3),
  noted_at timestamptz not null default now(),
  notes text,
  created_by uuid not null references app_users(id),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index idx_symptom_cat_time on symptom_logs (cat_id, noted_at desc);

-- RLS: deny-all (service-role only)
alter table lookups        enable row level security;
alter table app_users      enable row level security;
alter table cats           enable row level security;
alter table food_catalog   enable row level security;
alter table feeding_logs   enable row level security;
alter table weight_logs    enable row level security;
alter table care_events    enable row level security;
alter table attachments    enable row level security;
alter table meal_templates      enable row level security;
alter table meal_template_items enable row level security;
alter table litter_logs         enable row level security;
alter table water_logs          enable row level security;
alter table symptom_logs        enable row level security;
```

### `002_seed.sql`

```sql
insert into lookups (category, code, label, sort_order) values
  ('care_event_type','vaccine',  'Vaccine',        1),
  ('care_event_type','vet_visit','Vet visit',      2),
  ('care_event_type','medicine', 'Medicine',       3),
  ('care_event_type','flea',     'Flea treatment', 4),
  ('care_event_type','deworm',   'Deworming',      5),
  ('care_event_type','bath',     'Bath / grooming',6),
  ('food_type','dry',  'Dry food',      1),
  ('food_type','wet',  'Wet food',      2),
  ('food_type','snack','Snack / treat', 3),
  ('food_unit','can',   'Can',    1),
  ('food_unit','pouch', 'Pouch',  2),
  ('food_unit','sachet','Sachet', 3),
  ('food_unit','scoop', 'Scoop',  4),
  ('food_unit','piece', 'Piece',  5),
  ('stool_consistency','hard',  'Hard / dry',        1),
  ('stool_consistency','normal','Normal',            2),
  ('stool_consistency','soft',  'Soft',              3),
  ('stool_consistency','liquid','Liquid / diarrhea', 4),
  ('symptom_type','vomit',        'Vomiting',             1),
  ('symptom_type','hairball',     'Hairball',             2),
  ('symptom_type','sneeze',       'Sneezing',             3),
  ('symptom_type','cough',        'Coughing',             4),
  ('symptom_type','lethargy',     'Lethargy',             5),
  ('symptom_type','appetite_loss','Appetite loss',        6),
  ('symptom_type','scratch',      'Excessive scratching', 7),
  ('symptom_type','other',        'Other',                8);

-- Members: A6 — replace with real emails before first deploy
insert into app_users (email, display_name) values
  ('rio@example.com',  'Rio'),
  ('wife@example.com', 'Wife');

-- Cats: A5 — replace with real data (Simba + the other two)
insert into cats (name, sex, neutered, birth_date) values
  ('Simba', null, false, null),
  ('Cat 2', null, false, null),
  ('Cat 3', null, false, null);

-- Example foods — VERIFY kcal from actual labels before trusting the math
insert into food_catalog (name, brand, food_type_id, kcal_per_100g, default_serving_grams)
select 'British Shorthair Adult', 'Royal Canin', id, 400.0, 35 from lookups where category='food_type' and code='dry';

insert into food_catalog (name, brand, food_type_id, kcal_per_100g, unit_id, unit_grams)
select 'Wet food 85 g can', 'NatureVille', ft.id, 90.0, fu.id, 85.0
from lookups ft, lookups fu
where ft.category = 'food_type' and ft.code = 'wet'
  and fu.category = 'food_unit' and fu.code = 'can';
```

---

## 6. Domain logic (spell it out in code exactly like this)

### 6.1 Calories

- `kcal = round(grams * kcal_per_100g / 100, 1)`, computed **at write time** and stored on the log row. Editing the catalog later must not rewrite history.
- **Portion entry:** if the food has `unit_id` + `unit_grams`, the feed form defaults to portion mode — `grams = round(qty × unit_grams, 1)` (e.g. ½ × 85 g can = 42.5 g), then kcal as above. Save `qty` + `unit_label` snapshot alongside canonical `grams`; history renders "½ can · 42.5 g". A grams toggle is always available; foods without a unit go straight to grams.
- **Daily target per cat:**
  - If `daily_kcal_override` set → use it.
  - Else `MER = round(70 * (kg ^ 0.75) * factor)` where `kg` = latest `weight_logs.weight_grams / 1000`, `factor = 1.2` if neutered else `1.4`.
  - If a cat has **no weight log yet**, show grams only with a "log a weight to unlock calorie targets" nudge instead of a fake target.
- **Treat rule:** if today's kcal from foods with `food_type = 'snack'` > **10% of target** → amber warning badge on the cat's card + toast when the offending log is saved. It's one `if` — do not build a "rules engine".

### 6.2 Care engine

- **Open** = `done_at is null and is_active`. **Overdue** = open and `due_date < today` (Asia/Jakarta). **Due today** = open and `due_date = today`, ordered by `due_time nulls last`.
- **Complete** action: set `done_at = now()`. If `interval_days` is not null → insert a new row (same cat, type, title, interval, vet_name) with `due_date = (done date in Asia/Jakarta) + interval_days`. Next occurrence chains from **actual completion**, not the original due date.
- Editing `due_date` = rescheduling; no separate "skip" concept in V1.
- **Med course helper** (this is how multi-dose medicine works with one table): a small form — cat, medicine name, start date, duration in days, times-per-day with actual times (e.g. 08:00, 20:00) — that **bulk-inserts** `days × times` rows of `event_type='medicine'` with `due_date` + `due_time`, `interval_days = null`. Each dose is then just an open event to tick off. 7 days × 2 doses = 14 rows; that is fine.

### 6.3 Weight trend flag

- On dashboard/profile: compare latest weight to the closest log **≥ 25 days older**. If `|Δ| ≥ 5%` → red/amber trend badge with the % and direction. Also show against `weight_target_grams` and BCS target range when set. No background jobs — compute on read.

### 6.4 Meal templates ("feed all")

- A template = named meal + one item per cat (food + amount as `qty` or `grams`, exactly one set).
- **Apply** = review screen pre-filled from the template, every row editable (swap food, tweak portion, skip a cat) → one save inserts one `feeding_logs` row per remaining cat. Portions resolve to grams **at apply time** using current `unit_grams`; kcal denormalizes as usual. Templates store intent; logs store facts.

### 6.5 Observation logs

- **Litter:** `cat_id` nullable — unattributed household entries are valid and expected with shared boxes. Consistency from `stool_consistency` lookup; photos via `attachments`.
- **Water:** quick-add chips (+25 / +50 / +100 ml) per cat. No daily target math in V1 — totals and trends only, no fake goals.
- **Symptoms:** type from `symptom_type` lookup, severity 1–3, notes + photos. Rendered as a per-cat timeline.

---

## 7. Pages & UX (V1)

Mobile-first, bottom tab nav, large tap targets. All members share one household view — no per-user data scoping.

| Route | Purpose |
|---|---|
| `/` | **Today dashboard.** One card per cat: kcal ring (today vs target) with amber treat badge; 7-day kcal sparkline; today's water ml; "Last fed 14:20 · 40 g RC Adult · **by Rio**"; latest weight + trend badge; chips for overdue (red) / due-today (amber) care events with inline ✓ complete. **"Feed all" button** (apply a meal template) + quick-log FAB menu: feed · water · litter · symptom · weight. |
| `/log/feed` | **Quick feed, ≤ 3 taps:** cat pills → food list (most-recently-used first) → amount. Amount = **portion chips** (¼ · ⅓ · ½ · 1 · 1½ · 2 · custom) when the food has a unit, else grams stepper prefilled with `default_serving_grams`; live grams + kcal preview → save. |
| `/cats/[id]` | Profile (photo, targets, neuter, microchip) + tabs: feeding history, weight chart (recharts line, 12 mo, target overlay), **health** (symptom + attributed litter timeline, water chart), care timeline. Weight/BCS logging lives here. |
| `/care` | Upcoming + overdue list grouped by date; complete/reschedule; "New event" and "New med course" forms. |
| `/journal` | Chronological household health journal — litter, symptom, and water entries interleaved; filter by cat; photos inline. |
| `/catalog` | Two tabs: **Foods** (kcal/100g, type, optional unit + unit grams, default serving) and **Meal templates** (per-cat items). |
| `/admin/lists` | **Generic lookups manager:** pick or type a category → add/edit/reorder/deactivate rows. Typing a new category name creates a whole new list — this single screen is the "easy to add anything" mechanism. |
| `/settings` | Cats CRUD, **Members** (list, add by email, deactivate), sign out. |

Photo upload (V1 scope): cat avatar + attachments on `care_events` (vet notes, prescriptions), `litter_logs`, and `symptom_logs`. Compress client-side to ≤ 1600px before upload; store path in `attachments`; render via short-lived signed URLs.

**Design direction:** warm and domestic, not clinical or SaaS-dashboard — rounded geometry, generous whitespace, one accent per cat (used consistently on their card/chart), readable at arm's length in a kitchen. The kcal ring on the Today card is the signature element; keep everything else quiet. **Dark mode ships in V1** — build both themes from one CSS-token layer from the start.

**Language: English UI (A1).** Keep all UI strings in one `strings.ts` module — no i18n library, but a future Bahasa Indonesia swap touches one file.

---

## 8. Build order

1. Scaffold (Next + TS + Tailwind + shadcn, light/dark tokens) → Auth.js + Zitadel + middleware + `app_users` membership check.
2. Migrations + seeds; typed server-side Supabase client helper (`lib/db.ts`); lookup fetch helper with per-request cache.
3. `/admin/lists` (proves the lookups pattern end-to-end, first).
4. Cats CRUD + `/catalog` (foods).
5. Feeding: quick-log (grams + portions) + dashboard kcal ring + treat rule.
6. Meal templates + "feed all" flow.
7. Weight/BCS + chart + trend flag.
8. Care engine: event CRUD, complete-and-chain, med course helper, `/care`, dashboard chips.
9. Attachments (avatar + care event photos).
10. Observation layer: water, litter, symptoms, `/journal`, cat health tab (photos reuse attachments).
11. Trends polish: 7-day sparklines, water chart, empty states.
12. PWA manifest/icons, deploy, verify seeded members can log in.

Steps 1–8 are the daily core loop — **deploy a preview after step 8** and start using it while 9–12 land. Driving mode: Opus 4.8 default (high) effort per step; one **ultracode** audit pass across the whole repo after step 12, before calling it shipped.

## 9. Definition of done (V1)

- [ ] Installed as PWA; seeded members log in via Zitadel; a non-member email is rejected. Adding a member in `/settings` lets them log in **without a redeploy**; deactivating blocks them.
- [ ] Log a feeding in ≤ 3 taps; dashboard kcal vs target updates; who-logged-it shows the right member.
- [ ] **Portion entry:** logging ½ of an 85 g can stores 42.5 g with correct kcal; history shows "½ can · 42.5 g".
- [ ] Snack past 10% of target triggers the amber warning.
- [ ] Completing a recurring event (e.g. deworm, `interval_days = 90`) auto-creates the next one at done + 90 d; overdue items show red on `/`.
- [ ] Med course form generates the correct dose rows; each is individually completable.
- [ ] Weight chart renders; ≥ 5% / ~30 d change shows a trend badge.
- [ ] **Feed all:** applying a meal template logs all three cats in ≤ 2 taps; per-cat tweaks before save work.
- [ ] Litter entry saves with photo + consistency, with or without a cat attributed, and appears in `/journal`.
- [ ] Water quick-add updates today's total; a symptom with severity + photo shows on the cat's health tab.
- [ ] 7-day kcal sparkline renders on each cat card; dark mode toggles cleanly on every page.
- [ ] **Extensibility proof:** add care type "Nail trim", a new food type, and a new symptom type in `/admin/lists`, then use all three in real forms — **zero code changes**.
- [ ] A photo attached to a vet visit is viewable later via signed URL.
- [ ] No Supabase keys shipped to the client bundle.

---

## 10. Assumptions to confirm

| # | Status | Item |
|---|---|---|
| A1 | ✅ Confirmed | UI language = English (strings centralized for later swap) |
| A2 | ✅ Confirmed | Reminders = in-app dashboard only; **no push** in V1 |
| A3 | ✅ Confirmed | Deploy target = Vercel |
| A4 | ⏳ Rio to provide | Zitadel issuer URL + client credentials (cloud or self-hosted both fine) → `.env.local`, never committed |
| A5 | ⏳ Rio to provide | Real cat data for seeds: names (Simba + 2), sex, birth date, neuter status, current weight, microchip |
| A6 | ⏳ Rio to provide | Initial member emails for `002_seed.sql` (Rio + wife; more can be added in-app anytime) |

---

## 11. Later milestones — schema awareness only (DO NOT BUILD)

### Milestone 2 (fast-follow) — inventory → consumption → spending

- `inventory_items`: `item_type_id` (lookup `'inventory_type'`: dry_food/wet_food/medicine/snack/litter/…), `name`, optional `food_id` link to catalog, `unit_id` (lookup: g/pcs/ml), `quantity numeric`, `cost_per_unit bigint` (whole IDR), `expiry date`.
- `stock_movements`: `item_id`, `delta numeric`, `reason_id` (lookup: purchase/consumption/adjustment/expired), `ref_entity_type/ref_entity_id` (links a consumption to its `feeding_log`), `moved_at`, `created_by`.
- App-level (not trigger): saving a feeding whose food is linked to an inventory item inserts a `-grams` consumption movement.
- Derived on read: days-left = quantity ÷ avg daily consumption (trailing 14 d); reorder alert threshold in days; monthly spend = purchases by category + per-cat allocation via linked feedings.

### Milestone 3 — records & intelligence

Vet document vault (PDFs into `attachments`), bloodwork value tracking (creatinine/BUN/SDMA over time), one-page vet summary export, emergency/pet-sitter card, optional web push.

---

*End of spec.*
