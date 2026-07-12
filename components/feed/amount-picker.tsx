"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { gramsFromPortion, kcalFromGrams, round1 } from "@/lib/kcal";
import { strings } from "@/lib/strings";
import type { Food } from "@/lib/types";

/**
 * Amount entry shared by quick-feed and feed-all (SPEC §6.1). Portion mode when
 * the food has a unit (¼ ⅓ ½ 1 1½ 2 + custom), else a grams stepper. A grams
 * toggle is always available for unit foods. Emits a controlled AmountValue;
 * `resolveSnapshot` turns it into the grams/qty/unit_label we persist.
 */

export type AmountValue = {
  mode: "portion" | "grams";
  /** Raw text — kept as typed (like `grams`) so entries such as "0.75" survive
   *  keystroke-by-keystroke; parsed only where grams are resolved. */
  qty: string;
  grams: string;
};

const PORTION_CHIPS: { label: string; qty: number }[] = [
  { label: "¼", qty: 0.25 },
  { label: "⅓", qty: 0.33 },
  { label: "½", qty: 0.5 },
  { label: "1", qty: 1 },
  { label: "1½", qty: 1.5 },
  { label: "2", qty: 2 },
];

export function foodHasUnit(food: Food): boolean {
  return !!(food.unit_id && food.unit_grams);
}

/** Default amount when a food is (re)selected. */
export function initialAmount(food: Food): AmountValue {
  const hasUnit = foodHasUnit(food);
  const prefill =
    food.default_serving_grams != null
      ? food.default_serving_grams
      : hasUnit
        ? food.unit_grams
        : null;
  return {
    mode: hasUnit ? "portion" : "grams",
    qty: "1",
    grams: prefill != null ? String(round1(Number(prefill))) : "",
  };
}

/** Canonical grams for the current amount (0 when not resolvable). */
export function resolveGrams(food: Food, v: AmountValue): number {
  if (v.mode === "portion" && foodHasUnit(food)) {
    const q = Number(v.qty);
    return Number.isFinite(q) && q > 0
      ? gramsFromPortion(q, Number(food.unit_grams))
      : 0;
  }
  const g = Number(v.grams);
  return Number.isFinite(g) && g > 0 ? round1(g) : 0;
}

/** Grams + portion snapshot to persist on the feeding log. */
export function resolveSnapshot(
  food: Food,
  v: AmountValue,
  unitLabel: string | null,
): { grams: number; qty: number | null; unit_label: string | null } {
  if (v.mode === "portion" && foodHasUnit(food)) {
    return {
      grams: resolveGrams(food, v),
      qty: Number(v.qty),
      unit_label: unitLabel,
    };
  }
  return { grams: resolveGrams(food, v), qty: null, unit_label: null };
}

export function AmountPicker({
  food,
  value,
  onChange,
  compact = false,
}: {
  food: Food;
  value: AmountValue;
  onChange: (v: AmountValue) => void;
  compact?: boolean;
}) {
  const hasUnit = foodHasUnit(food);
  const grams = resolveGrams(food, value);
  const kcal = kcalFromGrams(grams, Number(food.kcal_per_100g));
  // String comparison so intermediate text ("0.", "1.") stays in the input
  // instead of collapsing to a chip's canonical value mid-keystroke.
  const isCustomQty =
    value.mode === "portion" &&
    !PORTION_CHIPS.some((c) => String(c.qty) === value.qty);

  function step(delta: number) {
    const cur = Number(value.grams) || 0;
    onChange({ ...value, grams: String(Math.max(0, round1(cur + delta))) });
  }

  return (
    <div className="space-y-3">
      {hasUnit && (
        <div className="inline-flex rounded-xl border border-border p-0.5 text-sm">
          {(["portion", "grams"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ ...value, mode: m })}
              className={cn(
                "rounded-lg px-3 py-1 font-medium transition-colors",
                value.mode === m
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "portion" ? strings.feed.portion : strings.feed.grams}
            </button>
          ))}
        </div>
      )}

      {value.mode === "portion" && hasUnit ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {PORTION_CHIPS.map((c) => (
              <button
                key={c.label}
                type="button"
                onClick={() => onChange({ ...value, qty: String(c.qty) })}
                className={cn(
                  "h-10 min-w-[2.75rem] rounded-xl border px-3 text-base font-semibold transition-colors",
                  Number(value.qty) === c.qty
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-accent",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {strings.feed.custom}
            </span>
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.25"
              value={isCustomQty ? value.qty : ""}
              placeholder="e.g. 0.75"
              onChange={(e) => onChange({ ...value, qty: e.target.value })}
              className="h-10 w-28"
            />
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => step(-5)}
            aria-label="Less"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <div className="relative">
            <Input
              type="number"
              inputMode="decimal"
              min="0"
              step="1"
              value={value.grams}
              onChange={(e) => onChange({ ...value, grams: e.target.value })}
              className="h-11 w-28 pr-7 text-center text-base font-semibold"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              g
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => step(5)}
            aria-label="More"
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      <p className={cn("font-medium", compact ? "text-sm" : "text-base")}>
        <span className="text-muted-foreground">{strings.feed.preview} </span>
        <span className="text-foreground">
          {round1(grams)} g · {kcal} kcal
        </span>
      </p>
    </div>
  );
}
