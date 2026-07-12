"use server";

import { db } from "@/lib/db";
import { getCurrentAppUser } from "@/lib/auth";
import { askAI, parseAIJson, isAIReady, AI_SETUP_MESSAGE } from "@/lib/ai";
import { getWeightLogs } from "@/lib/weight-queries";
import { getCatFeedingHistory } from "@/lib/feeding-queries";
import { getCareEventsByCat, getCareTypeLabels } from "@/lib/care-queries";
import { getCatHealth } from "@/lib/observation-queries";
import { dailyTarget } from "@/lib/kcal";
import { gramsToKg } from "@/lib/weight";
import { todayInTz, APP_TZ } from "@/lib/time";
import type { Cat } from "@/lib/types";

/**
 * Milestone AI (owner-approved; provider Kimi/Moonshot — see CONTEXT.md).
 * All AI work happens server-side; responses are ephemeral (displayed, not
 * stored) so no schema changes are needed.
 */

/** 'YYYY-MM-DD' in the app timezone for a timestamptz ISO string. */
function dayInTz(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

const SYSTEM_PROMPT = `You are the health assistant inside "Purrfect Log", a family cat-care app used by a household in Jakarta (timezone Asia/Jakarta). You receive structured JSON data logged by the family and write clear, useful summaries.

Rules:
- You are NOT a veterinarian. Never diagnose. Frame concerns as "patterns worth mentioning to your vet".
- Be concrete and quantitative: cite the numbers and dates from the data, don't vague-talk.
- If data is sparse (few logs), say so plainly instead of inventing trends.
- Metric units (grams, kg, ml, kcal). Dates as "12 Jul" style.
- Plain text with simple "-" bullets and short section headers. No markdown tables, no bold/italics syntax.
- Keep it tight: everything must earn its line.`;

async function gatherCatData(catId: string) {
  const { data: catRow, error } = await db()
    .from("cats")
    .select("*")
    .eq("id", catId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!catRow) throw new Error("Cat not found.");
  const cat = catRow as Cat;

  const [weights, feeds, care, careLabels, health] = await Promise.all([
    getWeightLogs(catId),
    getCatFeedingHistory(catId, 400),
    getCareEventsByCat(catId),
    getCareTypeLabels(),
    getCatHealth(catId),
  ]);

  const today = todayInTz();

  // Aggregate feeds per Jakarta day for the last 30 days.
  const byDay = new Map<string, { kcal: number; meals: number }>();
  for (const f of feeds) {
    const day = dayInTz(f.fed_at);
    const cur = byDay.get(day) ?? { kcal: 0, meals: 0 };
    cur.kcal += Number(f.kcal);
    cur.meals += 1;
    byDay.set(day, cur);
  }
  const dailyKcal = [...byDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-30)
    .map(([date, v]) => ({ date, kcal: Math.round(v.kcal), meals: v.meals }));

  const latestWeight = weights[0] ?? null;
  const target = dailyTarget(cat, latestWeight?.weight_grams ?? null);

  return {
    today,
    cat: {
      name: cat.name,
      breed: cat.breed,
      sex: cat.sex,
      birth_date: cat.birth_date,
      neutered: cat.neutered,
      weight_target_kg: cat.weight_target_grams
        ? gramsToKg(cat.weight_target_grams)
        : null,
      bcs_target: `${cat.bcs_target_min}-${cat.bcs_target_max}`,
      daily_kcal_target: target,
      notes: cat.notes,
    },
    weights_kg: weights
      .slice(0, 12)
      .map((w) => ({ date: w.measured_at, kg: gramsToKg(w.weight_grams), bcs: w.bcs })),
    daily_kcal_last_30d: dailyKcal,
    water_ml_last_14d: health.water,
    symptoms_recent: health.symptoms.slice(0, 20).map((s) => ({
      date: dayInTz(s.at),
      type: s.symptom_label,
      severity: s.severity,
      notes: s.notes,
    })),
    litter_recent: health.litter.slice(0, 20).map((l) => ({
      date: dayInTz(l.at),
      urine: l.urine,
      stool: l.stool,
      consistency: l.stool_consistency_label,
    })),
    care_events: care.slice(0, 40).map((e) => ({
      type: careLabels.get(e.event_type_id) ?? "Care",
      title: e.title,
      due_date: e.due_date,
      done: e.done_at ? dayInTz(e.done_at) : null,
      vet: e.vet_name,
    })),
  };
}

export async function generateHealthBrief(
  catId: string,
): Promise<{ text: string }> {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");
  if (!isAIReady()) throw new Error(AI_SETUP_MESSAGE);

  const data = await gatherCatData(catId);
  const text = await askAI({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Write a short health brief for ${data.cat.name} for the family. Sections: "How's ${data.cat.name} doing" (2-3 sentences overall read), "Eating" (intake vs the daily kcal target, appetite trend), "Weight", "Watch for" (patterns worth mentioning to the vet, or "nothing concerning" if so), "Coming up" (open care items). Under 250 words total.\n\nDATA:\n${JSON.stringify(data)}`,
      },
    ],
    maxTokens: 1200,
  });
  return { text };
}

export async function generateVetSummary(
  catId: string,
): Promise<{ text: string }> {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");
  if (!isAIReady()) throw new Error(AI_SETUP_MESSAGE);

  const data = await gatherCatData(catId);
  const text = await askAI({
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Write a one-page summary of ${data.cat.name} for a VETERINARIAN visit. Clinical, factual, no speculation. Sections: "Patient" (signalment: breed, sex, neuter status, age if birth date known), "Weight & body condition" (trend with dates), "Diet & intake" (average daily kcal, target, appetite changes), "Elimination & water" (litter observations, water intake), "Recent symptoms" (dated list), "Care history" (vaccinations/treatments with dates — include everything dated), "Owner questions" (2-3 suggested questions based on the data). Under 350 words.\n\nDATA:\n${JSON.stringify(data)}`,
      },
    ],
    maxTokens: 1500,
  });
  return { text };
}

export type ScannedLabel = {
  name: string | null;
  brand: string | null;
  kcal_per_100g: number | null;
  unit_grams: number | null;
  note: string | null;
};

export async function scanFoodLabel(
  formData: FormData,
): Promise<ScannedLabel> {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");
  if (!isAIReady()) throw new Error(AI_SETUP_MESSAGE);

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No photo received — try again.");
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error("Photo too large — try again (it should compress automatically).");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const dataUrl = `data:${file.type || "image/jpeg"};base64,${buf.toString("base64")}`;

  const raw = await askAI({
    json: true,
    maxTokens: 600,
    temperature: 0.1,
    messages: [
      {
        role: "system",
        content:
          'You read cat-food packaging photos and extract catalog data. Reply ONLY with a JSON object: {"name": string|null (product name incl. variant), "brand": string|null, "kcal_per_100g": number|null, "unit_grams": number|null (net weight of ONE can/pouch/sachet if this is a single-serve wet food; null for bags of dry food), "note": string|null (one short caveat, e.g. converted from kcal/kg, or what was unreadable)}. Energy conversions: kcal/kg ÷ 10 = kcal/100g; "ME 3800 kcal/kg" → 380. If a value is not clearly on the label, use null — never guess numbers.',
      },
      {
        role: "user",
        content: [
          { type: "image_url", image_url: { url: dataUrl } },
          {
            type: "text",
            text: "Extract the catalog fields from this cat food label.",
          },
        ],
      },
    ],
  });

  const parsed = parseAIJson<ScannedLabel>(raw);
  const num = (v: unknown) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return {
    name: typeof parsed.name === "string" ? parsed.name : null,
    brand: typeof parsed.brand === "string" ? parsed.brand : null,
    kcal_per_100g: num(parsed.kcal_per_100g),
    unit_grams: num(parsed.unit_grams),
    note: typeof parsed.note === "string" ? parsed.note : null,
  };
}
