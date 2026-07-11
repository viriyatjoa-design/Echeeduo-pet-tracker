import "server-only";
import { db } from "@/lib/db";
import { getLookupMap } from "@/lib/lookups";
import { todayInTz, addDaysToDate, APP_TZ } from "@/lib/time";
import type { UUID } from "@/lib/types";

/**
 * Read helpers for the observation layer (SPEC §6.5, §7). SERVER ONLY.
 * All reads go through the service-role `db()` client. Times are stored UTC and
 * bucketed / displayed in Asia/Jakarta.
 */

/** 'YYYY-MM-DD' Jakarta calendar day for an ISO timestamp. */
function dateInTz(iso: string, tz: string = APP_TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

// ── Journal entries (interleaved, newest-first) ──────────────────────────────

export type JournalLitterEntry = {
  kind: "litter";
  id: UUID;
  at: string;
  cat_id: UUID | null;
  by: string;
  urine: boolean;
  stool: boolean;
  stool_consistency_label: string | null;
  notes: string | null;
};

export type JournalSymptomEntry = {
  kind: "symptom";
  id: UUID;
  at: string;
  cat_id: UUID;
  by: string;
  symptom_label: string;
  severity: number | null;
  notes: string | null;
};

export type JournalWaterEntry = {
  kind: "water";
  id: UUID;
  at: string;
  cat_id: UUID;
  by: string;
  ml: number;
};

export type JournalEntry =
  | JournalLitterEntry
  | JournalSymptomEntry
  | JournalWaterEntry;

/**
 * Merged, time-sorted (newest first) household journal of litter, symptom, and
 * water entries. If `catId` is given, only that cat's entries are returned
 * (strict — unattributed/null-cat litter is excluded). The `/journal` page
 * fetches everything and filters on the client so null-cat litter can still
 * appear under "All".
 */
export async function getJournalEntries(
  opts: { catId?: UUID | null } = {},
): Promise<JournalEntry[]> {
  const database = db();
  const [litterRes, symptomRes, waterRes, lookupMap, usersRes] =
    await Promise.all([
      database
        .from("litter_logs")
        .select("*")
        .eq("is_active", true)
        .order("observed_at", { ascending: false })
        .limit(200),
      database
        .from("symptom_logs")
        .select("*")
        .eq("is_active", true)
        .order("noted_at", { ascending: false })
        .limit(200),
      database
        .from("water_logs")
        .select("*")
        .eq("is_active", true)
        .order("logged_at", { ascending: false })
        .limit(200),
      getLookupMap(),
      database.from("app_users").select("id, display_name"),
    ]);

  const nameById = new Map<string, string>(
    ((usersRes.data ?? []) as { id: string; display_name: string }[]).map(
      (u) => [u.id, u.display_name],
    ),
  );
  const nameFor = (id: string) => nameById.get(id) ?? "Someone";

  const entries: JournalEntry[] = [];

  for (const r of (litterRes.data ?? []) as {
    id: UUID;
    cat_id: UUID | null;
    observed_at: string;
    urine: boolean;
    stool: boolean;
    stool_consistency_id: UUID | null;
    notes: string | null;
    created_by: UUID;
  }[]) {
    entries.push({
      kind: "litter",
      id: r.id,
      at: r.observed_at,
      cat_id: r.cat_id,
      by: nameFor(r.created_by),
      urine: r.urine,
      stool: r.stool,
      stool_consistency_label: r.stool_consistency_id
        ? (lookupMap.get(r.stool_consistency_id)?.label ?? null)
        : null,
      notes: r.notes,
    });
  }

  for (const r of (symptomRes.data ?? []) as {
    id: UUID;
    cat_id: UUID;
    noted_at: string;
    symptom_type_id: UUID;
    severity: number | null;
    notes: string | null;
    created_by: UUID;
  }[]) {
    entries.push({
      kind: "symptom",
      id: r.id,
      at: r.noted_at,
      cat_id: r.cat_id,
      by: nameFor(r.created_by),
      symptom_label: lookupMap.get(r.symptom_type_id)?.label ?? "Symptom",
      severity: r.severity,
      notes: r.notes,
    });
  }

  for (const r of (waterRes.data ?? []) as {
    id: UUID;
    cat_id: UUID;
    logged_at: string;
    ml: number;
    created_by: UUID;
  }[]) {
    entries.push({
      kind: "water",
      id: r.id,
      at: r.logged_at,
      cat_id: r.cat_id,
      by: nameFor(r.created_by),
      ml: r.ml,
    });
  }

  entries.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));

  if (opts.catId) {
    return entries.filter((e) => e.cat_id === opts.catId);
  }
  return entries;
}

// ── Today's water per cat (dashboard) ────────────────────────────────────────

/**
 * Map of cat_id → total ml logged for that cat *today* (Asia/Jakarta).
 * Cats with no water today are absent from the map (treat as 0).
 */
export async function getTodayWaterByCat(): Promise<Map<string, number>> {
  const today = todayInTz();
  // Safe lower bound in UTC: a full day before "today" comfortably covers the
  // Jakarta day boundary; we filter precisely by Jakarta date below.
  const sinceIso = `${addDaysToDate(today, -1)}T00:00:00Z`;

  const { data, error } = await db()
    .from("water_logs")
    .select("cat_id, ml, logged_at")
    .eq("is_active", true)
    .gte("logged_at", sinceIso);
  if (error) throw new Error(error.message);

  const totals = new Map<string, number>();
  for (const r of (data ?? []) as {
    cat_id: string;
    ml: number;
    logged_at: string;
  }[]) {
    if (dateInTz(r.logged_at) !== today) continue;
    totals.set(r.cat_id, (totals.get(r.cat_id) ?? 0) + r.ml);
  }
  return totals;
}

// ── Per-cat health (profile tab) ─────────────────────────────────────────────

export type CatSymptomRow = {
  id: UUID;
  at: string;
  symptom_label: string;
  severity: number | null;
  notes: string | null;
};

export type CatLitterRow = {
  id: UUID;
  at: string;
  urine: boolean;
  stool: boolean;
  stool_consistency_label: string | null;
  notes: string | null;
};

/** One point on the water chart: a Jakarta calendar day and its total ml. */
export type WaterDayPoint = { date: string; ml: number };

export type CatHealth = {
  symptoms: CatSymptomRow[];
  /** ATTRIBUTED litter only (null-cat household entries live in /journal). */
  litter: CatLitterRow[];
  /** ~14 days, ascending, one point per day (missing days filled with 0). */
  water: WaterDayPoint[];
};

const WATER_WINDOW_DAYS = 14;

/**
 * Symptoms + attributed litter (newest first) and a 14-day water series for one
 * cat (SPEC §6.5, §7 health tab).
 */
export async function getCatHealth(catId: UUID): Promise<CatHealth> {
  const database = db();
  const today = todayInTz();
  const windowStart = addDaysToDate(today, -(WATER_WINDOW_DAYS - 1));
  const waterSinceIso = `${addDaysToDate(windowStart, -1)}T00:00:00Z`;

  const [symptomRes, litterRes, waterRes, lookupMap] = await Promise.all([
    database
      .from("symptom_logs")
      .select("*")
      .eq("is_active", true)
      .eq("cat_id", catId)
      .order("noted_at", { ascending: false })
      .limit(200),
    database
      .from("litter_logs")
      .select("*")
      .eq("is_active", true)
      .eq("cat_id", catId)
      .order("observed_at", { ascending: false })
      .limit(200),
    database
      .from("water_logs")
      .select("ml, logged_at")
      .eq("is_active", true)
      .eq("cat_id", catId)
      .gte("logged_at", waterSinceIso),
    getLookupMap(),
  ]);

  const symptoms: CatSymptomRow[] = (
    (symptomRes.data ?? []) as {
      id: UUID;
      noted_at: string;
      symptom_type_id: UUID;
      severity: number | null;
      notes: string | null;
    }[]
  ).map((r) => ({
    id: r.id,
    at: r.noted_at,
    symptom_label: lookupMap.get(r.symptom_type_id)?.label ?? "Symptom",
    severity: r.severity,
    notes: r.notes,
  }));

  const litter: CatLitterRow[] = (
    (litterRes.data ?? []) as {
      id: UUID;
      observed_at: string;
      urine: boolean;
      stool: boolean;
      stool_consistency_id: UUID | null;
      notes: string | null;
    }[]
  ).map((r) => ({
    id: r.id,
    at: r.observed_at,
    urine: r.urine,
    stool: r.stool,
    stool_consistency_label: r.stool_consistency_id
      ? (lookupMap.get(r.stool_consistency_id)?.label ?? null)
      : null,
    notes: r.notes,
  }));

  // Build the 14 day buckets (ascending) then fill.
  const buckets = new Map<string, number>();
  for (let i = 0; i < WATER_WINDOW_DAYS; i++) {
    buckets.set(addDaysToDate(windowStart, i), 0);
  }
  for (const r of (waterRes.data ?? []) as {
    ml: number;
    logged_at: string;
  }[]) {
    const d = dateInTz(r.logged_at);
    if (buckets.has(d)) buckets.set(d, (buckets.get(d) ?? 0) + r.ml);
  }
  const water: WaterDayPoint[] = Array.from(buckets.entries()).map(
    ([date, ml]) => ({ date, ml }),
  );

  return { symptoms, litter, water };
}
