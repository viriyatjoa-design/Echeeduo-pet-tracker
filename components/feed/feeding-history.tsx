import { getCatFeedingHistory } from "@/lib/feeding-queries";
import { portionLabel, round1 } from "@/lib/kcal";
import { formatTime } from "@/lib/time";
import { strings } from "@/lib/strings";

const t = {
  empty: "No feeds logged yet.",
} as const;

/**
 * A cat's recent feeds, rendered "½ can · 42.5 g · 45 kcal · 14:20 · by Rio"
 * (SPEC §7). Server Component — fetches its own data. Mount from the cat profile
 * feeding tab as `<FeedingHistory catId={cat.id} />`.
 */
export async function FeedingHistory({
  catId,
  limit = 50,
}: {
  catId: string;
  limit?: number;
}) {
  const rows = await getCatFeedingHistory(catId, limit);

  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {t.empty}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.id} className="flex items-baseline justify-between gap-3 py-2.5">
          <span className="min-w-0 text-sm text-foreground">
            <span className="font-medium">
              {portionLabel(r.qty, r.unit_label, Number(r.grams))}
            </span>{" "}
            <span className="text-muted-foreground">
              · {round1(Number(r.kcal))} kcal
            </span>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {formatTime(r.fed_at)} · {strings.common.by} {r.by}
          </span>
        </li>
      ))}
    </ul>
  );
}
