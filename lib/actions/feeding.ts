"use server";

import { db } from "@/lib/db";
import { getCurrentAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  kcalFromGrams,
  dailyTarget,
  exceedsTreatLimit,
  round1,
} from "@/lib/kcal";
import { getLookupsByCategory } from "@/lib/lookups";
import { getTodayKcalByCat } from "@/lib/feeding-queries";

/**
 * Feeding mutations (SPEC §6.1, §6.4, §7). kcal is DENORMALIZED at write time —
 * we fetch the food's kcal_per_100g and store `kcal` on the log row so later
 * catalog edits never rewrite history. Every row carries `created_by`.
 */

function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}

function numOrNull(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ── Quick feed ────────────────────────────────────────────────────────────────

export async function logFeed(input: {
  cat_id: string;
  food_id: string;
  grams: number;
  qty?: number | null;
  unit_label?: string | null;
  fed_at?: string | null;
  notes?: string | null;
}): Promise<{ treatWarning: boolean }> {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");
  if (!input.cat_id) throw new Error("Please pick a cat.");
  if (!input.food_id) throw new Error("Please pick a food.");

  const grams = Number(input.grams);
  if (!Number.isFinite(grams) || grams <= 0) {
    throw new Error("Amount must be greater than 0.");
  }

  const database = db();

  const { data: food, error: foodErr } = await database
    .from("food_catalog")
    .select("id, kcal_per_100g, food_type_id")
    .eq("id", input.food_id)
    .maybeSingle();
  if (foodErr) throw new Error(foodErr.message);
  if (!food) throw new Error("Food not found.");

  const kcal = kcalFromGrams(grams, Number(food.kcal_per_100g));

  const row: Record<string, unknown> = {
    cat_id: input.cat_id,
    food_id: input.food_id,
    grams: round1(grams),
    qty: numOrNull(input.qty),
    unit_label: clean(input.unit_label),
    kcal,
    notes: clean(input.notes),
    created_by: me.id,
  };
  // Let the DB default (now()) stand unless an explicit time was provided.
  const fedAt = clean(input.fed_at);
  if (fedAt) row.fed_at = fedAt;

  const { error } = await database.from("feeding_logs").insert(row);
  if (error) throw new Error(error.message);

  // Treat rule (SPEC §6.1): only matters for snacks. One `if`, no rules engine.
  let treatWarning = false;
  const foodTypes = await getLookupsByCategory("food_type");
  const snackId = foodTypes.find((l) => l.code === "snack")?.id ?? null;
  if (snackId && food.food_type_id === snackId) {
    const [catRes, weightRes, byCat] = await Promise.all([
      database
        .from("cats")
        .select("daily_kcal_override, neutered")
        .eq("id", input.cat_id)
        .maybeSingle(),
      database
        .from("weight_logs")
        .select("weight_grams")
        .eq("cat_id", input.cat_id)
        .eq("is_active", true)
        .order("measured_at", { ascending: false })
        .limit(1),
      getTodayKcalByCat(),
    ]);
    if (catRes.data) {
      const latestWeight = weightRes.data?.[0]?.weight_grams ?? null;
      const target = dailyTarget(catRes.data, latestWeight ?? null);
      const snackKcal = byCat.get(input.cat_id)?.snackKcal ?? 0;
      treatWarning = exceedsTreatLimit(snackKcal, target);
    }
  }

  revalidatePath("/", "layout");
  return { treatWarning };
}

// ── Feed all (apply a meal template) ──────────────────────────────────────────

export async function applyMealTemplate(input: {
  template_id: string;
  rows: {
    cat_id: string;
    food_id: string;
    grams: number;
    qty?: number | null;
    unit_label?: string | null;
    notes?: string | null;
  }[];
}): Promise<{ count: number }> {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  const rows = input.rows ?? [];
  if (rows.length === 0) throw new Error("Nothing to log — every cat was skipped.");

  const database = db();

  const foodIds = Array.from(new Set(rows.map((r) => r.food_id)));
  const { data: foods, error: foodErr } = await database
    .from("food_catalog")
    .select("id, kcal_per_100g")
    .in("id", foodIds);
  if (foodErr) throw new Error(foodErr.message);

  const kcalMap = new Map(
    (foods ?? []).map((f) => [f.id as string, Number(f.kcal_per_100g)]),
  );

  const inserts = rows.map((r) => {
    if (!r.cat_id) throw new Error("Missing cat on a row.");
    const per100 = kcalMap.get(r.food_id);
    if (per100 == null) throw new Error("Food not found for a row.");
    const grams = Number(r.grams);
    if (!Number.isFinite(grams) || grams <= 0) {
      throw new Error("Every included row needs an amount greater than 0.");
    }
    return {
      cat_id: r.cat_id,
      food_id: r.food_id,
      grams: round1(grams),
      qty: numOrNull(r.qty),
      unit_label: clean(r.unit_label),
      kcal: kcalFromGrams(grams, per100),
      notes: clean(r.notes),
      created_by: me.id,
    };
  });

  const { error } = await database.from("feeding_logs").insert(inserts);
  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
  return { count: inserts.length };
}
