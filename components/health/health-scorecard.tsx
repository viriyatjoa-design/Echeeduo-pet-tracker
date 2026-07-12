import { Activity } from "lucide-react";
import type { Cat } from "@/lib/types";
import { getHealthScorecard } from "@/lib/health-score-data";
import type { Scorecard, ScoreStatus } from "@/lib/health-score";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Per-cat Health Scorecard (cat profile → Health tab): grades weight, body
 * condition, eating, hydration and preventive care against the British
 * Shorthair references. Computed from existing logged data — no setup/migration.
 * Directional guidance, never a diagnosis.
 *
 * Split into an async fetcher (HealthScorecard) + a pure view (ScorecardView)
 * so the presentation renders without a DB (tests / visual harness).
 */

const t = {
  title: "Health check",
  vet: "Against British Shorthair references · not a diagnosis",
} as const;

// Semantic status → dot color + label. Uses the theme-aware success/warning/
// destructive tokens, never the brand accent (kept for identity).
const STATUS: Record<
  ScoreStatus,
  { dot: string; label: string; labelColor: string }
> = {
  good: { dot: "bg-success", label: "Good", labelColor: "text-success" },
  watch: { dot: "bg-warning", label: "Watch", labelColor: "text-warning-strong" },
  attention: {
    dot: "bg-destructive",
    label: "Look",
    labelColor: "text-destructive-strong",
  },
  info: {
    dot: "bg-muted-foreground/50",
    label: "FYI",
    labelColor: "text-muted-foreground",
  },
  unknown: {
    dot: "bg-muted-foreground/40",
    label: "—",
    labelColor: "text-muted-foreground",
  },
};

export function ScorecardView({ card }: { card: Scorecard }) {
  const head = STATUS[card.overall];
  return (
    <Card className="rounded-2xl">
      <CardContent className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-secondary ${head.labelColor}`}
            aria-hidden
          >
            <Activity className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-foreground">{t.title}</p>
            <p className="text-sm text-muted-foreground">{card.headline}</p>
          </div>
        </div>

        <ul className="space-y-1.5">
          {card.dimensions.map((d) => {
            const s = STATUS[d.status];
            return (
              <li
                key={d.key}
                className="flex items-start gap-2.5 border-t border-border pt-1.5 first:border-t-0 first:pt-0"
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${s.dot}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {d.title}
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {d.value}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="min-w-0 truncate text-xs text-muted-foreground">
                      {d.detail}
                    </span>
                    <span
                      className={`shrink-0 text-xs font-semibold ${s.labelColor}`}
                    >
                      {s.label}
                    </span>
                  </div>
                  {d.note && (
                    <p className="mt-0.5 text-xs text-muted-foreground">{d.note}</p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>

        <p className="text-[11px] text-muted-foreground">{t.vet}</p>
      </CardContent>
    </Card>
  );
}

/** Async wrapper: fetch + grade, then render the view. */
export async function HealthScorecard({ cat }: { cat: Cat }) {
  const card = await getHealthScorecard(cat);
  return <ScorecardView card={card} />;
}

export default HealthScorecard;
