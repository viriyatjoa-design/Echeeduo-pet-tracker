import type { CSSProperties } from "react";
import Link from "next/link";
import { Droplets, Utensils } from "lucide-react";
import type { Cat, CareEvent, WeightLog } from "@/lib/types";
import type { KcalPoint, LastFed } from "@/lib/feeding-queries";
import type { WeightTrend } from "@/lib/weight";
import { gramsToKg } from "@/lib/weight";
import { formatTime } from "@/lib/time";
import { round1 } from "@/lib/kcal";
import { Button } from "@/components/ui/button";
import { CatAvatar } from "@/components/cats/cat-avatar";
import { WeightBadge } from "@/components/weight/weight-badge";
import { CareChips } from "@/components/care/care-chips";
import { FeedDialog } from "@/components/feed/feed-dialog";
import type { FeedData } from "@/components/feed/quick-feed";
import { KcalBar } from "./kcal-bar";
import { KcalSparkline } from "./kcal-sparkline";

const t = {
  lastFed: "Last fed",
  noFeeds: "No feeds yet today",
  by: "by",
  feed: "Feed",
  ml: "ml today",
  weight: "Weight",
  noWeight: "No weight logged",
  last7: "Last 7 days",
  ofKcal: (target: number) => `of ${target} kcal`,
  kcalToday: "kcal today",
} as const;

/**
 * The cat's avatar wrapped in its daily-kcal progress arc (owner-picked
 * compact layout: the cat's face fills up as they eat through their day).
 */
function AvatarKcalRing({
  cat,
  photoUrl,
  fraction,
}: {
  cat: Cat;
  photoUrl?: string;
  /** 0..1 of today's target; 0 when no target. */
  fraction: number;
}) {
  const SIZE = 54;
  const STROKE = 3.5;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const accent = `hsl(var(--cat-${cat.accent_index}))`;

  return (
    <span
      className="relative grid flex-none place-items-center"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0"
        aria-hidden
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          className="stroke-muted"
        />
        {fraction > 0 && (
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            stroke={accent}
            strokeDasharray={CIRC}
            strokeDashoffset={CIRC * (1 - Math.min(fraction, 1))}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={{ transition: "stroke-dashoffset 500ms ease" }}
          />
        )}
      </svg>
      <CatAvatar cat={cat} url={photoUrl} size={44} />
    </span>
  );
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
 * One cat's Today card (SPEC §7): the kcal ring is the focal point; everything
 * else stays quiet. Subtly tinted with the cat's accent. Server Component — all
 * data is computed by the page and passed in; only the small water widget and
 * care chips are interactive (client) children.
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

  return (
    <section
      style={accentStyle}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      {/* Accent hairline at the top edge */}
      <div className="h-1 w-full bg-cat/70" />

      <div className="space-y-3 p-4">
        {/* Header → profile. The kcal readout lives HERE (owner-picked compact
            layout): progress arc around the avatar + numbers on the right. */}
        <Link
          href={`/cats/${cat.id}`}
          className="group flex items-center gap-3"
        >
          <AvatarKcalRing
            cat={cat}
            photoUrl={photoUrl}
            fraction={target != null && target > 0 ? kcal / target : 0}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg font-bold text-foreground">
              {cat.name}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {cat.breed}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span
              className="block text-xl font-bold leading-tight tabular-nums"
              style={{ color: `hsl(var(--cat-${cat.accent_index}))` }}
            >
              {round1(kcal)}
            </span>
            <span className="block text-[11px] font-medium text-muted-foreground">
              {target != null && target > 0 ? t.ofKcal(target) : t.kcalToday}
            </span>
          </span>
        </Link>

        {/* Thin daily progress bar (replaces the big ring) */}
        <KcalBar
          kcal={kcal}
          target={target}
          accentIndex={cat.accent_index}
          treat={treat}
        />

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

        {/* One-tap feed (the daily action) + compact water summary.
            Water logging stays in the FAB and the cat's Health tab. */}
        <div className="flex items-center gap-3">
          <FeedDialog
            {...feedData}
            initialCatId={cat.id}
            trigger={
              <Button
                className="h-11 flex-1 bg-cat text-white hover:bg-cat/90"
                aria-label={`${t.feed} ${cat.name}`}
              >
                <Utensils aria-hidden />
                {t.feed} {cat.name}
              </Button>
            }
          />
          <span className="inline-flex shrink-0 items-center gap-1 text-sm tabular-nums text-muted-foreground">
            <Droplets className="h-4 w-4 text-cat" aria-hidden />
            {waterMl} {t.ml}
          </span>
        </div>

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
