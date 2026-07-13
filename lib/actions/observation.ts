"use server";

import { db } from "@/lib/db";
import { getCurrentAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { todayInTz, addDaysToDate, APP_TZ } from "@/lib/time";
import type { UUID } from "@/lib/types";

/**
 * Observation-layer mutations (SPEC §6.5): water intake, litter/output, and
 * symptom logs. Each returns the new row id so a form can attach a photo to it
 * (photo-then-id ordering). Every write sets `created_by` and revalidates the
 * whole app tree (dashboard, /journal, and any /cats/[id] health tab).
 *
 * Actions return a result object rather than throwing: a thrown Error loses its
 * message in a Next.js production build, so failures come back as
 * `{ ok: false, error }` and the success payload keeps the new row id.
 */

/** New-row result: preserves the created id on success (mirrors ai.ts). */
export type ObservationResult =
  | { ok: true; id: UUID }
  | { ok: false; error: string };

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

function clean(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s.length ? s : null;
}

/** Revalidate every page under the root layout (SPEC: dashboard, journal, cat). */
function revalidateApp() {
  revalidatePath("/", "layout");
}

export async function logWater(input: {
  cat_id: string;
  ml: number;
}): Promise<ObservationResult> {
  try {
    const me = await getCurrentAppUser();
    if (!me) return { ok: false, error: "Unauthorized" };

    if (!input.cat_id) return { ok: false, error: "Please pick a cat." };
    const ml = Math.round(Number(input.ml));
    if (!Number.isFinite(ml) || ml <= 0) {
      return { ok: false, error: "Amount must be greater than 0." };
    }

    const { data, error } = await db()
      .from("water_logs")
      .insert({ cat_id: input.cat_id, ml, created_by: me.id })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };

    revalidateApp();
    return { ok: true, id: data.id as UUID };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

/** 'YYYY-MM-DD' Jakarta day for a timestamptz ISO string. */
function dayInTz(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

export type TodayWaterEntry = { id: UUID; ml: number; at: string };

/** Today's (Jakarta) water logs for one cat, newest first — for the quick-log
 * dialog's "undo a mis-log" list. Read action so the dialog fetches on open. */
export async function getTodayWater(catId: string): Promise<TodayWaterEntry[]> {
  const me = await getCurrentAppUser();
  if (!me || !catId) return [];
  const today = todayInTz();
  const sinceIso = `${addDaysToDate(today, -1)}T00:00:00Z`;
  const { data, error } = await db()
    .from("water_logs")
    .select("id, ml, logged_at")
    .eq("cat_id", catId)
    .eq("is_active", true)
    .gte("logged_at", sinceIso)
    .order("logged_at", { ascending: false });
  if (error) return [];
  return ((data ?? []) as { id: string; ml: number; logged_at: string }[])
    .filter((r) => dayInTz(r.logged_at) === today)
    .map((r) => ({ id: r.id as UUID, ml: r.ml, at: r.logged_at }));
}

/** Soft-delete a logged observation (SPEC §2.6: never hard-delete). Used to
 * undo a wrong water/litter/symptom entry from the dashboard or journal. */
export async function removeObservation(
  kind: "water" | "litter" | "symptom",
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const me = await getCurrentAppUser();
    if (!me) return { ok: false, error: "Unauthorized" };
    if (!id) return { ok: false, error: "Missing id." };
    const table =
      kind === "water"
        ? "water_logs"
        : kind === "litter"
          ? "litter_logs"
          : "symptom_logs";
    const { error } = await db()
      .from(table)
      .update({ is_active: false })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    revalidateApp();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

export async function logLitter(input: {
  cat_id?: string | null;
  urine: boolean;
  stool: boolean;
  stool_consistency_id?: string | null;
  notes?: string | null;
}): Promise<ObservationResult> {
  try {
    const me = await getCurrentAppUser();
    if (!me) return { ok: false, error: "Unauthorized" };

    const urine = !!input.urine;
    const stool = !!input.stool;
    if (!urine && !stool) {
      return { ok: false, error: "Mark urine, stool, or both." };
    }

    const row = {
      cat_id: clean(input.cat_id), // null = unattributed household observation
      urine,
      stool,
      // Consistency only makes sense with stool.
      stool_consistency_id: stool ? clean(input.stool_consistency_id) : null,
      notes: clean(input.notes),
      created_by: me.id,
    };

    const { data, error } = await db()
      .from("litter_logs")
      .insert(row)
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };

    revalidateApp();
    return { ok: true, id: data.id as UUID };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

export async function logSymptom(input: {
  cat_id: string;
  symptom_type_id: string;
  severity?: number | null;
  notes?: string | null;
}): Promise<ObservationResult> {
  try {
    const me = await getCurrentAppUser();
    if (!me) return { ok: false, error: "Unauthorized" };

    if (!input.cat_id) return { ok: false, error: "Please pick a cat." };
    if (!input.symptom_type_id) {
      return { ok: false, error: "Please pick a symptom." };
    }

    let severity: number | null = null;
    if (input.severity != null && String(input.severity).trim() !== "") {
      const n = Math.round(Number(input.severity));
      if (!Number.isFinite(n) || n < 1 || n > 3) {
        return { ok: false, error: "Severity must be 1–3." };
      }
      severity = n;
    }

    const { data, error } = await db()
      .from("symptom_logs")
      .insert({
        cat_id: input.cat_id,
        symptom_type_id: input.symptom_type_id,
        severity,
        notes: clean(input.notes),
        created_by: me.id,
      })
      .select("id")
      .single();
    if (error) return { ok: false, error: error.message };

    revalidateApp();
    return { ok: true, id: data.id as UUID };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}
