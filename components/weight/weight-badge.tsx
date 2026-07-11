import { TrendingUp, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { WeightTrend } from "@/lib/weight";

/**
 * Compact weight-trend badge (SPEC §6.3). Server-safe + presentational: it
 * takes the result of `weightTrend(logs)` and renders nothing when there's no
 * flagged trend. A larger swing (≥10%) reads red; a smaller one reads amber.
 * Used on the dashboard cat card and the cat profile weight section.
 */
export function WeightBadge({ trend }: { trend: WeightTrend }) {
  if (!trend) return null;

  const up = trend.direction === "up";
  const Icon = up ? TrendingUp : TrendingDown;
  const variant = trend.pct >= 10 ? "destructive" : "warning";
  const arrow = up ? "↑" : "↓";

  return (
    <Badge
      variant={variant}
      aria-label={`Weight ${up ? "up" : "down"} ${trend.pct}% versus about ${trend.overDays} days ago`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {arrow} {trend.pct}%
    </Badge>
  );
}
