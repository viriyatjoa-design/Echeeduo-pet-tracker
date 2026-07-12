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
import { consumeForFeedings } from "@/lib/inventory-consume";

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

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

// ── Quick feed ────────────────────────────────────────────────────────────────

export type LogFeedResult =
  | { ok: true; treatWarning: boolean }
  | { ok: false; error: string };

export async function logFeed(input: {
  cat_id: string;
  food_id: string;
  grams: number;
  qty?: number | null;
  unit_label?: string | null;
  fed_at?: string | null;
  notes?: string | null;
}): Promise<LogFeedResult> {
  try {
    const me = await getCurrentAppUser();
    if (!me) return { ok: false, error: "Unauthorized" };
    if (!input.cat_id) return { ok: false, error: "Please pick a cat." };
    if (!input.food_id) return { ok: false, error: "Please pick a food." };

    const grams = Number(input.grams);
    if (!Number.isFinite(grams) || grams <= 0) {
      return { ok: false, error: "Amount must be greater than 0." };
    }

    const database = db();

    const { data: food, error: foodErr } = await database
      .from("food_catalog")
      .select("id, kcal_per_100g, food_type_id")
      .eq("id", input.food_id)
      .maybeSingle();
    if (foodErr) return { ok: false, error: foodErr.message };
    if (!food) return { ok: false, error: "Food not found." };

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
    // Let the DB default (now()) stand unless an explicit time was provided
    // (backdated "we forgot to log" entries). Never in the future.
    const fedAt = clean(input.fed_at);
    if (fedAt) {
      const t = Date.parse(fedAt);
      if (!Number.isFinite(t)) return { ok: false, error: "Invalid feeding time." };
      if (t > Date.now() + 5 * 60_000) {
        return { ok: false, error: "Feeding time can't be in the future." };
      }
      row.fed_at = fedAt;
    }

    const { data: inserted, error } = await database
      .from("feeding_logs")
      .insert(row)
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };

    // Inventory consumption hook (SPEC §11) — best-effort, never throws.
    await consumeForFeedings(
      [
        {
          food_id: input.food_id,
          grams: round1(grams),
          feeding_log_id: inserted?.id ?? null,
        },
      ],
      me.id,
    );

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
          // Same-day re-weigh tiebreak as the dashboard (weight-queries.ts), so
          // the save-time treat toast and the card's badge use the SAME weight.
          .order("created_at", { ascending: false })
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
    return { ok: true, treatWarning };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

// ── Feed all (apply a meal template) ──────────────────────────────────────────

export type ApplyMealTemplateResult =
  | { ok: true; count: number; treatWarningCats: string[] }
  | { ok: false; error: string };

export async function applyMealTemplate(input: {
  template_id: string;
  /** Optional backdated time applied to every row (forgotten meal). */
  fed_at?: string | null;
  rows: {
    cat_id: string;
    food_id: string;
    grams: number;
    qty?: number | null;
    unit_label?: string | null;
    notes?: string | null;
  }[];
}): Promise<ApplyMealTemplateResult> {
  try {
    const me = await getCurrentAppUser();
    if (!me) return { ok: false, error: "Unauthorized" };

    const rows = input.rows ?? [];
    if (rows.length === 0) {
      return { ok: false, error: "Nothing to log — every cat was skipped." };
    }

    const fedAt = clean(input.fed_at);
    if (fedAt) {
      const t = Date.parse(fedAt);
      if (!Number.isFinite(t)) return { ok: false, error: "Invalid feeding time." };
      if (t > Date.now() + 5 * 60_000) {
        return { ok: false, error: "Feeding time can't be in the future." };
      }
    }

    const database = db();

    const foodIds = Array.from(new Set(rows.map((r) => r.food_id)));
    const { data: foods, error: foodErr } = await database
      .from("food_catalog")
      .select("id, kcal_per_100g, food_type_id")
      .in("id", foodIds);
    if (foodErr) return { ok: false, error: foodErr.message };

    const kcalMap = new Map(
      (foods ?? []).map((f) => [f.id as string, Number(f.kcal_per_100g)]),
    );
    const typeMap = new Map(
      (foods ?? []).map((f) => [f.id as string, f.food_type_id as string]),
    );

    // Validate rows up front; a bad row is a caller error, not a crash.
    for (const r of rows) {
      if (!r.cat_id) return { ok: false, error: "Missing cat on a row." };
      if (kcalMap.get(r.food_id) == null) {
        return { ok: false, error: "Food not found for a row." };
      }
      const grams = Number(r.grams);
      if (!Number.isFinite(grams) || grams <= 0) {
        return {
          ok: false,
          error: "Every included row needs an amount greater than 0.",
        };
      }
    }

    const inserts = rows.map((r) => {
      const per100 = kcalMap.get(r.food_id)!;
      const grams = Number(r.grams);
      return {
        cat_id: r.cat_id,
        food_id: r.food_id,
        grams: round1(grams),
        qty: numOrNull(r.qty),
        unit_label: clean(r.unit_label),
        kcal: kcalFromGrams(grams, per100),
        notes: clean(r.notes),
        created_by: me.id,
        ...(fedAt ? { fed_at: fedAt } : {}),
      };
    });

    const { data: insertedRows, error } = await database
      .from("feeding_logs")
      .insert(inserts)
      .select("id, food_id, grams");
    if (error) return { ok: false, error: error.message };

    // Inventory consumption hook (SPEC §11) — best-effort, never throws.
    await consumeForFeedings(
      (insertedRows ?? []).map((r) => ({
        food_id: r.food_id as string,
        grams: Number(r.grams),
        feeding_log_id: r.id as string,
      })),
      me.id,
    );

    // Treat rule on the feed-all path too (SPEC §6.1): warn per cat whose snack
    // kcal now exceeds 10% of target. Same one-`if` logic as logFeed.
    const treatWarningCats: string[] = [];
    const foodTypes = await getLookupsByCategory("food_type");
    const snackId = foodTypes.find((l) => l.code === "snack")?.id ?? null;
    const snackCatIds = snackId
      ? Array.from(
          new Set(
            rows.filter((r) => typeMap.get(r.food_id) === snackId).map((r) => r.cat_id),
          ),
        )
      : [];
    if (snackCatIds.length > 0) {
      const [catsRes, weightsRes, byCat] = await Promise.all([
        database
          .from("cats")
          .select("id, name, daily_kcal_override, neutered")
          .in("id", snackCatIds),
        database
          .from("weight_logs")
          .select("cat_id, weight_grams, measured_at")
          .in("cat_id", snackCatIds)
          .eq("is_active", true)
          .order("measured_at", { ascending: false })
          // Match the dashboard's same-day tiebreak (weight-queries.ts).
          .order("created_at", { ascending: false }),
        getTodayKcalByCat(),
      ]);
      const latestWeightByCat = new Map<string, number>();
      for (const w of weightsRes.data ?? []) {
        if (!latestWeightByCat.has(w.cat_id)) {
          latestWeightByCat.set(w.cat_id, w.weight_grams);
        }
      }
      for (const cat of catsRes.data ?? []) {
        const target = dailyTarget(cat, latestWeightByCat.get(cat.id) ?? null);
        const snackKcal = byCat.get(cat.id)?.snackKcal ?? 0;
        if (exceedsTreatLimit(snackKcal, target)) treatWarningCats.push(cat.name);
      }
    }

    revalidatePath("/", "layout");
    return { ok: true, count: inserts.length, treatWarningCats };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}
