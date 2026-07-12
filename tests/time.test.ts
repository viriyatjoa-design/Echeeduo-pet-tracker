import { describe, it, expect } from "vitest";
import {
  todayInTz,
  addDaysToDate,
  daysBetween,
  relativeDay,
  APP_TZ,
} from "@/lib/time";

describe("APP_TZ", () => {
  it("is Asia/Jakarta", () => {
    expect(APP_TZ).toBe("Asia/Jakarta");
  });
});

describe("todayInTz", () => {
  it("returns an ISO YYYY-MM-DD string", () => {
    expect(todayInTz()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("addDaysToDate", () => {
  it("adds days within a month", () => {
    expect(addDaysToDate("2026-07-12", 1)).toBe("2026-07-13");
    expect(addDaysToDate("2026-07-12", 7)).toBe("2026-07-19");
  });
  it("crosses month and year boundaries", () => {
    expect(addDaysToDate("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDaysToDate("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDate("2026-01-01", -1)).toBe("2025-12-31");
  });
  it("handles leap years", () => {
    expect(addDaysToDate("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDaysToDate("2026-02-28", 1)).toBe("2026-03-01"); // 2026 not leap
  });
  it("is the inverse of daysBetween", () => {
    expect(daysBetween("2026-07-12", addDaysToDate("2026-07-12", 90))).toBe(90);
    expect(daysBetween("2026-07-12", addDaysToDate("2026-07-12", -30))).toBe(-30);
  });
});

describe("daysBetween", () => {
  it("returns whole signed day differences", () => {
    expect(daysBetween("2026-07-12", "2026-07-13")).toBe(1);
    expect(daysBetween("2026-07-13", "2026-07-12")).toBe(-1);
    expect(daysBetween("2026-07-12", "2026-07-12")).toBe(0);
  });
  it("spans a full non-leap year", () => {
    expect(daysBetween("2026-01-01", "2026-12-31")).toBe(364);
  });
});

describe("relativeDay", () => {
  it("labels today, tomorrow and yesterday relative to now", () => {
    const today = todayInTz();
    expect(relativeDay(today)).toBe("Today");
    expect(relativeDay(addDaysToDate(today, 1))).toBe("Tomorrow");
    expect(relativeDay(addDaysToDate(today, -1))).toBe("Yesterday");
  });
  it("formats a weekday for dates further out", () => {
    const far = addDaysToDate(todayInTz(), 10);
    // e.g. "Mon 22 Jul"
    expect(relativeDay(far)).toMatch(/^[A-Z][a-z]{2} \d{1,2} [A-Z][a-z]{2}$/);
  });
});
