-- Seed lookups, members, cats, example foods (SPEC §5 · §0 open items A5/A6).

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
  ('symptom_type','other',        'Other',                8)
on conflict (category, code) do nothing;

-- ⚠️ A6 — replace with REAL member emails before first deploy (must match the Google/email
-- address each person signs in with; matched case-insensitively).
insert into app_users (email, display_name) values
  ('rio@example.com',  'Rio'),
  ('wife@example.com', 'Wife')
on conflict (email) do nothing;

-- ⚠️ A5 — replace with REAL cat data (Simba + the other two: sex, birth_date, neuter, weight).
insert into cats (name, sex, neutered, birth_date, accent_index) values
  ('Simba', null, false, null, 1),
  ('Cat 2', null, false, null, 2),
  ('Cat 3', null, false, null, 3)
on conflict do nothing;

-- Example foods — ⚠️ VERIFY kcal from actual labels before trusting the math.
insert into food_catalog (name, brand, food_type_id, kcal_per_100g, default_serving_grams)
select 'British Shorthair Adult', 'Royal Canin', id, 400.0, 35
from lookups where category='food_type' and code='dry';

insert into food_catalog (name, brand, food_type_id, kcal_per_100g, unit_id, unit_grams)
select 'Wet food 85 g can', 'NatureVille', ft.id, 90.0, fu.id, 85.0
from lookups ft, lookups fu
where ft.category = 'food_type' and ft.code = 'wet'
  and fu.category = 'food_unit' and fu.code = 'can';
