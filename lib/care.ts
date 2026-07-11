// Care engine rules — SPEC §6.2. One engine for all scheduled care.

import type { CareEvent } from "@/lib/types";
import { todayInTz, addDaysToDate } from "@/lib/time";

export function isOpen(e: Pick<CareEvent, "done_at" | "is_active">): boolean {
  return e.done_at == null && e.is_active;
}

export function isOverdue(e: CareEvent, today = todayInTz()): boolean {
  return isOpen(e) && e.due_date != null && e.due_date < today;
}

export function isDueToday(e: CareEvent, today = todayInTz()): boolean {
  return isOpen(e) && e.due_date === today;
}

/** Next occurrence chains from ACTUAL completion date, not the original due date. */
export function nextDueDate(doneDateStr: string, intervalDays: number): string {
  return addDaysToDate(doneDateStr, intervalDays);
}

export type CareBuckets = {
  overdue: CareEvent[];
  today: CareEvent[];
  upcoming: CareEvent[];
};

/** Sort key: due_time nulls last (SPEC §6.2). */
function byDueTime(a: CareEvent, b: CareEvent): number {
  if (a.due_time == null && b.due_time == null) return 0;
  if (a.due_time == null) return 1;
  if (b.due_time == null) return -1;
  return a.due_time.localeCompare(b.due_time);
}

export function bucketCareEvents(
  events: CareEvent[],
  today = todayInTz(),
): CareBuckets {
  const open = events.filter(isOpen);
  return {
    overdue: open
      .filter((e) => e.due_date != null && e.due_date < today)
      .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1)),
    today: open.filter((e) => e.due_date === today).sort(byDueTime),
    upcoming: open
      .filter((e) => e.due_date != null && e.due_date > today)
      .sort((a, b) =>
        a.due_date! === b.due_date! ? byDueTime(a, b) : a.due_date! < b.due_date! ? -1 : 1,
      ),
  };
}

/**
 * Med-course expansion (SPEC §6.2): duration × times/day → one open dose row each.
 * Returns partial rows ready to insert (caller adds cat_id, created_by, etc.).
 */
export function expandMedCourse(
  startDate: string,
  durationDays: number,
  times: string[], // ['08:00','20:00']
): { due_date: string; due_time: string }[] {
  const rows: { due_date: string; due_time: string }[] = [];
  for (let d = 0; d < durationDays; d++) {
    const due_date = addDaysToDate(startDate, d);
    for (const due_time of times) {
      rows.push({ due_date, due_time });
    }
  }
  return rows;
}
