import { Skeleton } from "@/components/ui/skeleton";

/** Cat profile skeleton — avatar, name, chips row, tab bar, content block. */
export default function Loading() {
  return (
    <div className="space-y-5">
      {/* Back link */}
      <Skeleton className="h-4 w-16" />

      {/* Profile header: big avatar + name + detail lines */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-[72px] w-[72px] shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      {/* Chips row */}
      <div className="flex gap-2">
        <Skeleton className="h-6 w-20 rounded-full" />
        <Skeleton className="h-6 w-24 rounded-full" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      {/* Tab bar */}
      <Skeleton className="h-10 w-full rounded-xl" />

      {/* Tab content block */}
      <div className="space-y-3">
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </div>
    </div>
  );
}
