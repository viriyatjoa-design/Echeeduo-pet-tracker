import { describe, it, expect } from "vitest";
import { healthScorecard, type ScoreInput } from "@/lib/health-score";

/** A healthy female cat with everything logged; override per test. */
function input(over: Partial<ScoreInput> = {}): ScoreInput {
  return {
    sex: "female",
    latestWeightGrams: 4800, // in the 3500–5500 female band
    latestBcs: 5, // in the 4–5 target
    bcsTargetMin: 4,
    bcsTargetMax: 5,
    dailyKcalTarget: 260,
    avgKcal: 260, // on target
    kcalDays: 10,
    avgWaterMl: 260, // >= ~240 target (4.8kg × 50)
    overdueCare: [],
    ...over,
  };
}

function dim(card: ReturnType<typeof healthScorecard>, key: string) {
  return card.dimensions.find((d) => d.key === key)!;
}

describe("healthScorecard — weight", () => {
  it("in-band is good", () => {
    expect(dim(healthScorecard(input()), "weight").status).toBe("good");
  });
  it("far over the band is attention (>10% over)", () => {
    expect(dim(healthScorecard(input({ latestWeightGrams: 6200 })), "weight").status).toBe("attention");
  });
  it("just over the band is watch", () => {
    expect(dim(healthScorecard(input({ latestWeightGrams: 5700 })), "weight").status).toBe("watch");
  });
  it("under the band is watch", () => {
    expect(dim(healthScorecard(input({ latestWeightGrams: 3000 })), "weight").status).toBe("watch");
  });
  it("no weight is unknown", () => {
    expect(dim(healthScorecard(input({ latestWeightGrams: null })), "weight").status).toBe("unknown");
  });
  it("uses the male band for a male cat", () => {
    // 4800g is BELOW the male band (5000–7000) but inside the female band.
    expect(dim(healthScorecard(input({ sex: "male" })), "weight").status).toBe("watch");
  });
});

describe("healthScorecard — body condition", () => {
  it("within target is good", () => {
    expect(dim(healthScorecard(input({ latestBcs: 4 })), "bcs").status).toBe("good");
  });
  it("above target is attention (overweight)", () => {
    expect(dim(healthScorecard(input({ latestBcs: 7 })), "bcs").status).toBe("attention");
  });
  it("below target is watch", () => {
    expect(dim(healthScorecard(input({ latestBcs: 3 })), "bcs").status).toBe("watch");
  });
  it("no bcs is unknown", () => {
    expect(dim(healthScorecard(input({ latestBcs: null })), "bcs").status).toBe("unknown");
  });
});

describe("healthScorecard — eating", () => {
  it("on target is good", () => {
    expect(dim(healthScorecard(input({ avgKcal: 260 })), "eating").status).toBe("good");
  });
  it("115% of target is still good (boundary)", () => {
    expect(dim(healthScorecard(input({ avgKcal: 260 * 1.15 })), "eating").status).toBe("good");
  });
  it("clearly over target is watch", () => {
    expect(dim(healthScorecard(input({ avgKcal: 340 })), "eating").status).toBe("watch");
  });
  it("clearly under target is watch", () => {
    expect(dim(healthScorecard(input({ avgKcal: 180 })), "eating").status).toBe("watch");
  });
  it("no target (no weight) is unknown", () => {
    expect(dim(healthScorecard(input({ dailyKcalTarget: null })), "eating").status).toBe("unknown");
  });
  it("no feeds logged is unknown", () => {
    expect(dim(healthScorecard(input({ avgKcal: null, kcalDays: 0 })), "eating").status).toBe("unknown");
  });
});

describe("healthScorecard — hydration (never alarming)", () => {
  it("at/above target is good", () => {
    expect(dim(healthScorecard(input({ avgWaterMl: 300 })), "hydration").status).toBe("good");
  });
  it("below target is info, not attention/watch", () => {
    expect(dim(healthScorecard(input({ avgWaterMl: 50 })), "hydration").status).toBe("info");
  });
  it("not logged is info", () => {
    const d = dim(healthScorecard(input({ avgWaterMl: null })), "hydration");
    expect(d.status).toBe("info");
    expect(d.value).toBe("not logged");
  });
});

describe("healthScorecard — preventive care", () => {
  it("nothing overdue is good", () => {
    expect(dim(healthScorecard(input({ overdueCare: [] })), "care").status).toBe("good");
  });
  it("overdue is attention and names the most-overdue first", () => {
    const d = dim(
      healthScorecard(
        input({
          overdueCare: [
            { title: "Dewormer", daysOverdue: 12 },
            { title: "Flea", daysOverdue: 3 },
          ],
        }),
      ),
      "care",
    );
    expect(d.status).toBe("attention");
    expect(d.value).toBe("2 overdue");
    expect(d.detail).toContain("Dewormer");
    expect(d.detail).toContain("+1 more");
  });
});

describe("healthScorecard — overall rollup", () => {
  it("all good reads healthy", () => {
    const card = healthScorecard(input());
    expect(card.overall).toBe("good");
    expect(card.headline).toMatch(/healthy/i);
  });
  it("any attention dominates", () => {
    const card = healthScorecard(input({ latestBcs: 8 }));
    expect(card.overall).toBe("attention");
    expect(card.headline).toMatch(/to look at/);
  });
  it("watch when only watches, no attention", () => {
    const card = healthScorecard(input({ avgKcal: 340 }));
    expect(card.overall).toBe("watch");
  });
  it("no health signal is unknown even if no care is overdue", () => {
    const card = healthScorecard(
      input({
        latestWeightGrams: null,
        latestBcs: null,
        dailyKcalTarget: null,
        avgKcal: null,
        kcalDays: 0,
        avgWaterMl: null,
        overdueCare: [],
      }),
    );
    expect(card.overall).toBe("unknown");
    expect(dim(card, "care").status).toBe("good"); // vacuously up to date
  });
});
