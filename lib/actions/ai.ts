"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentAppUser } from "@/lib/auth";
import {
  askAI,
  parseAIJson,
  isAIReady,
  AI_SETUP_MESSAGE,
  VISION_MODEL,
} from "@/lib/ai";
import { listAttachments } from "@/lib/storage";
import { generateMorningReport, saveBrief } from "@/lib/briefs";
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

/**
 * Family-facing analysis: soft reads + practical suggestions are allowed
 * (owner-requested), definitive diagnoses are not, and red flags always
 * escalate to "see your vet" instead of home tips.
 */
const FAMILY_SYSTEM_PROMPT = `You are the health assistant inside "Purrfect Log", a family cat-care app used by a household in Jakarta (timezone Asia/Jakarta). You receive structured JSON data logged by the family and write clear summaries they can act on.

Rules:
- You are not a veterinarian and never give a definitive diagnosis. You MAY give a soft read and 1-3 practical, low-risk suggestions a cat owner can try at home, tied to the data (e.g. "intake is ~20% under target — try adding a small wet-food meal", "stool has been hard twice this week — consider more water or wet food, a little extra fiber").
- Red flags override home tips: visible blood, repeated vomiting, nothing eaten for 24h+, severity-3 symptoms, or a sudden weight change — then the advice is plainly "see your vet soon", nothing softer.
- Logs can be incomplete — the family sometimes forgets to log. Phrase low counts as "only X logged", never as fact that the cat wasn't fed or didn't go.
- Be concrete and quantitative: cite the numbers and dates from the data, don't vague-talk.
- If data is sparse, say so plainly instead of inventing trends.
- Metric units (grams, kg, ml, kcal). Dates as "12 Jul" style.
- Plain text with simple "-" bullets and short section headers. No markdown tables, no bold/italics syntax.
- Keep it tight: everything must earn its line.`;

/** Vet-facing summary: strictly factual — the vet does the interpreting. */
const VET_SYSTEM_PROMPT = `You prepare clinical visit summaries inside "Purrfect Log", a family cat-care app used by a household in Jakarta (timezone Asia/Jakarta). Your reader is the VETERINARIAN.

Rules:
- Strictly factual: report only what was logged, with dates and numbers. No interpretation, no diagnosis, no care suggestions — the vet does that.
- Note data gaps explicitly (e.g. "no weight logged since 2 Jul") — an incomplete log is information.
- Metric units (grams, kg, ml, kcal). Dates as "12 Jul" style.
- Plain text with simple "-" bullets and short section headers. No markdown tables, no bold/italics syntax.`;

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
      // Stored photo observation, truncated to keep the prompt lean.
      photo_ai: l.ai_analysis ? l.ai_analysis.slice(0, 300) : undefined,
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

export type AIResult =
  | { ok: true; text: string }
  | { ok: false; error: string };

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : "Something went wrong.";
}

/**
 * Persist a per-cat analysis/summary so the next visit reads it instantly.
 * Best-effort: pre-migration-005 the text is still returned (just ephemeral).
 */
async function saveBriefQuietly(kind: string, catId: string, text: string, by: string) {
  try {
    await saveBrief({ kind, catId, content: text, model: null, createdBy: by });
  } catch {
    // Table missing (migration 005 not run) — the feature degrades to ephemeral.
  }
}

/** Manual "generate/refresh now" for the household morning report. */
export async function refreshMorningReport(): Promise<AIResult> {
  try {
    const me = await getCurrentAppUser();
    if (!me) throw new Error("Unauthorized");
    if (!isAIReady()) throw new Error(AI_SETUP_MESSAGE);

    const res = await generateMorningReport(me.id);
    if (!res.ok) return res;
    revalidatePath("/", "layout");
    return { ok: true, text: res.text };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

export async function generateHealthBrief(catId: string): Promise<AIResult> {
  try {
    const me = await getCurrentAppUser();
    if (!me) throw new Error("Unauthorized");
    if (!isAIReady()) throw new Error(AI_SETUP_MESSAGE);

    const data = await gatherCatData(catId);
    const text = await askAI({
    messages: [
      { role: "system", content: FAMILY_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Write a health analysis of ${data.cat.name} for the family. Sections: "How's ${data.cat.name} doing" (2-3 sentences overall read), "Eating" (logged intake vs the daily kcal target, appetite trend), "Weight", "Watch for" (patterns to keep an eye on or mention to the vet, or "nothing concerning" if so), "What you can try" (1-3 practical suggestions tied to the data — hydration, wet-food share, fiber, portion pacing; skip this section entirely if everything looks normal), "Coming up" (open care items). Under 280 words total.\n\nDATA:\n${JSON.stringify(data)}`,
      },
    ],
      maxTokens: 6000,
    });
    await saveBriefQuietly("health_analysis", catId, text, me.id);
    revalidatePath(`/cats/${catId}`);
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

export async function generateVetSummary(catId: string): Promise<AIResult> {
  try {
    const me = await getCurrentAppUser();
    if (!me) throw new Error("Unauthorized");
    if (!isAIReady()) throw new Error(AI_SETUP_MESSAGE);

    const data = await gatherCatData(catId);
    const text = await askAI({
    messages: [
      { role: "system", content: VET_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Write a one-page summary of ${data.cat.name} for a VETERINARIAN visit. Sections: "Patient" (signalment: breed, sex, neuter status, age if birth date known), "Weight & body condition" (trend with dates), "Diet & intake" (average daily logged kcal, target, appetite changes), "Elimination & water" (litter observations, water intake), "Recent symptoms" (dated list), "Care history" (vaccinations/treatments with dates — include everything dated), "Owner questions" (2-3 suggested questions based on the data). Under 350 words.\n\nDATA:\n${JSON.stringify(data)}`,
      },
    ],
      maxTokens: 6000,
    });
    await saveBriefQuietly("vet_summary", catId, text, me.id);
    revalidatePath(`/cats/${catId}`);
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

export type ScannedLabel = {
  name: string | null;
  brand: string | null;
  kcal_per_100g: number | null;
  unit_grams: number | null;
  note: string | null;
};

export type ScanResult =
  | { ok: true; data: ScannedLabel }
  | { ok: false; error: string };

export async function scanFoodLabel(formData: FormData): Promise<ScanResult> {
  try {
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
    maxTokens: 3000,
    model: VISION_MODEL,
    messages: [
      {
        role: "system",
        content:
          'You read cat-food packaging photos and extract catalog data. Labels may be in Indonesian, English, or any language — extract regardless and keep the product name as printed. Reply ONLY with a JSON object: {"name": string|null (product name incl. variant), "brand": string|null, "kcal_per_100g": number|null, "unit_grams": number|null (the PRINTED NET WEIGHT of ONE can/pouch/sachet, e.g. "Net weight 85 g" / "Berat bersih 85 g", if this is a single-serve wet food; NEVER a feeding-guide amount; null for bags of dry food), "note": string|null (one short caveat, e.g. converted from kcal/kg or kcal/can, or what was unreadable)}. Energy conversions: kcal/kg ÷ 10 = kcal/100g ("ME 3800 kcal/kg" → 380); if energy is only given per can/pouch AND the net weight is printed, compute kcal/100g from those and say so in note. If a value is not clearly on the label, use null — never guess numbers.',
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
    ok: true,
    data: {
      name: typeof parsed.name === "string" ? parsed.name : null,
      brand: typeof parsed.brand === "string" ? parsed.brand : null,
      kcal_per_100g: num(parsed.kcal_per_100g),
      unit_grams: num(parsed.unit_grams),
      note: typeof parsed.note === "string" ? parsed.note : null,
    },
  };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

const LITTER_SYSTEM_PROMPT = `You look at litter-box photos inside "Purrfect Log", a family cat-care app. You describe what is VISIBLE — stool and/or urine clumps — and give the family a practical read, so they have a consistent record and know what to do next.

Rules:
- Never a definitive diagnosis or a disease name as a conclusion. You MAY give a soft read plus low-risk care suggestions tied to what you see (e.g. firm/dry stool → more water or wet food, a little extra fiber; soft stool → note any recent food change, watch the next few boxes; lots of small urine clumps → keep an eye on water intake).
- Red flags override suggestions: visible blood, black/tarry stool, worms, or watery diarrhea → say plainly that a vet visit soon is the right move, and skip home tips.
- Describe only what you can actually see. Clumping litter coats everything: judge urine clumps by size and shape, not surface color, and say when litter coating limits what you can tell.
- If the photo is too unclear or doesn't show stool/urine, say exactly that in one line and stop.
- Plain text, short "-" bullets under tiny headers. No markdown syntax. Under 140 words.`;

/**
 * Read the newest photo on a litter log and store a general stool/urine
 * observation on the row (litter_logs.ai_analysis — migration 004). Called
 * automatically after a photo upload and manually via the Refresh button, so
 * it always re-reads the CURRENT newest photo.
 */
export async function analyzeLitterPhoto(litterLogId: string): Promise<AIResult> {
  try {
    const me = await getCurrentAppUser();
    if (!me) throw new Error("Unauthorized");
    if (!isAIReady()) throw new Error(AI_SETUP_MESSAGE);

    const { data: log, error } = await db()
      .from("litter_logs")
      .select("id, cat_id, urine, stool, stool_consistency_id, notes")
      .eq("id", litterLogId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!log) throw new Error("Litter entry not found.");

    const photos = await listAttachments("litter_log", litterLogId);
    const photo = photos.find((p) => p.url);
    if (!photo?.url) {
      throw new Error("No photo on this entry — add one first.");
    }

    // Storage is private: fetch via the signed URL server-side and inline the
    // image as a data URL (same pattern as the label scanner).
    const imgRes = await fetch(photo.url, {
      signal: AbortSignal.timeout(30_000),
    });
    if (!imgRes.ok) throw new Error("Couldn't load the photo — try again.");
    const buf = Buffer.from(await imgRes.arrayBuffer());
    if (buf.byteLength > 8 * 1024 * 1024) {
      throw new Error("Photo too large to analyze.");
    }
    const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
    const dataUrl = `data:${contentType};base64,${buf.toString("base64")}`;

    // What the family already logged, so the AI can confirm or gently disagree.
    const logged: string[] = [];
    if (log.urine) logged.push("urine");
    if (log.stool) logged.push("stool");
    if (log.notes) logged.push(`notes: "${log.notes}"`);

    const text = await askAI({
      model: VISION_MODEL,
      maxTokens: 4000,
      messages: [
        { role: "system", content: LITTER_SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl } },
            {
              type: "text",
              text: `The family logged this entry as: ${logged.join(", ") || "(nothing marked)"}. Analyze the photo. Format:\n\nWhat I see\n- color, consistency/texture, approximate size and amount, shape\n- anything notable: blood, mucus, unusually dark/pale color, visible parasites, very large or very small clumps\n\nReading\n- 1-2 bullets: your soft read of what this generally suggests for a cat (e.g. "looks firm and dry — often a hydration or fiber thing"), hedged, no disease-name conclusions\n\nWhat you can try\n- 1-2 practical, low-risk suggestions tied to what you see (water intake, wet-food share, a little fiber, slower food transitions), or the single line "Nothing needed — this looks normal."\n- if you saw any red flag above, make this section exactly one line: see your vet soon and bring this photo.`,
            },
          ],
        },
      ],
    });

    const { error: updateError } = await db()
      .from("litter_logs")
      .update({
        ai_analysis: text,
        ai_analyzed_at: new Date().toISOString(),
      })
      .eq("id", litterLogId);
    if (updateError) {
      // Most likely: migration 004 not run yet, so the columns don't exist.
      throw new Error(
        /ai_analysis|ai_analyzed_at|column/i.test(updateError.message)
          ? "Analysis ran, but saving needs migration 004_litter_ai.sql — run it in the Supabase SQL Editor (see SETUP.md)."
          : updateError.message,
      );
    }

    revalidatePath("/", "layout");
    return { ok: true, text };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}
