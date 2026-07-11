import "server-only";

import { db } from "@/lib/db";
import { APP_TZ, todayInTz, addDaysToDate } from "@/lib/time";
import { getLookupsByCategory } from "@/lib/lookups";
import { round1 } from "@/lib/kcal";
import type { FeedingLog } from "@/lib/types";

/**
 * Read helpers for the dashboard + cat profile (SPEC §6.1, §7). All reads go
 * through the service-role client. kcal is DENORMALIZED on the log row — we sum
 * it, never recompute from the catalog (history must survive catalog edits).
 *
 * "Today" is an Asia/Jakarta day: we compute the UTC instant of Jakarta midnight
 * and filter `fed_at >= that instant`.
 */

// ── Timezone helpers (Jakarta has no DST, but this is offset-correct anyway) ──

function tzOffsetMs(instant: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const m: Record<string, string> = {};
  for (const p of dtf.formatToParts(instant)) {
    if (p.type !== "literal") m[p.type] = p.value;
  }
  const asUTC = Date.UTC(
    +m.year,
    +m.month - 1,
    +m.day,
    +m.hour,
    +m.minute,
    +m.second,
  );
  return asUTC - instant.getTime();
}

/** UTC ISO instant of local midnight (start of day) for 'YYYY-MM-DD' in tz. */
export function startOfDayUtc(dateStr: string, tz: string = APP_TZ): string {
  const guess = new Date(`${dateStr}T00:00:00Z`);
  const offset = tzOffsetMs(guess, tz);
  return new Date(guess.getTime() - offset).toISOString();
}

/** 'YYYY-MM-DD' calendar day of a UTC instant, in tz. */
function tzDay(iso: string, tz: string = APP_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

// ── Types ────────────────────────────────────────────────────────────────────

export type LastFed = {
  fed_at: string;
  grams: number;
  food_name: string;
  by: string;
};

export type TodayCatTotals = {
  kcal: number;
  snackKcal: number;
  lastFed: LastFed | null;
};

export type FeedingHistoryRow = FeedingLog & {
  food_name: string;
  by: string;
};

export type KcalPoint = { date: string; kcal: number };

// ── Dashboard: today's kcal per cat ──────────────────────────────────────────

/**
 * Map<catId, { kcal, snackKcal, lastFed }> for today (Asia/Jakarta). Cats with
 * no feed today are simply absent from the map.
 */
export async function getTodayKcalByCat(): Promise<Map<string, TodayCatTotals>> {
  const start = startOfDayUtc(todayInTz());
  const database = db();

  const [logsRes, foodsRes, usersRes, foodTypes] = await Promise.all([
    database
      .from("feeding_logs")
      .select("cat_id, food_id, grams, kcal, fed_at, created_by")
      .eq("is_active", true)
      .gte("fed_at", start)
      .order("fed_at", { ascending: false }),
    database.from("food_catalog").select("id, name, food_type_id"),
    database.from("app_users").select("id, display_name"),
    getLookupsByCategory("food_type"),
  ]);

  const snackId = foodTypes.find((l) => l.code === "snack")?.id ?? null;
  const foodMap = new Map(
    (foodsRes.data ?? []).map((f) => [
      f.id as string,
      f as { id: string; name: string; food_type_id: string },
    ]),
  );
  const userMap = new Map(
    (usersRes.data ?? []).map((u) => [u.id as string, u.display_name as string]),
  );

  const out = new Map<string, TodayCatTotals>();
  // Rows arrive newest-first, so the first row seen per cat is the latest feed.
  for (const log of logsRes.data ?? []) {
    let e = out.get(log.cat_id);
    if (!e) {
      e = { kcal: 0, snackKcal: 0, lastFed: null };
      out.set(log.cat_id, e);
    }
    e.kcal = round1(e.kcal + Number(log.kcal));
    const food = foodMap.get(log.food_id);
    if (snackId && food?.food_type_id === snackId) {
      e.snackKcal = round1(e.snackKcal + Number(log.kcal));
    }
    if (!e.lastFed) {
      e.lastFed = {
        fed_at: log.fed_at,
        grams: Number(log.grams),
        food_name: food?.name ?? "—",
        by: userMap.get(log.created_by) ?? "—",
      };
    }
  }
  return out;
}

// ── Most-recently-used foods (for the quick-feed food list ordering) ──────────

/** Distinct food ids across the household, most recently fed first. */
export async function getMRUFoodIds(limit = 8): Promise<string[]> {
  const { data } = await db()
    .from("feeding_logs")
    .select("food_id, fed_at")
    .eq("is_active", true)
    .order("fed_at", { ascending: false })
    .limit(300);

  return dedupeFoodIds(data ?? [], limit);
}

/** Distinct food ids fed to a specific cat, most recently fed first. */
export async function getRecentFoodsForCat(
  cat_id: string,
  limit = 8,
): Promise<string[]> {
  const { data } = await db()
    .from("feeding_logs")
    .select("food_id, fed_at")
    .eq("cat_id", cat_id)
    .eq("is_active", true)
    .order("fed_at", { ascending: false })
    .limit(300);

  return dedupeFoodIds(data ?? [], limit);
}

/**
 * Per-cat MRU food ids in ONE query (dashboard): the household's last 300
 * feeding logs, deduped per cat, most-recent-first, capped at `limit` per cat.
 * Cats with no recent feeds are absent from the map.
 */
export async function getRecentFoodIdsByCat(
  limit = 8,
): Promise<Map<string, string[]>> {
  const { data } = await db()
    .from("feeding_logs")
    .select("cat_id, food_id, fed_at")
    .eq("is_active", true)
    .order("fed_at", { ascending: false })
    .limit(300);

  const out = new Map<string, string[]>();
  for (const r of data ?? []) {
    let list = out.get(r.cat_id);
    if (!list) {
      list = [];
      out.set(r.cat_id, list);
    }
    if (list.length >= limit || list.includes(r.food_id)) continue;
    list.push(r.food_id);
  }
  return out;
}

function dedupeFoodIds(
  rows: { food_id: string }[],
  limit: number,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    if (seen.has(r.food_id)) continue;
    seen.add(r.food_id);
    out.push(r.food_id);
    if (out.length >= limit) break;
  }
  return out;
}

// ── 7-day kcal series (dashboard sparkline) ───────────────────────────────────

/** 'YYYY-MM-DD' of 6 Jakarta days ago — the start of the 7-day window. */
function sevenDayStartDate(): string {
  return addDaysToDate(todayInTz(), -6);
}

/** Zero-filled buckets for the 7 Jakarta days starting at startDate. */
function empty7DayBuckets(startDate: string): Map<string, number> {
  const buckets = new Map<string, number>();
  for (let i = 0; i < 7; i++) buckets.set(addDaysToDate(startDate, i), 0);
  return buckets;
}

function bucketsToSeries(buckets: Map<string, number>): KcalPoint[] {
  return Array.from(buckets, ([date, kcal]) => ({ date, kcal }));
}

/** Zero-filled 7-day series — fallback for cats with no feeds in the window. */
export function empty7DayKcalSeries(): KcalPoint[] {
  return bucketsToSeries(empty7DayBuckets(sevenDayStartDate()));
}

/** Last 7 Jakarta days (oldest → today), 0-filled, for a cat. */
export async function get7DayKcalSeries(cat_id: string): Promise<KcalPoint[]> {
  const startDate = sevenDayStartDate();
  const start = startOfDayUtc(startDate);

  const { data } = await db()
    .from("feeding_logs")
    .select("kcal, fed_at")
    .eq("cat_id", cat_id)
    .eq("is_active", true)
    .gte("fed_at", start);

  const buckets = empty7DayBuckets(startDate);
  for (const log of data ?? []) {
    const day = tzDay(log.fed_at);
    if (buckets.has(day)) {
      buckets.set(day, round1(buckets.get(day)! + Number(log.kcal)));
    }
  }
  return bucketsToSeries(buckets);
}

/**
 * Last-7-Jakarta-day kcal series for EVERY cat in ONE feeding_logs query
 * (dashboard). Cats with no feeds in the window are absent from the map —
 * callers should fall back to `empty7DayKcalSeries()`.
 */
export async function get7DayKcalSeriesByCat(): Promise<
  Map<string, KcalPoint[]>
> {
  const startDate = sevenDayStartDate();
  const start = startOfDayUtc(startDate);

  const { data } = await db()
    .from("feeding_logs")
    .select("cat_id, kcal, fed_at")
    .eq("is_active", true)
    .gte("fed_at", start);

  const bucketsByCat = new Map<string, Map<string, number>>();
  for (const log of data ?? []) {
    let buckets = bucketsByCat.get(log.cat_id);
    if (!buckets) {
      buckets = empty7DayBuckets(startDate);
      bucketsByCat.set(log.cat_id, buckets);
    }
    const day = tzDay(log.fed_at);
    if (buckets.has(day)) {
      buckets.set(day, round1(buckets.get(day)! + Number(log.kcal)));
    }
  }

  const out = new Map<string, KcalPoint[]>();
  for (const [catId, buckets] of bucketsByCat) {
    out.set(catId, bucketsToSeries(buckets));
  }
  return out;
}

// ── Cat feeding history (profile + <FeedingHistory>) ──────────────────────────

export async function getCatFeedingHistory(
  cat_id: string,
  limit = 50,
): Promise<FeedingHistoryRow[]> {
  const database = db();
  const { data: logs } = await database
    .from("feeding_logs")
    .select("*")
    .eq("cat_id", cat_id)
    .eq("is_active", true)
    .order("fed_at", { ascending: false })
    .limit(limit);

  const rows = (logs ?? []) as FeedingLog[];
  if (rows.length === 0) return [];

  const foodIds = Array.from(new Set(rows.map((r) => r.food_id)));
  const userIds = Array.from(new Set(rows.map((r) => r.created_by)));

  const [foodsRes, usersRes] = await Promise.all([
    database.from("food_catalog").select("id, name").in("id", foodIds),
    database.from("app_users").select("id, display_name").in("id", userIds),
  ]);

  const foodMap = new Map(
    (foodsRes.data ?? []).map((f) => [f.id as string, f.name as string]),
  );
  const userMap = new Map(
    (usersRes.data ?? []).map((u) => [u.id as string, u.display_name as string]),
  );

  return rows.map((r) => ({
    ...r,
    food_name: foodMap.get(r.food_id) ?? "—",
    by: userMap.get(r.created_by) ?? "—",
  }));
}
