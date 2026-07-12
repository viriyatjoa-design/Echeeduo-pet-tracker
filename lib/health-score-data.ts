import "server-only";
import { db } from "@/lib/db";
import { getWeightLogs } from "@/lib/weight-queries";
import { getCatFeedingHistory } from "@/lib/feeding-queries";
import { getOpenCareByCat } from "@/lib/care-queries";
import { dailyTarget } from "@/lib/kcal";
import { todayInTz, addDaysToDate, daysBetween, APP_TZ } from "@/lib/time";
import { healthScorecard, type Scorecard, type ScoreInput } from "@/lib/health-score";
import type { Cat } from "@/lib/types";

/**
 * Assemble the Health Scorecard for a cat from existing data (weights, feeds,
 * water, overdue care) and grade it with the pure engine. SERVER ONLY.
 * Window = the last WINDOW_DAYS Jakarta days.
 */
const WINDOW_DAYS = 14;

/** 'YYYY-MM-DD' Jakarta day for a timestamptz ISO string. */
function dayInTz(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export async function getHealthScorecard(cat: Cat): Promise<Scorecard> {
  const today = todayInTz();
  const windowStart = addDaysToDate(today, -(WINDOW_DAYS - 1));
  // A day before the window in UTC comfortably covers the Jakarta boundary.
  const sinceIso = `${addDaysToDate(windowStart, -1)}T00:00:00Z`;

  const [weights, feeds, waterRes, openByCat] = await Promise.all([
    getWeightLogs(cat.id),
    getCatFeedingHistory(cat.id, 400),
    db()
      .from("water_logs")
      .select("ml, logged_at")
      .eq("cat_id", cat.id)
      .eq("is_active", true)
      .gte("logged_at", sinceIso),
    getOpenCareByCat(),
  ]);

  const latest = weights[0] ?? null;
  const latestWeightGrams = latest?.weight_grams ?? null;

  // Average kcal on days that actually had a feed within the window.
  const kcalByDay = new Map<string, number>();
  for (const f of feeds) {
    const day = dayInTz(f.fed_at);
    if (day < windowStart || day > today) continue;
    kcalByDay.set(day, (kcalByDay.get(day) ?? 0) + Number(f.kcal));
  }
  const kcalDays = kcalByDay.size;
  const avgKcal =
    kcalDays > 0
      ? [...kcalByDay.values()].reduce((a, b) => a + b, 0) / kcalDays
      : null;

  // Average LOGGED water per calendar day across the window (0-filled).
  let waterTotal = 0;
  let anyWater = false;
  for (const r of (waterRes.data ?? []) as { ml: number; logged_at: string }[]) {
    const day = dayInTz(r.logged_at);
    if (day < windowStart || day > today) continue;
    waterTotal += Number(r.ml);
    anyWater = true;
  }
  const avgWaterMl = anyWater ? waterTotal / WINDOW_DAYS : null;

  // Overdue open care for this cat, most-overdue first.
  const overdueCare = (openByCat.get(cat.id) ?? [])
    .filter((e) => e.due_date != null && e.due_date < today)
    .map((e) => ({
      title: e.title,
      daysOverdue: daysBetween(e.due_date!, today),
    }))
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const input: ScoreInput = {
    sex: cat.sex,
    latestWeightGrams,
    latestBcs: latest?.bcs ?? null,
    bcsTargetMin: cat.bcs_target_min,
    bcsTargetMax: cat.bcs_target_max,
    dailyKcalTarget: dailyTarget(cat, latestWeightGrams),
    avgKcal,
    kcalDays,
    avgWaterMl,
    overdueCare,
  };

  return healthScorecard(input);
}
