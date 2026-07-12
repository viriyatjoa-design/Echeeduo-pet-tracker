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

export type LogWeightResult = { ok: true } | { ok: false; error: string };

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

export async function logWeight(input: LogWeightInput): Promise<LogWeightResult> {
  try {
    const me = await getCurrentAppUser();
    if (!me) return { ok: false, error: "Unauthorized" };

    if (!input.cat_id) return { ok: false, error: "Missing cat." };

    const grams = Math.round(Number(input.weight_grams));
    if (!Number.isFinite(grams) || grams <= 0) {
      return { ok: false, error: "Weight must be greater than 0." };
    }

    let bcs: number | null = null;
    if (input.bcs !== null && input.bcs !== undefined && String(input.bcs).trim() !== "") {
      const b = Math.round(Number(input.bcs));
      if (!Number.isFinite(b) || b < 1 || b > 9) {
        return { ok: false, error: "Body condition score must be between 1 and 9." };
      }
      bcs = b;
    }

    const measured_at = clean(input.measured_at);
    if (!measured_at) return { ok: false, error: "Measurement date is required." };

    const { error } = await db().from("weight_logs").insert({
      cat_id: input.cat_id,
      weight_grams: grams,
      bcs,
      measured_at,
      notes: clean(input.notes),
      created_by: me.id,
    });
    if (error) return { ok: false, error: error.message };

    // Revalidate the dashboard and every /cats/[id] profile in one shot.
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}
