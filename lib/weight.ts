// Weight trend flag — SPEC §6.3. Compute on read; no background jobs.

import type { WeightLog } from "@/lib/types";
import { daysBetween } from "@/lib/time";

export type WeightTrend = {
  direction: "up" | "down";
  pct: number; // absolute percent change, 1 decimal
  latestGrams: number;
  fromGrams: number;
  overDays: number;
} | null;

const MIN_DAYS = 25;
const THRESHOLD = 0.05;

/**
 * Compare latest weight to the closest log ≥25 days older. |Δ| ≥ 5% → a trend.
 * `logs` may be in any order; only active logs should be passed in.
 */
export function weightTrend(logs: WeightLog[]): WeightTrend {
  if (logs.length < 2) return null;
  const sorted = [...logs].sort((a, b) =>
    a.measured_at < b.measured_at ? 1 : -1,
  ); // newest first
  const latest = sorted[0];

  // closest older log that is ≥ MIN_DAYS before latest
  let baseline: WeightLog | null = null;
  for (let i = 1; i < sorted.length; i++) {
    if (daysBetween(sorted[i].measured_at, latest.measured_at) >= MIN_DAYS) {
      baseline = sorted[i];
      break;
    }
  }
  if (!baseline) return null;

  const delta = (latest.weight_grams - baseline.weight_grams) / baseline.weight_grams;
  if (Math.abs(delta) < THRESHOLD) return null;

  return {
    direction: delta > 0 ? "up" : "down",
    pct: Math.round(Math.abs(delta) * 1000) / 10,
    latestGrams: latest.weight_grams,
    fromGrams: baseline.weight_grams,
    overDays: daysBetween(baseline.measured_at, latest.measured_at),
  };
}

export function gramsToKg(grams: number): string {
  return (grams / 1000).toFixed(2);
}
