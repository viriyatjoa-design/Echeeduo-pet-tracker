// Shared domain types. Rows mirror the DB (SPEC §5). Kept hand-written (no generated
// Supabase types) to stay simple.

export type UUID = string;

export type AppUser = {
  id: UUID;
  email: string;
  display_name: string;
};

export type Lookup = {
  id: UUID;
  category: string;
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
};

export type LookupCategory =
  | "care_event_type"
  | "food_type"
  | "food_unit"
  | "stool_consistency"
  | "symptom_type"
  | (string & {}); // future categories are valid too

export type Cat = {
  id: UUID;
  name: string;
  sex: "male" | "female" | null;
  birth_date: string | null;
  breed: string;
  neutered: boolean;
  microchip_no: string | null;
  photo_path: string | null;
  weight_target_grams: number | null;
  bcs_target_min: number;
  bcs_target_max: number;
  daily_kcal_override: number | null;
  accent_index: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export type Food = {
  id: UUID;
  name: string;
  brand: string | null;
  food_type_id: UUID;
  kcal_per_100g: number;
  unit_id: UUID | null;
  unit_grams: number | null;
  default_serving_grams: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export type FeedingLog = {
  id: UUID;
  cat_id: UUID;
  food_id: UUID;
  grams: number;
  qty: number | null;
  unit_label: string | null;
  kcal: number;
  fed_at: string;
  notes: string | null;
  created_by: UUID;
  is_active: boolean;
  created_at: string;
};

export type WeightLog = {
  id: UUID;
  cat_id: UUID;
  weight_grams: number;
  bcs: number | null;
  measured_at: string;
  notes: string | null;
  created_by: UUID;
  is_active: boolean;
  created_at: string;
};

export type CareEvent = {
  id: UUID;
  cat_id: UUID;
  event_type_id: UUID;
  title: string;
  due_date: string | null;
  due_time: string | null;
  done_at: string | null;
  interval_days: number | null;
  vet_name: string | null;
  notes: string | null;
  created_by: UUID;
  is_active: boolean;
  created_at: string;
};

export type Attachment = {
  id: UUID;
  entity_type: string;
  entity_id: UUID;
  storage_path: string;
  caption: string | null;
  created_by: UUID;
  is_active: boolean;
  created_at: string;
};

export type MealTemplate = {
  id: UUID;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
};

export type MealTemplateItem = {
  id: UUID;
  template_id: UUID;
  cat_id: UUID;
  food_id: UUID;
  qty: number | null;
  grams: number | null;
  is_active: boolean;
  created_at: string;
};

export type LitterLog = {
  id: UUID;
  cat_id: UUID | null;
  observed_at: string;
  urine: boolean;
  stool: boolean;
  stool_consistency_id: UUID | null;
  notes: string | null;
  created_by: UUID;
  is_active: boolean;
  created_at: string;
};

export type WaterLog = {
  id: UUID;
  cat_id: UUID;
  ml: number;
  logged_at: string;
  created_by: UUID;
  is_active: boolean;
  created_at: string;
};

export type SymptomLog = {
  id: UUID;
  cat_id: UUID;
  symptom_type_id: UUID;
  severity: number | null;
  noted_at: string;
  notes: string | null;
  created_by: UUID;
  is_active: boolean;
  created_at: string;
};
