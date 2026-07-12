import type { CSSProperties } from "react";
import { AlertTriangle } from "lucide-react";
import { round1 } from "@/lib/kcal";

/**
 * The signature Today-dashboard element (SPEC §7): a calm SVG donut showing
 * today's kcal against the cat's target, filled with that cat's accent.
 *
 * - `target == null` (no weight logged yet, SPEC §6.1) → show the kcal number
 *   alone plus a muted nudge, never a fake target.
 * - `treat` → an amber "over treat limit" badge under the number.
 *
 * Pure presentational + server-safe (no state, no client hooks).
 */
const t = {
  kcal: "kcal",
  of: "of",
  nudge: "Log a weight to unlock targets",
  treat: "Over treat limit",
} as const;

const SIZE = 176;
const STROKE = 14;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const CENTER = SIZE / 2;

export function KcalRing({
  kcal,
  target,
  accentIndex,
  treat,
}: {
  kcal: number;
  target: number | null;
  accentIndex: number;
  treat: boolean;
}) {
  const accent = `hsl(var(--cat-${accentIndex}))`;
  const hasTarget = target != null && target > 0;
  const fraction = hasTarget ? Math.min(kcal / target!, 1) : 0;
  const over = hasTarget && kcal > target!;
  const dashOffset = CIRC * (1 - fraction);

  const trackStyle: CSSProperties = { stroke: "hsl(var(--muted))" };
  const progressStyle: CSSProperties = {
    stroke: accent,
    strokeDasharray: CIRC,
    strokeDashoffset: dashOffset,
    transition: "stroke-dashoffset 500ms ease",
  };

  return (
    <div
      className="relative mx-auto"
      style={{ width: SIZE, height: SIZE }}
      role="img"
      aria-label={
        hasTarget
          ? `${round1(kcal)} of ${target} kcal today`
          : `${round1(kcal)} kcal today, no target set`
      }
    >
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          style={trackStyle}
          className="opacity-60"
        />
        {hasTarget && (
          <circle
            cx={CENTER}
            cy={CENTER}
            r={R}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            style={progressStyle}
            transform={`rotate(-90 ${CENTER} ${CENTER})`}
          />
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <span
          className="text-3xl font-bold leading-none tracking-tight"
          style={{ color: hasTarget ? accent : "hsl(var(--foreground))" }}
        >
          {round1(kcal)}
        </span>
        {hasTarget ? (
          <span className="mt-1 text-xs font-medium text-muted-foreground">
            {t.of} {target} {t.kcal}
          </span>
        ) : (
          <span className="mt-1 text-[11px] leading-tight text-muted-foreground">
            {t.kcal} · {t.nudge}
          </span>
        )}

        {treat && (
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-medium text-warning-strong">
            <AlertTriangle className="h-3 w-3" aria-hidden />
            {t.treat}
          </span>
        )}
        {over && !treat && (
          <span className="mt-2 text-[11px] font-medium text-muted-foreground">
            {round1(kcal - target!)} {t.kcal} over
          </span>
        )}
      </div>
    </div>
  );
}

export default KcalRing;
