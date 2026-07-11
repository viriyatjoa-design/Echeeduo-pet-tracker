"use server";

import { db } from "@/lib/db";
import { getCurrentAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Foods (food_catalog) mutations. SPEC §5 + §6.4.
 * Note: food_catalog has NO created_by column — it's shared household reference
 * data, not an attributed log — so we auth-guard but don't stamp a user.
 */

export type FoodInput = {
  name: string;
  brand?: string | null;
  food_type_id: string;
  kcal_per_100g: number;
  /** category 'food_unit'; null = grams-only food */
  unit_id?: string | null;
  /** grams in one unit (e.g. 85 for a can); required IFF unit_id set */
  unit_grams?: number | null;
  default_serving_grams?: number | null;
  notes?: string | null;
};

type NormalizedFood = {
  name: string;
  brand: string | null;
  food_type_id: string;
  kcal_per_100g: number;
  unit_id: string | null;
  unit_grams: number | null;
  default_serving_grams: number | null;
  notes: string | null;
};

function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}

/** Validate + coerce a FoodInput into a DB-ready row. Throws on invalid input. */
function normalize(input: FoodInput): NormalizedFood {
  const name = clean(input.name);
  if (!name) throw new Error("Food name is required.");

  if (!input.food_type_id) throw new Error("Food type is required.");

  const kcal = Number(input.kcal_per_100g);
  if (!Number.isFinite(kcal) || kcal <= 0) {
    throw new Error("Calories per 100 g must be greater than 0.");
  }

  // Unit is optional. If a unit is set, unit_grams > 0 is required; otherwise
  // both must be null (mirrors the DB check unit_grams > 0).
  const unit_id = clean(input.unit_id);
  let unit_grams: number | null = null;
  if (unit_id) {
    const g = Number(input.unit_grams);
    if (!Number.isFinite(g) || g <= 0) {
      throw new Error("Grams per unit must be greater than 0 when a unit is set.");
    }
    unit_grams = g;
  }

  let default_serving_grams: number | null = null;
  if (
    input.default_serving_grams !== null &&
    input.default_serving_grams !== undefined &&
    String(input.default_serving_grams).trim() !== ""
  ) {
    const d = Math.round(Number(input.default_serving_grams));
    if (!Number.isFinite(d) || d <= 0) {
      throw new Error("Default serving must be a positive number of grams.");
    }
    default_serving_grams = d;
  }

  return {
    name,
    brand: clean(input.brand),
    food_type_id: input.food_type_id,
    kcal_per_100g: kcal,
    unit_id,
    unit_grams,
    default_serving_grams,
    notes: clean(input.notes),
  };
}

function revalidate() {
  revalidatePath("/catalog");
  revalidatePath("/log/feed");
  revalidatePath("/");
}

export async function createFood(input: FoodInput) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  const row = normalize(input);
  const { error } = await db().from("food_catalog").insert(row);
  if (error) throw new Error(error.message);

  revalidate();
}

export async function updateFood(id: string, input: FoodInput) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");
  if (!id) throw new Error("Missing food id.");

  const row = normalize(input);
  const { error } = await db().from("food_catalog").update(row).eq("id", id);
  if (error) throw new Error(error.message);

  revalidate();
}

export async function setFoodActive(id: string, active: boolean) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");
  if (!id) throw new Error("Missing food id.");

  const { error } = await db()
    .from("food_catalog")
    .update({ is_active: active })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidate();
}
