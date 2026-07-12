import { describe, it, expect } from "vitest";
import {
  round1,
  kcalFromGrams,
  gramsFromPortion,
  computeMER,
  dailyTarget,
  exceedsTreatLimit,
  portionLabel,
  TREAT_LIMIT_RATIO,
} from "@/lib/kcal";

describe("round1", () => {
  it("rounds to one decimal", () => {
    expect(round1(342.34)).toBe(342.3);
    expect(round1(342.36)).toBe(342.4);
    expect(round1(0.05)).toBe(0.1); // Math.round(0.5) rounds up
    expect(round1(40)).toBe(40);
  });
});

describe("kcalFromGrams", () => {
  it("computes grams x kcal/100g / 100, rounded to 0.1", () => {
    expect(kcalFromGrams(85, 129)).toBe(109.7); // 109.65 -> 109.7
    expect(kcalFromGrams(42.5, 100)).toBe(42.5);
    expect(kcalFromGrams(100, 380)).toBe(380);
    expect(kcalFromGrams(0, 380)).toBe(0);
  });
});

describe("gramsFromPortion", () => {
  it("converts a portion to grams (half of an 85g can = 42.5)", () => {
    expect(gramsFromPortion(0.5, 85)).toBe(42.5);
    expect(gramsFromPortion(1, 85)).toBe(85);
    expect(gramsFromPortion(0.25, 85)).toBe(21.3); // 21.25 -> 21.3
  });
});

describe("computeMER", () => {
  it("uses 1.2 factor when neutered, 1.4 otherwise", () => {
    expect(computeMER(5000, true)).toBe(281);
    expect(computeMER(5000, false)).toBe(328);
    expect(computeMER(4000, true)).toBe(238);
  });
  it("scales with the 0.75 metabolic exponent, not linearly", () => {
    const four = computeMER(4000, true);
    const eight = computeMER(8000, true);
    // Doubling weight must be LESS than doubling kcal (exponent < 1).
    expect(eight).toBeLessThan(four * 2);
  });
});

describe("dailyTarget", () => {
  it("prefers an explicit override", () => {
    expect(dailyTarget({ daily_kcal_override: 300, neutered: true }, 5000)).toBe(300);
  });
  it("falls back to MER from the latest weight", () => {
    expect(dailyTarget({ daily_kcal_override: null, neutered: true }, 5000)).toBe(281);
  });
  it("returns null with no override and no usable weight (never a fake target)", () => {
    expect(dailyTarget({ daily_kcal_override: null, neutered: true }, null)).toBeNull();
    expect(dailyTarget({ daily_kcal_override: null, neutered: true }, 0)).toBeNull();
  });
});

describe("exceedsTreatLimit", () => {
  it("flags snack kcal strictly above 10% of target", () => {
    expect(TREAT_LIMIT_RATIO).toBe(0.1);
    expect(exceedsTreatLimit(35, 300)).toBe(true); // 35 > 30
    expect(exceedsTreatLimit(30, 300)).toBe(false); // exactly at limit is OK
    expect(exceedsTreatLimit(25, 300)).toBe(false);
  });
  it("is false when there is no target", () => {
    expect(exceedsTreatLimit(50, null)).toBe(false);
    expect(exceedsTreatLimit(50, 0)).toBe(false);
  });
});

describe("portionLabel", () => {
  it("renders a fraction glyph with unit and grams", () => {
    expect(portionLabel(0.5, "can", 42.5)).toBe("½ can · 42.5 g");
    expect(portionLabel(0.25, "pouch", 21.25)).toBe("¼ pouch · 21.3 g");
    expect(portionLabel(1.5, "can", 127.5)).toBe("1½ can · 127.5 g");
  });
  it("falls back to a plain number for non-mapped quantities", () => {
    expect(portionLabel(2, "can", 170)).toBe("2 can · 170 g");
  });
  it("shows grams only when logged directly", () => {
    expect(portionLabel(null, null, 40)).toBe("40 g");
    expect(portionLabel(null, "can", 40)).toBe("40 g"); // needs both qty AND unit
  });
});
