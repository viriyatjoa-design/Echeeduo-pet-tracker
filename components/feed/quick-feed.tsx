"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { strings } from "@/lib/strings";
import { round1 } from "@/lib/kcal";
import { CatAvatar } from "@/components/cats/cat-avatar";
import { Input } from "@/components/ui/input";
import { logFeed } from "@/lib/actions/feeding";
import type { Cat, Food, Lookup } from "@/lib/types";
import {
  AmountPicker,
  foodHasUnit,
  initialAmount,
  resolveGrams,
  resolveSnapshot,
  type AmountValue,
} from "./amount-picker";

/** Everything the quick-feed flow needs — fetched by the Server Component parent. */
export type FeedData = {
  cats: Cat[];
  foods: Food[];
  foodUnits: Lookup[];
  /** Household most-recently-used food ids (fallback ordering). */
  mruFoodIds: string[];
  /** Optional per-cat recent food ids (keyed by cat id). */
  recentByCat?: Record<string, string[]>;
};

/** MRU (or per-cat recent) foods first, then the rest alphabetically. */
function orderFoods(foods: Food[], recentIds: string[]): Food[] {
  const byId = new Map(foods.map((f) => [f.id, f]));
  const seen = new Set<string>();
  const head: Food[] = [];
  for (const id of recentIds) {
    const f = byId.get(id);
    if (f && !seen.has(id)) {
      head.push(f);
      seen.add(id);
    }
  }
  const rest = foods
    .filter((f) => !seen.has(f.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  return [...head, ...rest];
}

/** Local 'YYYY-MM-DDTHH:mm' for datetime-local defaults/max (phone timezone). */
function defaultLocalDateTime(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function QuickFeed({
  cats,
  foods,
  foodUnits,
  mruFoodIds,
  recentByCat,
  initialCatId,
  onDone,
}: FeedData & { initialCatId?: string; onDone?: () => void }) {
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const unitLabel = React.useMemo(
    () => new Map(foodUnits.map((u) => [u.id, u.label])),
    [foodUnits],
  );

  const [catId, setCatId] = React.useState(
    initialCatId ?? cats[0]?.id ?? "",
  );
  const [foodId, setFoodId] = React.useState("");
  const [amount, setAmount] = React.useState<AmountValue | null>(null);
  // When was it fed? Default "now"; "earlier" backdates a forgotten log.
  const [whenMode, setWhenMode] = React.useState<"now" | "earlier">("now");
  const [fedAtLocal, setFedAtLocal] = React.useState("");

  const orderedFoods = React.useMemo(() => {
    const recent = (catId && recentByCat?.[catId]) || mruFoodIds;
    return orderFoods(foods, recent);
  }, [foods, catId, recentByCat, mruFoodIds]);

  const selectedFood = foods.find((f) => f.id === foodId) ?? null;

  function pickFood(f: Food) {
    setFoodId(f.id);
    setAmount(initialAmount(f));
  }

  function save() {
    if (!catId) {
      toast({ title: strings.feed.pickCat, variant: "destructive" });
      return;
    }
    if (!selectedFood || !amount) {
      toast({ title: strings.feed.pickFood, variant: "destructive" });
      return;
    }
    const grams = resolveGrams(selectedFood, amount);
    if (grams <= 0) {
      toast({
        title: "Enter an amount greater than 0.",
        variant: "destructive",
      });
      return;
    }
    let fedAtIso: string | null = null;
    if (whenMode === "earlier") {
      if (!fedAtLocal) {
        toast({ title: "Pick when it was fed.", variant: "destructive" });
        return;
      }
      const d = new Date(fedAtLocal);
      if (Number.isNaN(d.getTime()) || d.getTime() > Date.now()) {
        toast({ title: "That time is in the future.", variant: "destructive" });
        return;
      }
      fedAtIso = d.toISOString();
    }
    const snap = resolveSnapshot(
      selectedFood,
      amount,
      selectedFood.unit_id ? unitLabel.get(selectedFood.unit_id) ?? null : null,
    );
    startTransition(async () => {
      try {
        const { treatWarning } = await logFeed({
          cat_id: catId,
          food_id: selectedFood.id,
          grams: snap.grams,
          qty: snap.qty,
          unit_label: snap.unit_label,
          fed_at: fedAtIso,
        });
        toast({ title: strings.feed.saved, variant: "success" });
        if (treatWarning) {
          toast({ title: strings.feed.treatToast, variant: "warning" });
        }
        setFoodId("");
        setAmount(null);
        setWhenMode("now");
        setFedAtLocal("");
        onDone?.();
      } catch (err) {
        toast({
          title: err instanceof Error ? err.message : "Something went wrong",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* 1 — Who's eating? */}
      <section className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          {strings.feed.pickCat}
        </p>
        <div className="flex flex-wrap gap-2">
          {cats.map((cat) => {
            const active = cat.id === catId;
            // Tint the selected pill with the cat's accent.
            const activeStyle = {
              ["--cat-accent" as any]: `var(--cat-${cat.accent_index})`,
              backgroundColor: `hsl(var(--cat-${cat.accent_index}) / 0.14)`,
            } as React.CSSProperties;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCatId(cat.id)}
                style={active ? activeStyle : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-medium transition-colors",
                  active
                    ? "border-cat text-foreground"
                    : "border-border text-muted-foreground hover:bg-accent",
                )}
              >
                <CatAvatar cat={cat} size={28} />
                {cat.name}
              </button>
            );
          })}
        </div>
      </section>

      {/* 2 — What? */}
      <section className="space-y-2">
        <p className="text-sm font-medium text-foreground">
          {strings.feed.pickFood}
        </p>
        {foods.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No foods yet. Add one in the Catalog first.
          </p>
        ) : (
          <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
            {orderedFoods.map((food) => {
              const active = food.id === foodId;
              const meta = foodHasUnit(food)
                ? `${round1(Number(food.unit_grams))} g · ${
                    unitLabel.get(food.unit_id as string) ?? "unit"
                  }`
                : food.default_serving_grams != null
                  ? `${food.default_serving_grams} g serving`
                  : "grams";
              return (
                <li key={food.id}>
                  <button
                    type="button"
                    onClick={() => pickFood(food)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      active
                        ? "border-primary bg-accent"
                        : "border-border hover:bg-accent",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-foreground">
                        {food.name}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {round1(Number(food.kcal_per_100g))} kcal/100 g · {meta}
                      </span>
                    </span>
                    {active && (
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 3 — How much? */}
      {selectedFood && amount && (
        <section className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            {strings.feed.amount}
          </p>
          <AmountPicker
            food={selectedFood}
            value={amount}
            onChange={setAmount}
          />

          {/* When? Default now; "Earlier" backdates a forgotten log. */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">When?</p>
            <div className="flex gap-2">
              {(["now", "earlier"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setWhenMode(m);
                    if (m === "earlier" && !fedAtLocal) {
                      setFedAtLocal(defaultLocalDateTime());
                    }
                  }}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
                    whenMode === m
                      ? "border-primary bg-accent text-foreground"
                      : "border-border text-muted-foreground hover:bg-accent",
                  )}
                >
                  {m === "now" ? "Now" : "Earlier…"}
                </button>
              ))}
            </div>
            {whenMode === "earlier" && (
              <Input
                type="datetime-local"
                value={fedAtLocal}
                max={defaultLocalDateTime()}
                onChange={(e) => setFedAtLocal(e.target.value)}
                aria-label="When it was fed"
              />
            )}
          </div>

          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={save}
            disabled={pending}
          >
            {pending ? strings.common.loading : strings.feed.save}
          </Button>
        </section>
      )}
    </div>
  );
}
