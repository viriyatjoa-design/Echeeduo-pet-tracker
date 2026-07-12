import type { CSSProperties } from "react";
import { Scale } from "lucide-react";
import type { Cat } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getWeightLogs } from "@/lib/weight-queries";
import { weightTrend, gramsToKg } from "@/lib/weight";
import { todayInTz, addDaysToDate, formatDate } from "@/lib/time";
import { WeightChart, type WeightPoint } from "./weight-chart";
import { WeightForm } from "./weight-form";
import { WeightBadge } from "./weight-badge";

const t = {
  heading: "Weight & body condition",
  current: "Current weight",
  kg: "kg",
  vsAgo: (days: number) => `vs ~${days} days ago`,
  target: (kg: string) => `Target ${kg} kg`,
  noTarget: "No target set",
  bcsRange: (min: number, max: number) => `BCS target ${min}–${max}`,
  bcsCurrent: (bcs: number) => `current ${bcs}`,
  lastMeasured: (date: string) => `Measured ${date}`,
  emptyTitle: "No weights logged yet",
  emptyBody:
    "Log a weight to track this cat's trend and unlock calorie targets.",
} as const;

/**
 * Cat-profile weight section (SPEC §6.3, §7). Fetches the cat's active weight
 * logs, renders a 12-month line chart with the target overlay, the current
 * weight, a trend badge, a BCS target note, and the log button. Mounted by the
 * profile page (Phase C) as `<WeightSection cat={cat} />`.
 */
export async function WeightSection({ cat }: { cat: Cat }) {
  const logs = await getWeightLogs(cat.id);
  const trend = weightTrend(logs);
  const latest = logs[0] ?? null;

  const accentStyle = {
    "--cat-accent": `var(--cat-${cat.accent_index})`,
  } as CSSProperties;

  const targetKg =
    cat.weight_target_grams != null ? cat.weight_target_grams / 1000 : null;

  // Last 12 months, oldest → newest, as serializable {date, kg} points.
  const cutoff = addDaysToDate(todayInTz(), -365);
  const data: WeightPoint[] = logs
    .filter((l) => l.measured_at >= cutoff)
    .map((l) => ({
      date: l.measured_at,
      kg: Math.round(l.weight_grams / 10) / 100,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  return (
    <Card style={accentStyle}>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">{t.heading}</h2>
          <WeightForm
            catId={cat.id}
            catName={cat.name}
            trigger={
              <Button type="button" variant="outline" size="sm">
                <Scale className="h-4 w-4" />
                Log weight
              </Button>
            }
          />
        </div>

        {latest === null ? (
          <div className="rounded-2xl border border-dashed border-border px-4 py-8 text-center">
            <p className="font-medium text-foreground">{t.emptyTitle}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.emptyBody}</p>
            <div className="mt-4 flex justify-center">
              <WeightForm catId={cat.id} catName={cat.name} />
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-3xl font-semibold tabular-nums text-cat">
                {gramsToKg(latest.weight_grams)}
              </span>
              <span className="text-sm text-muted-foreground">{t.kg}</span>
              <WeightBadge trend={trend} />
              {trend && (
                <span className="text-xs text-muted-foreground">
                  {t.vsAgo(trend.overDays)}
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {t.lastMeasured(formatDate(latest.measured_at + "T00:00:00Z"))}
            </p>

            <WeightChart
              data={data}
              targetKg={targetKg}
              accentIndex={cat.accent_index}
            />

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span>
                {targetKg != null
                  ? t.target(gramsToKg(cat.weight_target_grams as number))
                  : t.noTarget}
              </span>
              <span>·</span>
              <span>
                {t.bcsRange(cat.bcs_target_min, cat.bcs_target_max)}
                {latest.bcs != null ? ` · ${t.bcsCurrent(latest.bcs)}` : ""}
              </span>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
