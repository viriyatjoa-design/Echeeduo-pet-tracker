import {
  getCatFeedingHistory,
  type FeedingHistoryRow,
} from "@/lib/feeding-queries";
import { portionLabel, round1 } from "@/lib/kcal";
import { formatTime, dayInTz, relativeDay } from "@/lib/time";
import { strings } from "@/lib/strings";

const t = {
  empty: "No feeds logged yet.",
  feed: "feed",
  feeds: "feeds",
  kcal: "kcal",
} as const;

type DayGroup = {
  /** 'YYYY-MM-DD' in Asia/Jakarta. */
  day: string;
  feeds: FeedingHistoryRow[];
  totalKcal: number;
};

/** Bucket feeds (newest-first) into their Jakarta calendar day, order kept. */
function groupByDay(rows: FeedingHistoryRow[]): DayGroup[] {
  const groups: DayGroup[] = [];
  const byDay = new Map<string, DayGroup>();
  for (const r of rows) {
    const day = dayInTz(r.fed_at);
    let g = byDay.get(day);
    if (!g) {
      g = { day, feeds: [], totalKcal: 0 };
      byDay.set(day, g);
      groups.push(g);
    }
    g.feeds.push(r);
    g.totalKcal += Number(r.kcal);
  }
  return groups;
}

/**
 * A cat's feeds grouped by day (owner request: "what do they eat each date").
 * Each day is a header — the date + that day's feed count and total kcal —
 * over the feeds logged that day (food · portion · kcal · time · who). Pure so
 * it can be previewed/tested with mock rows; `FeedingHistory` feeds it real data.
 */
export function FeedingHistoryView({ rows }: { rows: FeedingHistoryRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {t.empty}
      </p>
    );
  }

  const groups = groupByDay(rows);

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.day} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 border-b border-border pb-1">
            <h3 className="text-sm font-semibold text-foreground">
              {relativeDay(g.day)}
            </h3>
            <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
              {g.feeds.length} {g.feeds.length === 1 ? t.feed : t.feeds} ·{" "}
              {round1(g.totalKcal)} {t.kcal}
            </span>
          </div>
          <ul className="divide-y divide-border/60">
            {g.feeds.map((r) => (
              <li
                key={r.id}
                className="flex items-baseline justify-between gap-3 py-2"
              >
                <span className="min-w-0 text-sm text-foreground">
                  <span className="font-medium">{r.food_name}</span>{" "}
                  <span className="text-muted-foreground">
                    · {portionLabel(r.qty, r.unit_label, Number(r.grams))} ·{" "}
                    {round1(Number(r.kcal))} {t.kcal}
                  </span>
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatTime(r.fed_at)} · {strings.common.by} {r.by}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Server Component — fetches a cat's recent feeds and renders them grouped by
 * day. Mount from the cat profile feeding tab as `<FeedingHistory catId={id} />`.
 */
export async function FeedingHistory({
  catId,
  limit = 50,
}: {
  catId: string;
  limit?: number;
}) {
  const rows = await getCatFeedingHistory(catId, limit);
  return <FeedingHistoryView rows={rows} />;
}
