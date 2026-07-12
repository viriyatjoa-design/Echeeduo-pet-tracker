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

/** Result envelope so thrown Errors aren't stripped by the prod banner. */
export type ActionResult = { ok: true } | { ok: false; error: string };

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

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
}): Promise<ActionResult> {
  try {
    const me = await getCurrentAppUser();
    if (!me) return { ok: false, error: "Unauthorized" };

    const name = clean(input.name);
    if (!name) return { ok: false, error: "Template name is required." };

    const { error } = await db()
      .from("meal_templates")
      .insert({ name, sort_order: toSortOrder(input.sort_order) });
    if (error) return { ok: false, error: error.message };

    revalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

export async function updateTemplate(
  id: string,
  input: { name: string; sort_order?: number | string | null },
): Promise<ActionResult> {
  try {
    const me = await getCurrentAppUser();
    if (!me) return { ok: false, error: "Unauthorized" };
    if (!id) return { ok: false, error: "Missing template id." };

    const name = clean(input.name);
    if (!name) return { ok: false, error: "Template name is required." };

    const { error } = await db()
      .from("meal_templates")
      .update({ name, sort_order: toSortOrder(input.sort_order) })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
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

export async function upsertTemplateItem(
  input: TemplateItemInput,
): Promise<ActionResult> {
  try {
    const me = await getCurrentAppUser();
    if (!me) return { ok: false, error: "Unauthorized" };

    if (!input.template_id) return { ok: false, error: "Missing template." };
    if (!input.cat_id) return { ok: false, error: "Please pick a cat." };
    if (!input.food_id) return { ok: false, error: "Please pick a food." };

    const qty = numOrNull(input.qty);
    const grams = numOrNull(input.grams);

    // Enforce EXACTLY ONE of qty / grams (mirrors the DB check).
    const hasQty = qty !== null;
    const hasGrams = grams !== null;
    if (hasQty === hasGrams) {
      return { ok: false, error: "Set exactly one amount: a portion (qty) or grams." };
    }
    if (hasQty && qty! <= 0) return { ok: false, error: "Portion must be greater than 0." };
    if (hasGrams && grams! <= 0) return { ok: false, error: "Grams must be greater than 0." };

    const row = {
      template_id: input.template_id,
      cat_id: input.cat_id,
      food_id: input.food_id,
      qty: hasQty ? qty : null,
      grams: hasGrams ? grams : null,
    };

    const database = db();

    // One item per cat per template (SPEC §6.4) — the feed-all review keys rows
    // by cat, so duplicates would collide there.
    let dupQuery = database
      .from("meal_template_items")
      .select("id")
      .eq("template_id", input.template_id)
      .eq("cat_id", input.cat_id)
      .eq("is_active", true);
    if (input.id) dupQuery = dupQuery.neq("id", input.id);
    const { data: dup, error: dupErr } = await dupQuery.limit(1);
    if (dupErr) return { ok: false, error: dupErr.message };
    if (dup && dup.length > 0) {
      return {
        ok: false,
        error: "That cat already has an item on this template — edit it instead.",
      };
    }
    if (input.id) {
      const { error } = await database
        .from("meal_template_items")
        .update(row)
        .eq("id", input.id);
      if (error) return { ok: false, error: error.message };
    } else {
      const { error } = await database.from("meal_template_items").insert(row);
      if (error) return { ok: false, error: error.message };
    }

    revalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

export async function removeTemplateItem(id: string): Promise<ActionResult> {
  try {
    const me = await getCurrentAppUser();
    if (!me) return { ok: false, error: "Unauthorized" };
    if (!id) return { ok: false, error: "Missing item id." };

    const { error } = await db()
      .from("meal_template_items")
      .update({ is_active: false })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };

    revalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}
