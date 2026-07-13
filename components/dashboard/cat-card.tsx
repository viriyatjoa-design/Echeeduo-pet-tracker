import type { CSSProperties } from "react";
import Link from "next/link";
import { Utensils, Droplets } from "lucide-react";
import type { Cat, CareEvent, WeightLog } from "@/lib/types";
import type { KcalPoint, LastFed } from "@/lib/feeding-queries";
import type { WeightTrend } from "@/lib/weight";
import { gramsToKg } from "@/lib/weight";
import { BREED_REF } from "@/lib/cat-care-facts";
import { formatTime } from "@/lib/time";
import { round1 } from "@/lib/kcal";
import { CatAvatar } from "@/components/cats/cat-avatar";
import { WeightBadge } from "@/components/weight/weight-badge";
import { CareChips } from "@/components/care/care-chips";
import { CatWaterButton } from "@/components/dashboard/cat-water-button";
import { FeedDialog } from "@/components/feed/feed-dialog";
import { FoodBowl, WaterBowl } from "@/components/feed/feeding-bowls";
import type { FeedData } from "@/components/feed/quick-feed";
import { KcalSparkline } from "./kcal-sparkline";

const t = {
  lastFed: "Last fed",
  noFeeds: "No feeds yet today",
  by: "by",
  weight: "Weight",
  noWeight: "No weight logged",
  last7: "Last 7 days",
  kcal: "kcal",
  kcalOver: "kcal · over",
  ml: "ml",
  mlFull: "ml · full ✓",
  feedChip: "Feed",
  waterChip: "Water",
} as const;

/** A tappable feeding-station cell (a bowl + its numbers). */
const CELL =
  "flex flex-col items-center gap-1.5 rounded-2xl border border-border/70 bg-muted/40 px-2 py-3 text-center transition-colors hover:bg-muted/70 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** A cat-mood line derived from how close they are to their kcal target. */
function moodLabel(fraction: number, hasTarget: boolean): string {
  if (!hasTarget) return "";
  if (fraction <= 0) return "hungry — not fed yet";
  if (fraction > 1) return "over target — treat day 🐾";
  if (fraction >= 0.85) return "nearly there";
  if (fraction < 0.3) return "just getting started";
  return "on track";
}

export type CatCardData = {
  cat: Cat;
  /** Signed avatar URL (resolved by the page); initials fallback without it. */
  photoUrl?: string;
  kcal: number;
  target: number | null;
  treat: boolean;
  series: KcalPoint[];
  lastFed: LastFed | null;
  latestWeight: WeightLog | null;
  trend: WeightTrend;
  waterMl: number;
  careEvents: CareEvent[];
  careTypeLabels: Map<string, string>;
  feedData: FeedData;
};

/**
 * One cat's Today card (SPEC §7). The focal point is the feeding station: a
 * matched pair of bowls (food in the cat's coat colour, water in blue) that
 * fill through the day and double as the feed / water log buttons. Server
 * Component — all data is computed by the page; only the bowls' dialogs are
 * interactive (client) children.
 */
export function CatCard({
  cat,
  photoUrl,
  kcal,
  target,
  treat,
  series,
  lastFed,
  latestWeight,
  trend,
  waterMl,
  careEvents,
  careTypeLabels,
  feedData,
}: CatCardData) {
  const accentStyle = {
    "--cat-accent": `var(--cat-${cat.accent_index})`,
  } as CSSProperties;

  const hasTarget = target != null && target > 0;
  const foodFraction = hasTarget ? kcal / (target as number) : 0;
  const foodOver = hasTarget && kcal > (target as number);

  // Daily water goal ≈ 50 ml/kg (BREED_REF); needs a weight to compute.
  const waterGoal = latestWeight
    ? Math.round(
        (latestWeight.weight_grams / 1000) * BREED_REF.waterMlPerKgPerDay,
      )
    : null;
  const waterFraction = waterGoal ? waterMl / waterGoal : 0;
  const waterFull = waterGoal != null && waterMl >= waterGoal;

  const mood = moodLabel(foodFraction, hasTarget);

  return (
    <section
      style={accentStyle}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      {/* Accent hairline at the top edge */}
      <div className="h-1 w-full bg-cat/70" />

      <div className="space-y-3 p-4">
        {/* Header → profile. Identity only; the numbers live under the bowls. */}
        <Link href={`/cats/${cat.id}`} className="group flex items-center gap-3">
          <CatAvatar cat={cat} url={photoUrl} size={44} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-bold text-foreground">
              {cat.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {mood || cat.breed}
            </span>
          </span>
        </Link>

        {/* Feeding station: tap the food bowl to feed, the water bowl to log
            water. Bowls fill toward each day's target. */}
        <div className="grid grid-cols-2 gap-2">
          <FeedDialog
            {...feedData}
            initialCatId={cat.id}
            trigger={
              <button type="button" className={CELL} aria-label={`Feed ${cat.name}`}>
                <FoodBowl
                  id={`${cat.id}-food`}
                  accentIndex={cat.accent_index}
                  fraction={foodFraction}
                  treat={treat}
                  width={104}
                  title={`${cat.name} food bowl`}
                />
                <span className="leading-tight">
                  <span className="text-sm font-extrabold tabular-nums text-foreground">
                    {round1(kcal)}
                  </span>
                  {hasTarget && (
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {" "}
                      / {target}
                    </span>
                  )}
                  <span
                    className={`block text-[10px] font-bold uppercase tracking-wide ${
                      foodOver ? "text-warning-strong" : "text-muted-foreground"
                    }`}
                  >
                    {foodOver ? t.kcalOver : t.kcal}
                  </span>
                </span>
                {/* Action chip — the whole cell is the button; this makes it read
                    as one. */}
                <span className="inline-flex items-center gap-1 rounded-full bg-cat/10 px-2.5 py-1 text-[11px] font-bold text-cat">
                  <Utensils className="h-3.5 w-3.5" aria-hidden />
                  {t.feedChip}
                </span>
              </button>
            }
          />

          <CatWaterButton
            cat={cat}
            waterMl={waterMl}
            triggerClassName={CELL}
            trigger={
              <>
                <WaterBowl
                  id={`${cat.id}-water`}
                  fraction={waterFraction}
                  width={104}
                  title={`${cat.name} water bowl`}
                />
                <span className="leading-tight">
                  <span className="text-sm font-extrabold tabular-nums text-foreground">
                    {waterMl}
                  </span>
                  {waterGoal != null && (
                    <span className="text-[11px] font-bold text-muted-foreground">
                      {" "}
                      / {waterGoal}
                    </span>
                  )}
                  <span
                    className={`block text-[10px] font-bold uppercase tracking-wide ${
                      waterFull ? "text-success" : "text-muted-foreground"
                    }`}
                  >
                    {waterFull ? t.mlFull : t.ml}
                  </span>
                </span>
                {/* Matching chip so the water bowl reads as a button too. */}
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{
                    color: "hsl(var(--water))",
                    backgroundColor: "hsl(var(--water) / 0.14)",
                  }}
                >
                  <Droplets className="h-3.5 w-3.5" aria-hidden />
                  {t.waterChip}
                </span>
              </>
            }
          />
        </div>

        {/* 7-day trend */}
        <div className="space-y-1">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t.last7}
          </p>
          <KcalSparkline points={series} accentIndex={cat.accent_index} />
        </div>

        {/* Last fed */}
        <p className="text-sm text-muted-foreground">
          {lastFed ? (
            <>
              <span className="font-medium text-foreground">{t.lastFed}</span>{" "}
              {formatTime(lastFed.fed_at)} · {round1(lastFed.grams)} g{" "}
              {lastFed.food_name} ·{" "}
              <span className="text-foreground">
                {t.by} {lastFed.by}
              </span>
            </>
          ) : (
            t.noFeeds
          )}
        </p>

        {/* Weight + trend */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            <span className="font-medium text-foreground">{t.weight}</span>{" "}
            {latestWeight ? (
              <span className="tabular-nums">
                {gramsToKg(latestWeight.weight_grams)} kg
              </span>
            ) : (
              <span>{t.noWeight}</span>
            )}
          </span>
          <WeightBadge trend={trend} />
        </div>

        {/* Care chips (renders nothing when nothing is overdue / due today) */}
        <CareChips events={careEvents} typeLabels={careTypeLabels} />
      </div>
    </section>
  );
}

export default CatCard;
