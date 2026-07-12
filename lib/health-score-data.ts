import "server-only";
import { db } from "@/lib/db";
import { getWeightLogs } from "@/lib/weight-queries";
import { getOpenCareByCat } from "@/lib/care-queries";
import { computeMER } from "@/lib/kcal";
import { BREED_REF } from "@/lib/cat-care-facts";
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

  const [weights, feedsRes, waterRes, openByCat] = await Promise.all([
    getWeightLogs(cat.id),
    // Lean: only the columns the scorecard needs, windowed — no food/user joins.
    db()
      .from("feeding_logs")
      .select("kcal, fed_at")
      .eq("cat_id", cat.id)
      .eq("is_active", true)
      .gte("fed_at", sinceIso),
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
  // BCS from the most recent weigh-in that actually recorded one (a newer
  // weight-only entry must not blank an existing body-condition score).
  const latestBcs = weights.find((w) => w.bcs != null)?.bcs ?? null;

  // Average kcal on days that actually had a feed within the window.
  const kcalByDay = new Map<string, number>();
  for (const f of (feedsRes.data ?? []) as { kcal: number; fed_at: string }[]) {
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

  // Eating is graded against the calorie need at IDEAL weight, not current —
  // otherwise an overweight cat's inflated MER makes "eating to stay obese"
  // read as on-track. Clamp current weight into the ideal band for the target.
  // (The dashboard's feeding ring still uses current weight; that's correct
  // there — this target is specifically "what they should eat at a healthy weight".)
  const band =
    BREED_REF.idealWeightGrams[cat.sex ?? "unknown"] ??
    BREED_REF.idealWeightGrams.unknown;
  const idealForKcal =
    latestWeightGrams != null
      ? Math.max(band.min, Math.min(latestWeightGrams, band.max))
      : null;
  const dailyKcalTarget =
    cat.daily_kcal_override ??
    (idealForKcal != null ? computeMER(idealForKcal, cat.neutered) : null);

  const input: ScoreInput = {
    sex: cat.sex,
    latestWeightGrams,
    latestBcs,
    bcsTargetMin: cat.bcs_target_min,
    bcsTargetMax: cat.bcs_target_max,
    dailyKcalTarget,
    avgKcal,
    kcalDays,
    avgWaterMl,
    overdueCare,
  };

  return healthScorecard(input);
}
