// Calorie math — spelled out exactly as SPEC §6.1. Boring on purpose.

import type { Cat } from "@/lib/types";

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** grams × kcal/100g / 100, rounded to 0.1. Computed at write time and stored. */
export function kcalFromGrams(grams: number, kcalPer100g: number): number {
  return round1((grams * kcalPer100g) / 100);
}

/** Portion → grams: qty × unit_grams, rounded to 0.1 (e.g. ½ × 85 = 42.5). */
export function gramsFromPortion(qty: number, unitGrams: number): number {
  return round1(qty * unitGrams);
}

/** Maintenance Energy Requirement. factor = 1.2 neutered, else 1.4. */
export function computeMER(weightGrams: number, neutered: boolean): number {
  const kg = weightGrams / 1000;
  const factor = neutered ? 1.2 : 1.4;
  return Math.round(70 * Math.pow(kg, 0.75) * factor);
}

/**
 * Daily kcal target: override wins; else MER from latest weight; else null
 * (no weight logged yet → UI shows grams only + a nudge, not a fake target).
 */
export function dailyTarget(
  cat: Pick<Cat, "daily_kcal_override" | "neutered">,
  latestWeightGrams: number | null,
): number | null {
  if (cat.daily_kcal_override) return cat.daily_kcal_override;
  if (latestWeightGrams && latestWeightGrams > 0) {
    return computeMER(latestWeightGrams, cat.neutered);
  }
  return null;
}

/** Snack cap: today's snack kcal > 10% of target → amber warning (SPEC §6.1). */
export const TREAT_LIMIT_RATIO = 0.1;

export function exceedsTreatLimit(
  snackKcalToday: number,
  target: number | null,
): boolean {
  if (!target || target <= 0) return false;
  return snackKcalToday > target * TREAT_LIMIT_RATIO;
}

/** Portion + grams → history label, e.g. "½ can · 42.5 g" or "40 g". */
const FRACTIONS: Record<string, string> = {
  "0.25": "¼",
  "0.33": "⅓",
  "0.5": "½",
  "0.66": "⅔",
  "0.67": "⅔",
  "0.75": "¾",
  "1.5": "1½",
};

export function portionLabel(
  qty: number | null,
  unitLabel: string | null,
  grams: number,
): string {
  if (qty != null && unitLabel) {
    const key = String(qty);
    const q = FRACTIONS[key] ?? String(qty);
    return `${q} ${unitLabel} · ${round1(grams)} g`;
  }
  return `${round1(grams)} g`;
}
