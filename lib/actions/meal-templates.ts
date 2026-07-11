"use server";

import { db } from "@/lib/db";
import { getCurrentAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Meal templates + their per-cat items (SPEC §5, §6.4). Templates store INTENT
 * (food + amount per cat); the feed-all flow reads them and inserts feeding_logs
 * (facts) at apply time. Neither table has created_by — shared reference data.
 *
 * Item amount is EXACTLY ONE of qty (portion, when the food has a unit) or grams
 * (direct). This mirrors the DB check `((qty is null) <> (grams is null))`.
 */

function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}

function toSortOrder(v: number | string | null | undefined): number {
  if (v === null || v === undefined || String(v).trim() === "") return 0;
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? n : 0;
}

function revalidate() {
  revalidatePath("/catalog");
  revalidatePath("/");
}

// ── Templates ────────────────────────────────────────────────────────────────

export async function createTemplate(input: {
  name: string;
  sort_order?: number | string | null;
}) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  const name = clean(input.name);
  if (!name) throw new Error("Template name is required.");

  const { error } = await db()
    .from("meal_templates")
    .insert({ name, sort_order: toSortOrder(input.sort_order) });
  if (error) throw new Error(error.message);

  revalidate();
}

export async function updateTemplate(
  id: string,
  input: { name: string; sort_order?: number | string | null },
) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");
  if (!id) throw new Error("Missing template id.");

  const name = clean(input.name);
  if (!name) throw new Error("Template name is required.");

  const { error } = await db()
    .from("meal_templates")
    .update({ name, sort_order: toSortOrder(input.sort_order) })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidate();
}

export async function setTemplateActive(id: string, active: boolean) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");
  if (!id) throw new Error("Missing template id.");

  const { error } = await db()
    .from("meal_templates")
    .update({ is_active: active })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidate();
}

// ── Template items ───────────────────────────────────────────────────────────

export type TemplateItemInput = {
  /** present = update, absent = insert */
  id?: string;
  template_id: string;
  cat_id: string;
  food_id: string;
  /** portion — set this when the food HAS a unit */
  qty?: number | null;
  /** direct grams — set this when the food has NO unit */
  grams?: number | null;
};

function numOrNull(v: number | null | undefined): number | null {
  if (v === null || v === undefined || String(v).trim?.() === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n;
}

export async function upsertTemplateItem(input: TemplateItemInput) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  if (!input.template_id) throw new Error("Missing template.");
  if (!input.cat_id) throw new Error("Please pick a cat.");
  if (!input.food_id) throw new Error("Please pick a food.");

  const qty = numOrNull(input.qty);
  const grams = numOrNull(input.grams);

  // Enforce EXACTLY ONE of qty / grams (mirrors the DB check).
  const hasQty = qty !== null;
  const hasGrams = grams !== null;
  if (hasQty === hasGrams) {
    throw new Error("Set exactly one amount: a portion (qty) or grams.");
  }
  if (hasQty && qty! <= 0) throw new Error("Portion must be greater than 0.");
  if (hasGrams && grams! <= 0) throw new Error("Grams must be greater than 0.");

  const row = {
    template_id: input.template_id,
    cat_id: input.cat_id,
    food_id: input.food_id,
    qty: hasQty ? qty : null,
    grams: hasGrams ? grams : null,
  };

  const database = db();
  if (input.id) {
    const { error } = await database
      .from("meal_template_items")
      .update(row)
      .eq("id", input.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await database.from("meal_template_items").insert(row);
    if (error) throw new Error(error.message);
  }

  revalidate();
}

export async function removeTemplateItem(id: string) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");
  if (!id) throw new Error("Missing item id.");

  const { error } = await db()
    .from("meal_template_items")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidate();
}
