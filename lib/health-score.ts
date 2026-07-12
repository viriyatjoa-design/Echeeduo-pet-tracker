// Health Scorecard scoring — pure functions (no DB/server), so the whole
// grading policy is unit-testable and auditable in one place. Grades a cat's
// real logged data against the British Shorthair references in cat-care-facts.
// Directional only — "attention" means "worth a look / mention to your vet",
// never a diagnosis.

import { BREED_REF } from "@/lib/cat-care-facts";
import { gramsToKg } from "@/lib/weight";

/** good = on track · watch = drifting · attention = worth acting on · info =
 * neutral fact (hydration) · unknown = not enough data logged yet. */
export type ScoreStatus =
  | "good"
  | "watch"
  | "attention"
  | "info"
  | "unknown";

export type ScoreDimension = {
  key: "weight" | "bcs" | "eating" | "hydration" | "care";
  title: string;
  status: ScoreStatus;
  /** The cat's actual value, short (e.g. "4.8 kg"). Empty when unknown. */
  value: string;
  /** The reference/target (e.g. "ideal 3.5–5.5 kg"). */
  detail: string;
  /** Optional one-line nudge shown under a non-good status. */
  note?: string;
};

export type Scorecard = {
  overall: ScoreStatus;
  headline: string;
  dimensions: ScoreDimension[];
};

export type ScoreInput = {
  sex: "male" | "female" | null;
  latestWeightGrams: number | null;
  latestBcs: number | null;
  bcsTargetMin: number;
  bcsTargetMax: number;
  dailyKcalTarget: number | null;
  /** Average kcal/day over days that had ≥1 feed, and how many such days. */
  avgKcal: number | null;
  kcalDays: number;
  /** Average ml/day of LOGGED water over the window (food moisture excluded). */
  avgWaterMl: number | null;
  /** Open events already past due, soonest-overdue first. */
  overdueCare: { title: string; daysOverdue: number }[];
};

function kg(grams: number): string {
  return `${gramsToKg(grams)} kg`;
}

function scoreWeight(input: ScoreInput): ScoreDimension {
  const band =
    BREED_REF.idealWeightGrams[input.sex ?? "unknown"] ??
    BREED_REF.idealWeightGrams.unknown;
  const detail = `ideal ${gramsToKg(band.min)}–${gramsToKg(band.max)} kg`;
  const w = input.latestWeightGrams;
  if (w == null || w <= 0) {
    return {
      key: "weight",
      title: "Weight",
      status: "unknown",
      value: "",
      detail,
      note: "Log a weight to unlock this.",
    };
  }
  const value = kg(w);
  if (w >= band.min && w <= band.max) {
    return { key: "weight", title: "Weight", status: "good", value, detail };
  }
  if (w > band.max) {
    // >10% over the top of the band → attention (obesity-prone breed).
    const over = (w - band.max) / band.max;
    return {
      key: "weight",
      title: "Weight",
      status: over > 0.1 ? "attention" : "watch",
      value,
      detail,
      note: `About ${gramsToKg(w - band.max)} kg over the healthy range — worth watching portions.`,
    };
  }
  // Below the band.
  return {
    key: "weight",
    title: "Weight",
    status: "watch",
    value,
    detail,
    note: "Under the typical range — fine if lean, worth a look if dropping.",
  };
}

function scoreBcs(input: ScoreInput): ScoreDimension {
  const min = input.bcsTargetMin || BREED_REF.bcsTarget.min;
  const max = input.bcsTargetMax || BREED_REF.bcsTarget.max;
  const detail = `target ${min}–${max} of 9`;
  const b = input.latestBcs;
  if (b == null) {
    return {
      key: "bcs",
      title: "Body condition",
      status: "unknown",
      value: "",
      detail,
      note: "Add a body-condition score with a weight.",
    };
  }
  const value = `BCS ${b}/9`;
  if (b >= min && b <= max) {
    return { key: "bcs", title: "Body condition", status: "good", value, detail };
  }
  if (b > max) {
    return {
      key: "bcs",
      title: "Body condition",
      status: "attention",
      value,
      detail,
      note: "Above target — score by feel: ribs should be easy to find.",
    };
  }
  return {
    key: "bcs",
    title: "Body condition",
    status: "watch",
    value,
    detail,
    note: "Below target — a little light.",
  };
}

function scoreEating(input: ScoreInput): ScoreDimension {
  const target = input.dailyKcalTarget;
  if (target == null || target <= 0) {
    return {
      key: "eating",
      title: "Eating",
      status: "unknown",
      value: "",
      detail: "needs a weight for the target",
      note: "Log a weight so we can set a calorie target.",
    };
  }
  const detail = `target ${Math.round(target)} kcal/day`;
  if (input.avgKcal == null || input.kcalDays === 0) {
    return {
      key: "eating",
      title: "Eating",
      status: "unknown",
      value: "",
      detail,
      note: "No feeds logged in this window.",
    };
  }
  const avg = Math.round(input.avgKcal);
  const value = `${avg} kcal/day avg`;
  const ratio = input.avgKcal / target;
  if (ratio >= BREED_REF.kcalOnTrack.min && ratio <= BREED_REF.kcalOnTrack.max) {
    return { key: "eating", title: "Eating", status: "good", value, detail };
  }
  if (ratio > BREED_REF.kcalOnTrack.max) {
    return {
      key: "eating",
      title: "Eating",
      status: "watch",
      value,
      detail,
      note: `About ${Math.round((ratio - 1) * 100)}% over target — the breed gains weight easily.`,
    };
  }
  return {
    key: "eating",
    title: "Eating",
    status: "watch",
    value,
    detail,
    note: `About ${Math.round((1 - ratio) * 100)}% under target — fine short-term, worth watching if appetite is down.`,
  };
}

function scoreHydration(input: ScoreInput): ScoreDimension {
  // Water is deliberately INFORMATIONAL — wet-fed cats drink little at the bowl
  // yet are well hydrated, so a low logged number must never read as a problem.
  const target =
    input.latestWeightGrams && input.latestWeightGrams > 0
      ? Math.round((input.latestWeightGrams / 1000) * BREED_REF.waterMlPerKgPerDay)
      : null;
  const detail = target ? `~${target} ml/day incl. food` : "~50 ml/kg/day incl. food";
  if (input.avgWaterMl == null) {
    return {
      key: "hydration",
      title: "Hydration",
      status: "info",
      value: "not logged",
      detail,
      note: "Water is optional — wet food covers most of it.",
    };
  }
  const avg = Math.round(input.avgWaterMl);
  const value = `${avg} ml/day logged`;
  if (target && avg >= target) {
    return { key: "hydration", title: "Hydration", status: "good", value, detail };
  }
  return {
    key: "hydration",
    title: "Hydration",
    status: "info",
    value,
    detail,
    note: "Wet food counts too, so a low bowl number is often fine.",
  };
}

function scoreCare(input: ScoreInput): ScoreDimension {
  if (input.overdueCare.length === 0) {
    return {
      key: "care",
      title: "Preventive care",
      status: "good",
      value: "Up to date",
      detail: "vaccines · deworming · flea",
    };
  }
  const first = input.overdueCare[0];
  const more = input.overdueCare.length - 1;
  return {
    key: "care",
    title: "Preventive care",
    status: "attention",
    value: `${input.overdueCare.length} overdue`,
    detail: `${first.title} · ${first.daysOverdue}d overdue${more > 0 ? ` +${more} more` : ""}`,
    note: "Catch up on the Care tab.",
  };
}

/** Grade every dimension and roll up an overall status + friendly headline. */
export function healthScorecard(input: ScoreInput): Scorecard {
  const dimensions = [
    scoreWeight(input),
    scoreBcs(input),
    scoreEating(input),
    scoreHydration(input),
    scoreCare(input),
  ];

  const attention = dimensions.filter((d) => d.status === "attention").length;
  const watch = dimensions.filter((d) => d.status === "watch").length;
  // A real health signal means weight/bcs/eating is actually known — care being
  // vacuously "up to date" (no events) must not read as a clean bill of health.
  const healthKnown = dimensions.some(
    (d) =>
      (d.key === "weight" || d.key === "bcs" || d.key === "eating") &&
      d.status !== "unknown",
  );

  let overall: ScoreStatus;
  let headline: string;
  if (attention > 0) {
    overall = "attention";
    headline = `${attention} thing${attention > 1 ? "s" : ""} to look at.`;
  } else if (watch > 0) {
    overall = "watch";
    headline = `${watch} thing${watch > 1 ? "s" : ""} worth watching.`;
  } else if (healthKnown) {
    overall = "good";
    headline = "Looking healthy across the board.";
  } else {
    overall = "unknown";
    headline = "Log a weight and a few feeds to see how they're doing.";
  }

  return { overall, headline, dimensions };
}
