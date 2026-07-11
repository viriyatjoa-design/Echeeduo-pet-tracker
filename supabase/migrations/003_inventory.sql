-- Milestone 2: inventory → consumption → spending (SPEC §11).
-- Run AFTER 001/002. Money = bigint whole IDR (SPEC §2.8). Same conventions:
-- uuid PKs, soft delete, created_by, deny-all RLS.

-- New lookup categories (extensible via /admin/lists like everything else).
insert into lookups (category, code, label, sort_order) values
  ('inventory_type','dry_food', 'Dry food', 1),
  ('inventory_type','wet_food', 'Wet food', 2),
  ('inventory_type','snack',    'Snacks',   3),
  ('inventory_type','medicine', 'Medicine', 4),
  ('inventory_type','litter',   'Litter',   5),
  ('inventory_type','other',    'Other',    6),
  ('stock_unit','g',   'Grams',  1),
  ('stock_unit','pcs', 'Pieces', 2),
  ('stock_unit','ml',  'Milliliters', 3),
  ('stock_reason','purchase',    'Purchase',    1),
  ('stock_reason','consumption', 'Consumption', 2),
  ('stock_reason','adjustment',  'Adjustment',  3),
  ('stock_reason','expired',     'Expired / discarded', 4)
on conflict (category, code) do nothing;

create table inventory_items (
  id            uuid primary key default gen_random_uuid(),
  item_type_id  uuid not null references lookups(id),  -- category 'inventory_type'
  name          text not null,
  food_id       uuid references food_catalog(id),      -- link → feeding logs auto-consume
  unit_id       uuid not null references lookups(id),  -- category 'stock_unit' (g/pcs/ml)
  quantity      numeric(10,1) not null default 0,      -- current stock, maintained with movements
  cost_per_unit bigint,                                -- whole IDR per unit (latest known)
  reorder_days  int,                                   -- alert when days-left <= this; null = no alert
  expiry        date,
  notes         text,
  created_by    uuid not null references app_users(id),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);
create index idx_inventory_food on inventory_items (food_id) where food_id is not null;

create table stock_movements (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references inventory_items(id),
  delta           numeric(10,1) not null,             -- +purchase / -consumption
  reason_id       uuid not null references lookups(id), -- category 'stock_reason'
  unit_cost       bigint,                              -- IDR snapshot at purchase (denormalized like kcal)
  ref_entity_type text,                                -- e.g. 'feeding_log'
  ref_entity_id   uuid,                                -- links a consumption to its feeding_logs row
  moved_at        timestamptz not null default now(),
  notes           text,
  created_by      uuid not null references app_users(id),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);
create index idx_movements_item_time on stock_movements (item_id, moved_at desc);
create index idx_movements_time on stock_movements (moved_at desc);

alter table inventory_items enable row level security;
alter table stock_movements enable row level security;
