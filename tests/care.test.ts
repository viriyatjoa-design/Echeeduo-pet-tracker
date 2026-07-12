import { describe, it, expect } from "vitest";
import {
  isOpen,
  isOverdue,
  isDueToday,
  nextDueDate,
  bucketCareEvents,
  expandMedCourse,
} from "@/lib/care";
import { daysBetween } from "@/lib/time";
import type { CareEvent } from "@/lib/types";

const TODAY = "2026-07-12";

function ev(over: Partial<CareEvent> = {}): CareEvent {
  return {
    id: "e",
    cat_id: "c",
    event_type_id: "t",
    title: "Rabies booster",
    due_date: null,
    due_time: null,
    done_at: null,
    interval_days: null,
    vet_name: null,
    notes: null,
    created_by: "u",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

describe("isOpen", () => {
  it("is open only when not done and active", () => {
    expect(isOpen(ev())).toBe(true);
    expect(isOpen(ev({ done_at: "2026-07-01T00:00:00Z" }))).toBe(false);
    expect(isOpen(ev({ is_active: false }))).toBe(false);
  });
});

describe("isOverdue / isDueToday", () => {
  it("overdue = open with a due_date before today", () => {
    expect(isOverdue(ev({ due_date: "2026-07-11" }), TODAY)).toBe(true);
    expect(isOverdue(ev({ due_date: TODAY }), TODAY)).toBe(false);
    expect(isOverdue(ev({ due_date: "2026-07-13" }), TODAY)).toBe(false);
    // A completed past-due event is not overdue.
    expect(
      isOverdue(ev({ due_date: "2026-07-11", done_at: "2026-07-11T00:00:00Z" }), TODAY),
    ).toBe(false);
  });
  it("due today = open with due_date exactly today", () => {
    expect(isDueToday(ev({ due_date: TODAY }), TODAY)).toBe(true);
    expect(isDueToday(ev({ due_date: "2026-07-13" }), TODAY)).toBe(false);
  });
});

describe("nextDueDate", () => {
  it("chains interval days from the completion date", () => {
    expect(nextDueDate("2026-07-12", 90)).toBe("2026-10-10");
    // Property: the gap equals the interval, regardless of month boundaries.
    expect(daysBetween("2026-07-12", nextDueDate("2026-07-12", 90))).toBe(90);
    expect(daysBetween("2026-07-12", nextDueDate("2026-07-12", 30))).toBe(30);
  });
});

describe("bucketCareEvents", () => {
  const events = [
    ev({ id: "overdue-old", due_date: "2026-07-05" }),
    ev({ id: "overdue-recent", due_date: "2026-07-11" }),
    ev({ id: "today-late", due_date: TODAY, due_time: "20:00" }),
    ev({ id: "today-early", due_date: TODAY, due_time: "08:00" }),
    ev({ id: "today-notime", due_date: TODAY, due_time: null }),
    ev({ id: "upcoming", due_date: "2026-07-20" }),
    ev({ id: "anytime", due_date: null }),
    ev({ id: "done", due_date: "2026-07-01", done_at: "2026-07-01T00:00:00Z" }),
    ev({ id: "inactive", due_date: "2026-07-01", is_active: false }),
  ];
  const b = bucketCareEvents(events, TODAY);

  it("sorts overdue oldest-first", () => {
    expect(b.overdue.map((e) => e.id)).toEqual(["overdue-old", "overdue-recent"]);
  });
  it("sorts today's events by time with nulls last", () => {
    expect(b.today.map((e) => e.id)).toEqual(["today-early", "today-late", "today-notime"]);
  });
  it("separates upcoming and anytime, and excludes done/inactive", () => {
    expect(b.upcoming.map((e) => e.id)).toEqual(["upcoming"]);
    expect(b.anytime.map((e) => e.id)).toEqual(["anytime"]);
    const allIds = [...b.overdue, ...b.today, ...b.upcoming, ...b.anytime].map((e) => e.id);
    expect(allIds).not.toContain("done");
    expect(allIds).not.toContain("inactive");
  });
});

describe("expandMedCourse", () => {
  it("creates one dose per day x time", () => {
    const rows = expandMedCourse("2026-07-12", 3, ["08:00", "20:00"]);
    expect(rows).toHaveLength(6);
    expect(rows[0]).toEqual({ due_date: "2026-07-12", due_time: "08:00" });
    expect(rows[1]).toEqual({ due_date: "2026-07-12", due_time: "20:00" });
    expect(rows[5]).toEqual({ due_date: "2026-07-14", due_time: "20:00" });
  });
  it("handles a single dose over a single day", () => {
    expect(expandMedCourse("2026-07-12", 1, ["09:00"])).toEqual([
      { due_date: "2026-07-12", due_time: "09:00" },
    ]);
  });
});
