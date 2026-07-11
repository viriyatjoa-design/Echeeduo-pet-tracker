"use server";

import { db } from "@/lib/db";
import { getCurrentAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { UUID } from "@/lib/types";

/**
 * Observation-layer mutations (SPEC §6.5): water intake, litter/output, and
 * symptom logs. Each returns the new row id so a form can attach a photo to it
 * (photo-then-id ordering). Every write sets `created_by` and revalidates the
 * whole app tree (dashboard, /journal, and any /cats/[id] health tab).
 */

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
}): Promise<UUID> {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  if (!input.cat_id) throw new Error("Please pick a cat.");
  const ml = Math.round(Number(input.ml));
  if (!Number.isFinite(ml) || ml <= 0) {
    throw new Error("Amount must be greater than 0.");
  }

  const { data, error } = await db()
    .from("water_logs")
    .insert({ cat_id: input.cat_id, ml, created_by: me.id })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  revalidateApp();
  return data.id as UUID;
}

export async function logLitter(input: {
  cat_id?: string | null;
  urine: boolean;
  stool: boolean;
  stool_consistency_id?: string | null;
  notes?: string | null;
}): Promise<UUID> {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  const urine = !!input.urine;
  const stool = !!input.stool;
  if (!urine && !stool) {
    throw new Error("Mark urine, stool, or both.");
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
  if (error) throw new Error(error.message);

  revalidateApp();
  return data.id as UUID;
}

export async function logSymptom(input: {
  cat_id: string;
  symptom_type_id: string;
  severity?: number | null;
  notes?: string | null;
}): Promise<UUID> {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  if (!input.cat_id) throw new Error("Please pick a cat.");
  if (!input.symptom_type_id) throw new Error("Please pick a symptom.");

  let severity: number | null = null;
  if (input.severity != null && String(input.severity).trim() !== "") {
    const n = Math.round(Number(input.severity));
    if (!Number.isFinite(n) || n < 1 || n > 3) {
      throw new Error("Severity must be 1–3.");
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
  if (error) throw new Error(error.message);

  revalidateApp();
  return data.id as UUID;
}
