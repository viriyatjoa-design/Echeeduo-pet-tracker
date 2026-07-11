import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { WeightLog, UUID } from "@/lib/types";

/**
 * Weight log reads (SPEC §6.3 / §7). Service-role, server-only.
 * `measured_at` is a 'YYYY-MM-DD' date; we sort by it then by created_at to
 * break same-day ties deterministically (newest first).
 */
const COLS =
  "id, cat_id, weight_grams, bcs, measured_at, notes, created_by, is_active, created_at";

/** All active weight logs for a cat, newest first. */
export const getWeightLogs = cache(
  async (cat_id: UUID): Promise<WeightLog[]> => {
    const { data, error } = await db()
      .from("weight_logs")
      .select(COLS)
      .eq("cat_id", cat_id)
      .eq("is_active", true)
      .order("measured_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as WeightLog[];
  },
);

/** The single most recent active weight log for a cat, or null. */
export const getLatestWeight = cache(
  async (cat_id: UUID): Promise<WeightLog | null> => {
    const { data, error } = await db()
      .from("weight_logs")
      .select(COLS)
      .eq("cat_id", cat_id)
      .eq("is_active", true)
      .order("measured_at", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as WeightLog | null) ?? null;
  },
);

/**
 * Latest active weight per cat, for the dashboard (one query, folded into a
 * Map<catId, WeightLog>). Rows come back newest-first, so the first row seen
 * for each cat wins.
 */
export const getLatestWeightByCat = cache(
  async (): Promise<Map<UUID, WeightLog>> => {
    const { data, error } = await db()
      .from("weight_logs")
      .select(COLS)
      .eq("is_active", true)
      .order("measured_at", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    const map = new Map<UUID, WeightLog>();
    for (const row of (data ?? []) as WeightLog[]) {
      if (!map.has(row.cat_id)) map.set(row.cat_id, row);
    }
    return map;
  },
);
