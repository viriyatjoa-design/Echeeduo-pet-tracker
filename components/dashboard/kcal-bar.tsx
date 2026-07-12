import { AlertTriangle } from "lucide-react";
import { round1 } from "@/lib/kcal";

/**
 * Compact daily-kcal readout (owner-picked over the big ring: avatar ring +
 * numbers live in the card header, this is the thin bar under it). ~36px tall
 * where the ring was ~176px. Copper tip = the theme signature.
 * Pure presentational + server-safe.
 */
const t = {
  nudge: "Log a weight to unlock daily targets",
  treat: "Over treat limit",
  over: (n: number) => `${n} kcal over`,
} as const;

export function KcalBar({
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
  const hasTarget = target != null && target > 0;

  if (!hasTarget) {
    return <p className="text-xs text-muted-foreground">{t.nudge}</p>;
  }

  const fraction = Math.min(kcal / target!, 1);
  const pct = Math.round(fraction * 100);
  const over = kcal > target!;
  const accent = `hsl(var(--cat-${accentIndex}))`;

  return (
    <div className="space-y-1.5">
      <div
        className="relative h-2 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${round1(kcal)} of ${target} kcal today`}
      >
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: accent }}
        />
        {/* Copper tip at the fill edge (hidden when there's no room for it). */}
        {pct >= 5 && (
          <span
            aria-hidden
            className="absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-copper transition-[left] duration-500 ease-out"
            style={{ left: `calc(${pct}% - 5px)` }}
          />
        )}
      </div>

      {(treat || over) && (
        <div className="flex items-center justify-end gap-2">
          {treat && (
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-warning-strong"
              // Alpha inline: Tailwind modifiers no-op on plain-hsl() tokens.
              style={{ backgroundColor: "hsl(var(--warning) / 0.15)" }}
            >
              <AlertTriangle className="h-3 w-3" aria-hidden />
              {t.treat}
            </span>
          )}
          {over && !treat && (
            <span className="text-[11px] font-medium text-muted-foreground">
              {t.over(round1(kcal - target!))}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default KcalBar;
