"use server";

import { db } from "@/lib/db";
import { getCurrentAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

/**
 * Weight + BCS logging (SPEC §6.3, §7). Weight is stored as an integer number
 * of grams (§2.9: 4550 = 4.55 kg — the client rounds kg*1000). BCS is an
 * optional 1–9 score. `measured_at` is a 'YYYY-MM-DD' date.
 */
export type LogWeightInput = {
  cat_id: string;
  weight_grams: number;
  bcs?: number | null;
  measured_at: string;
  notes?: string | null;
};

function clean(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s.length ? s : null;
}

export async function logWeight(input: LogWeightInput) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  if (!input.cat_id) throw new Error("Missing cat.");

  const grams = Math.round(Number(input.weight_grams));
  if (!Number.isFinite(grams) || grams <= 0) {
    throw new Error("Weight must be greater than 0.");
  }

  let bcs: number | null = null;
  if (input.bcs !== null && input.bcs !== undefined && String(input.bcs).trim() !== "") {
    const b = Math.round(Number(input.bcs));
    if (!Number.isFinite(b) || b < 1 || b > 9) {
      throw new Error("Body condition score must be between 1 and 9.");
    }
    bcs = b;
  }

  const measured_at = clean(input.measured_at);
  if (!measured_at) throw new Error("Measurement date is required.");

  const { error } = await db().from("weight_logs").insert({
    cat_id: input.cat_id,
    weight_grams: grams,
    bcs,
    measured_at,
    notes: clean(input.notes),
    created_by: me.id,
  });
  if (error) throw new Error(error.message);

  // Revalidate the dashboard and every /cats/[id] profile in one shot.
  revalidatePath("/", "layout");
}
