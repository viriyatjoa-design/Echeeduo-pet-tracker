-- Purrfect Log v2 — V1 schema (SPEC §5).
-- Auth deviation (see CONTEXT.md): app_users.zitadel_sub -> auth_sub. No other change.

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
  auth_sub     text unique,            -- Supabase auth user id; null until the member's first login
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
  accent_index       smallint not null default 1,  -- per-cat accent (SPEC §7); maps to --cat-N
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
  kcal       numeric(7,1) not null,   -- DENORMALIZED at write time (see SPEC §6.1)
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

-- RLS: deny-all (service-role bypasses; anon key can touch nothing).
alter table lookups             enable row level security;
alter table app_users           enable row level security;
alter table cats                enable row level security;
alter table food_catalog        enable row level security;
alter table feeding_logs        enable row level security;
alter table weight_logs         enable row level security;
alter table care_events         enable row level security;
alter table attachments         enable row level security;
alter table meal_templates      enable row level security;
alter table meal_template_items enable row level security;
alter table litter_logs         enable row level security;
alter table water_logs          enable row level security;
alter table symptom_logs        enable row level security;

-- ── Private storage bucket for attachments (signed URLs only) ──
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;
-- No storage RLS policies: only the server (service role) reads/writes + issues signed URLs.
