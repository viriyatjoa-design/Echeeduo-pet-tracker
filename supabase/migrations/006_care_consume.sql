-- Milestone 2 extension: consumables ride existing activities (owner-approved).
--   1. Care events can consume inventory on completion (flea tube, dewormer
--      pill/half-pill) — dose stored per event, copied when the chain rolls.
--   2. "Opened a pack" ledger reason for bulk items (tofu litter, litter pads):
--      stock counts sealed packs; opening one is the consumption event.
--   3. Whole-unit stock units: tubes / bags / packs (units live in lookups —
--      extensible in /admin/lists like everything else).
-- Run AFTER 003 (inventory). Safe to re-run.

alter table care_events
  add column if not exists consume_item_id uuid references inventory_items(id),
  add column if not exists consume_qty numeric(10,1);

insert into lookups (category, code, label, sort_order) values
  ('stock_reason','opened','Opened a pack', 5),
  ('stock_unit','tube', 'Tubes', 4),
  ('stock_unit','bag',  'Bags',  5),
  ('stock_unit','pack', 'Packs', 6)
on conflict (category, code) do nothing;
