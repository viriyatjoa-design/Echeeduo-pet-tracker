import { Skeleton } from "@/components/ui/skeleton";

/** Dashboard skeleton — mirrors the header + cat-card geometry so the swap doesn't jump. */
export default function Loading() {
  return (
    <div className="space-y-4">
      {/* Header: title/date + "feed all" pill */}
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-4 w-44" />
        </div>
        <Skeleton className="h-9 w-24 rounded-full" />
      </div>

      {/* Cat cards */}
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
          >
            <div className="h-1 w-full bg-muted" />
            <div className="space-y-4 p-4">
              <div className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-full" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
              <div className="flex justify-center py-1">
                <Skeleton className="h-44 w-44 rounded-full" />
              </div>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-14 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
