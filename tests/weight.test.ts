import { describe, it, expect } from "vitest";
import { weightTrend, gramsToKg } from "@/lib/weight";
import type { WeightLog } from "@/lib/types";

function log(measured_at: string, weight_grams: number): WeightLog {
  return {
    id: measured_at,
    cat_id: "c",
    weight_grams,
    bcs: null,
    measured_at,
    notes: null,
    created_by: "u",
    is_active: true,
    created_at: `${measured_at}T00:00:00Z`,
  };
}

describe("weightTrend", () => {
  it("returns null with fewer than 2 logs", () => {
    expect(weightTrend([])).toBeNull();
    expect(weightTrend([log("2026-07-10", 5000)])).toBeNull();
  });

  it("returns null when no baseline is >= 25 days older than latest", () => {
    // Only 10 days apart.
    expect(
      weightTrend([log("2026-07-10", 5000), log("2026-06-30", 4500)]),
    ).toBeNull();
  });

  it("returns null when the change is under 5%", () => {
    // 2% over 30 days.
    expect(
      weightTrend([log("2026-07-10", 5100), log("2026-06-10", 5000)]),
    ).toBeNull();
  });

  it("flags a downward trend of >= 5%", () => {
    // -6% over 30 days.
    const t = weightTrend([log("2026-07-10", 4700), log("2026-06-10", 5000)]);
    expect(t).not.toBeNull();
    expect(t!.direction).toBe("down");
    expect(t!.pct).toBe(6);
    expect(t!.latestGrams).toBe(4700);
    expect(t!.fromGrams).toBe(5000);
    expect(t!.overDays).toBe(30);
  });

  it("flags an upward trend and ignores order of input", () => {
    const t = weightTrend([log("2026-06-01", 4000), log("2026-07-15", 4400)]);
    expect(t!.direction).toBe("up");
    expect(t!.pct).toBe(10);
  });

  it("picks the closest baseline that is still >= 25 days older", () => {
    // Latest 2026-07-10. Candidates: 2026-07-01 (9d, too recent),
    // 2026-06-10 (30d, valid + closest), 2026-01-01 (older).
    const t = weightTrend([
      log("2026-07-10", 4700),
      log("2026-07-01", 4690),
      log("2026-06-10", 5000),
      log("2026-01-01", 5300),
    ]);
    expect(t!.fromGrams).toBe(5000);
    expect(t!.overDays).toBe(30);
  });
});

describe("gramsToKg", () => {
  it("formats grams as kg with two decimals", () => {
    expect(gramsToKg(4800)).toBe("4.80");
    expect(gramsToKg(5000)).toBe("5.00");
    expect(gramsToKg(4850)).toBe("4.85");
    expect(gramsToKg(500)).toBe("0.50");
  });
});
