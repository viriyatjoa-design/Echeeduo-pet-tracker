import "server-only";
import { db } from "@/lib/db";
import { askAI, VISION_MODEL } from "@/lib/ai";
import { getLookupMap } from "@/lib/lookups";
import { getCareTypeLabels } from "@/lib/care-queries";
import { dailyTarget } from "@/lib/kcal";
import { gramsToKg } from "@/lib/weight";
import { todayInTz, addDaysToDate, APP_TZ } from "@/lib/time";
import type { AIBrief, Cat, UUID, WeightLog } from "@/lib/types";

/**
 * Stored AI briefs (migration 005): the nightly household morning report plus
 * per-cat health analysis / vet summary. Generation is slow (AI); reads are
 * instant because everything lands in `ai_briefs`. SERVER ONLY.
 */

export const MIGRATION_005_HINT =
  "Saving needs migration 005_ai_briefs.sql — run it in the Supabase SQL Editor (see SETUP.md).";

export const QUIET_DAY_TEXT =
  "Quiet day — nothing was logged in the last 24 hours.";

/** Newest active brief of a kind (cat_id null = household). Null pre-migration. */
export async function getLatestBrief(
  kind: string,
  catId: UUID | null,
): Promise<AIBrief | null> {
  let q = db()
    .from("ai_briefs")
    .select("*")
    .eq("kind", kind)
    .eq("is_active", true)
    .order("created_at", { ascending: false })
    .limit(1);
  q = catId ? q.eq("cat_id", catId) : q.is("cat_id", null);
  const { data, error } = await q.maybeSingle();
  // Graceful pre-migration read: a missing table just means "no brief yet".
  if (error) return null;
  return (data as AIBrief | null) ?? null;
}

/** Insert a brief row. Throws with a run-the-migration hint if 005 isn't in. */
export async function saveBrief(input: {
  kind: string;
  catId: UUID | null;
  content: string;
  model: string | null;
  createdBy: UUID | null;
}): Promise<void> {
  const { error } = await db().from("ai_briefs").insert({
    kind: input.kind,
    cat_id: input.catId,
    brief_date: todayInTz(),
    content: input.content,
    model: input.model,
    created_by: input.createdBy,
  });
  if (error) {
    throw new Error(
      /ai_briefs|relation|does not exist/i.test(error.message)
        ? MIGRATION_005_HINT
        : error.message,
    );
  }
}

/** 'YYYY-MM-DD' in the app timezone for a timestamptz ISO string. */
function dayInTz(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

const MORNING_SYSTEM_PROMPT = `You write the daily "Morning report" inside "Purrfect Log", a family cat-care app used by a household in Jakarta. You receive the last 24 hours of logs for all cats, plus context (kcal targets, 7-day intake, upcoming care). The family reads this over breakfast.

Rules:
- You are NOT a veterinarian. Never diagnose. Concerns are "worth mentioning to your vet".
- Be concrete: cite the actual numbers. If a cat has no logs, say so in one bullet — don't invent.
- One tiny section per cat (the cat's name as the header line), 1-3 "-" bullets each: eating vs target, litter/symptoms if any, weight if logged. Then, only if needed, a final "Heads up" section: care due soon, overdue items, or a pattern across cats.
- Plain text, no markdown syntax. Metric units. Under 160 words total — it's a glance, not an essay.`;

export type MorningReportResult =
  | { ok: true; text: string; quiet: boolean }
  | { ok: false; error: string };

/**
 * Gather the last 24h of household logs, write the morning report (fast
 * model), and store it. When nothing was logged, stores a fixed quiet-day
 * line without calling the AI at all. `createdBy` null = the nightly cron.
 */
export async function generateMorningReport(
  createdBy: UUID | null,
): Promise<MorningReportResult> {
  try {
    const database = db();
    const sinceIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const today = todayInTz();

    const [
      catsRes,
      feedsRes,
      waterRes,
      litterRes,
      symptomRes,
      weightRes,
      careDoneRes,
      careDueRes,
      lookupMap,
      careLabels,
    ] = await Promise.all([
      database.from("cats").select("*").eq("is_active", true).order("name"),
      database
        .from("feeding_logs")
        .select("cat_id, kcal, fed_at")
        .eq("is_active", true)
        .gte("fed_at", sinceIso),
      database
        .from("water_logs")
        .select("cat_id, ml, logged_at")
        .eq("is_active", true)
        .gte("logged_at", sinceIso),
      database
        .from("litter_logs")
        .select("cat_id, urine, stool, stool_consistency_id, notes, ai_analysis, observed_at")
        .eq("is_active", true)
        .gte("observed_at", sinceIso),
      database
        .from("symptom_logs")
        .select("cat_id, symptom_type_id, severity, notes, noted_at")
        .eq("is_active", true)
        .gte("noted_at", sinceIso),
      database
        .from("weight_logs")
        .select("cat_id, weight_grams, bcs, measured_at, created_at")
        .eq("is_active", true)
        .order("measured_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(60),
      database
        .from("care_events")
        .select("cat_id, title, event_type_id, done_at")
        .eq("is_active", true)
        .gte("done_at", sinceIso),
      database
        .from("care_events")
        .select("cat_id, title, event_type_id, due_date")
        .eq("is_active", true)
        .is("done_at", null)
        .not("due_date", "is", null)
        .lte("due_date", addDaysToDate(today, 7)),
      getLookupMap(),
      getCareTypeLabels(),
    ]);

    const cats = (catsRes.data ?? []) as Cat[];
    if (cats.length === 0) return { ok: false, error: "No cats yet." };

    const feeds = feedsRes.data ?? [];
    const water = waterRes.data ?? [];
    const litter = litterRes.data ?? [];
    const symptoms = symptomRes.data ?? [];
    const weights = (weightRes.data ?? []) as WeightLog[];
    const careDone = careDoneRes.data ?? [];
    const careDue = careDueRes.data ?? [];

    const weightsInWindow = weights.filter(
      // measured_at is a 'YYYY-MM-DD' date: "in the window" = dated today or
      // yesterday (the 24h window always spans those two Jakarta days).
      (w) => w.measured_at >= addDaysToDate(today, -1),
    );

    const quiet =
      feeds.length === 0 &&
      water.length === 0 &&
      litter.length === 0 &&
      symptoms.length === 0 &&
      weightsInWindow.length === 0 &&
      careDone.length === 0;

    if (quiet) {
      await saveBrief({
        kind: "morning_report",
        catId: null,
        content: QUIET_DAY_TEXT,
        model: null,
        createdBy,
      });
      return { ok: true, text: QUIET_DAY_TEXT, quiet: true };
    }

    // Latest weight per cat (any age) for kcal targets.
    const latestWeightByCat = new Map<string, WeightLog>();
    for (const w of weights) {
      if (!latestWeightByCat.has(w.cat_id)) latestWeightByCat.set(w.cat_id, w);
    }

    const label = (id: string | null) =>
      id ? (lookupMap.get(id)?.label ?? null) : null;

    const perCat = cats.map((cat) => {
      const catFeeds = feeds.filter((f) => f.cat_id === cat.id);
      const kcal = Math.round(
        catFeeds.reduce((sum, f) => sum + Number(f.kcal), 0),
      );
      const latest = latestWeightByCat.get(cat.id) ?? null;
      return {
        name: cat.name,
        kcal_last_24h: kcal,
        meals: catFeeds.length,
        daily_kcal_target: dailyTarget(cat, latest?.weight_grams ?? null),
        water_ml: water
          .filter((w) => w.cat_id === cat.id)
          .reduce((sum, w) => sum + w.ml, 0),
        litter: litter
          .filter((l) => l.cat_id === cat.id)
          .map((l) => ({
            urine: l.urine,
            stool: l.stool,
            consistency: label(l.stool_consistency_id),
            notes: l.notes,
            photo_ai: l.ai_analysis ? l.ai_analysis.slice(0, 200) : undefined,
          })),
        symptoms: symptoms
          .filter((s) => s.cat_id === cat.id)
          .map((s) => ({
            type: label(s.symptom_type_id) ?? "Symptom",
            severity: s.severity,
            notes: s.notes,
          })),
        weight_logged: weightsInWindow
          .filter((w) => w.cat_id === cat.id)
          .map((w) => ({ kg: gramsToKg(w.weight_grams), bcs: w.bcs })),
        care_done: careDone
          .filter((c) => c.cat_id === cat.id)
          .map((c) => c.title || careLabels.get(c.event_type_id) || "Care"),
        care_coming_up: careDue
          .filter((c) => c.cat_id === cat.id)
          .map((c) => ({
            what: c.title || careLabels.get(c.event_type_id) || "Care",
            due: c.due_date,
          })),
      };
    });

    const data = {
      date: today,
      cats: perCat,
      household_litter_unattributed: litter
        .filter((l) => !l.cat_id)
        .map((l) => ({
          urine: l.urine,
          stool: l.stool,
          consistency: label(l.stool_consistency_id),
          photo_ai: l.ai_analysis ? l.ai_analysis.slice(0, 200) : undefined,
        })),
    };

    // Fast model: this is a small daily window — thinking-grade reasoning is
    // wasted on it and would risk the cron window.
    const text = await askAI({
      model: VISION_MODEL,
      maxTokens: 4000,
      messages: [
        { role: "system", content: MORNING_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Write this morning's report (${today}).\n\nDATA:\n${JSON.stringify(data)}`,
        },
      ],
    });

    await saveBrief({
      kind: "morning_report",
      catId: null,
      content: text,
      model: VISION_MODEL,
      createdBy,
    });
    return { ok: true, text, quiet: false };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Something went wrong.",
    };
  }
}
