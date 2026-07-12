"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { strings } from "@/lib/strings";
import { CatAvatar } from "@/components/cats/cat-avatar";
import { applyMealTemplate } from "@/lib/actions/feeding";
import type { Cat, Food, Lookup, MealTemplate, MealTemplateItem } from "@/lib/types";
import {
  AmountPicker,
  foodHasUnit,
  initialAmount,
  resolveGrams,
  resolveSnapshot,
  type AmountValue,
} from "./amount-picker";
import { actionErrorMessage } from "@/lib/action-error";

/** Data the feed-all flow needs — fetched by the Server Component parent. */
export type FeedAllData = {
  templates: MealTemplate[];
  items: MealTemplateItem[];
  cats: Cat[];
  foods: Food[];
  foodUnits: Lookup[];
};

const t = {
  pickTemplate: "Which meal?",
  review: "Review & adjust",
  noTemplates: "No meal templates yet. Create one in the Catalog.",
  emptyTemplate: "This template has no cats yet. Add items in the Catalog.",
  skip: "Skip",
  include: "Include",
  skipped: "Skipped",
  apply: "Log feeds",
  applied: (n: number) => `Logged ${n} ${n === 1 ? "feed" : "feeds"}`,
  food: "Food",
} as const;

type Row = {
  catId: string;
  foodId: string;
  amount: AmountValue;
  skip: boolean;
};

/** Local 'YYYY-MM-DDTHH:mm' for datetime-local defaults/max (phone timezone). */
function defaultLocalDateTime(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function FeedAllForm({
  templates,
  items,
  cats,
  foods,
  foodUnits,
  onDone,
}: FeedAllData & { onDone?: () => void }) {
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const foodById = React.useMemo(
    () => new Map(foods.map((f) => [f.id, f])),
    [foods],
  );
  const catById = React.useMemo(
    () => new Map(cats.map((c) => [c.id, c])),
    [cats],
  );
  const unitLabel = React.useMemo(
    () => new Map(foodUnits.map((u) => [u.id, u.label])),
    [foodUnits],
  );
  const itemsByTemplate = React.useMemo(() => {
    const m = new Map<string, MealTemplateItem[]>();
    for (const it of items) {
      const list = m.get(it.template_id);
      if (list) list.push(it);
      else m.set(it.template_id, [it]);
    }
    return m;
  }, [items]);

  const buildRows = React.useCallback(
    (templateId: string): Row[] => {
      const its = itemsByTemplate.get(templateId) ?? [];
      return its
        .filter((it) => catById.has(it.cat_id) && foodById.has(it.food_id))
        .map((it) => {
          const food = foodById.get(it.food_id)!;
          let amount = initialAmount(food);
          if (it.qty != null && foodHasUnit(food)) {
            amount = { mode: "portion", qty: String(it.qty), grams: amount.grams };
          } else if (it.grams != null) {
            amount = { mode: "grams", qty: "1", grams: String(it.grams) };
          } else if (it.qty != null) {
            // Template stored a portion but the food no longer has a unit —
            // the portion can't resolve to grams. Leave the amount empty so
            // the save validation forces an explicit entry instead of
            // silently substituting the default serving.
            amount = { mode: "grams", qty: "1", grams: "" };
          }
          return { catId: it.cat_id, foodId: it.food_id, amount, skip: false };
        })
        .sort((a, b) =>
          (catById.get(a.catId)?.name ?? "").localeCompare(
            catById.get(b.catId)?.name ?? "",
          ),
        );
    },
    [itemsByTemplate, catById, foodById],
  );

  const [templateId, setTemplateId] = React.useState(
    templates[0]?.id ?? "",
  );
  // When was the meal fed? Default now; "earlier" backdates a forgotten meal.
  const [whenMode, setWhenMode] = React.useState<"now" | "earlier">("now");
  const [fedAtLocal, setFedAtLocal] = React.useState("");
  const [rows, setRows] = React.useState<Row[]>(() =>
    templates[0] ? buildRows(templates[0].id) : [],
  );

  function selectTemplate(id: string) {
    setTemplateId(id);
    setRows(buildRows(id));
  }

  function patchRow(idx: number, patch: Partial<Row>) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  }

  function swapFood(idx: number, foodId: string) {
    const food = foodById.get(foodId);
    patchRow(idx, {
      foodId,
      amount: food ? initialAmount(food) : rows[idx].amount,
    });
  }

  function apply() {
    const included = rows.filter((r) => !r.skip);
    if (included.length === 0) {
      toast({
        title: "Every cat is skipped — nothing to log.",
        variant: "destructive",
      });
      return;
    }
    const payload = included.map((r) => {
      const food = foodById.get(r.foodId)!;
      const snap = resolveSnapshot(
        food,
        r.amount,
        food.unit_id ? unitLabel.get(food.unit_id) ?? null : null,
      );
      return {
        cat_id: r.catId,
        food_id: r.foodId,
        grams: snap.grams,
        qty: snap.qty,
        unit_label: snap.unit_label,
      };
    });

    if (payload.some((p) => p.grams <= 0)) {
      toast({
        title: "Every included cat needs an amount greater than 0.",
        variant: "destructive",
      });
      return;
    }

    let fedAtIso: string | null = null;
    if (whenMode === "earlier") {
      if (!fedAtLocal) {
        toast({ title: "Pick when the meal was fed.", variant: "destructive" });
        return;
      }
      const d = new Date(fedAtLocal);
      if (Number.isNaN(d.getTime()) || d.getTime() > Date.now()) {
        toast({ title: "That time is in the future.", variant: "destructive" });
        return;
      }
      fedAtIso = d.toISOString();
    }

    startTransition(async () => {
      try {
        const { count, treatWarningCats } = await applyMealTemplate({
          template_id: templateId,
          fed_at: fedAtIso,
          rows: payload,
        });
        toast({ title: t.applied(count), variant: "success" });
        if (treatWarningCats.length > 0) {
          toast({
            title: strings.feed.treatToast,
            description: treatWarningCats.join(", "),
            variant: "warning",
          });
        }
        onDone?.();
      } catch (err) {
        toast({
          title: actionErrorMessage(err, "Something went wrong"),
          variant: "destructive",
        });
      }
    });
  }

  if (templates.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
        {t.noTemplates}
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <p className="text-sm font-medium text-foreground">{t.pickTemplate}</p>
        <Select value={templateId} onValueChange={selectTemplate}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {templates.map((tpl) => (
              <SelectItem key={tpl.id} value={tpl.id}>
                {tpl.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </section>

      <section className="space-y-3">
        <p className="text-sm font-medium text-foreground">{t.review}</p>

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            {t.emptyTemplate}
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row, idx) => {
              const cat = catById.get(row.catId);
              const food = foodById.get(row.foodId);
              return (
                <li
                  key={row.catId}
                  className={cn(
                    "rounded-2xl border border-border p-3",
                    row.skip && "opacity-60",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {cat && <CatAvatar cat={cat} size={32} />}
                      <span className="truncate font-medium text-foreground">
                        {cat?.name ?? "—"}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant={row.skip ? "outline" : "ghost"}
                      size="sm"
                      onClick={() => patchRow(idx, { skip: !row.skip })}
                    >
                      {row.skip ? t.include : t.skip}
                    </Button>
                  </div>

                  {!row.skip && (
                    <div className="mt-3 space-y-3">
                      <div className="space-y-1.5">
                        <span className="text-xs font-medium text-muted-foreground">
                          {t.food}
                        </span>
                        <Select
                          value={row.foodId}
                          onValueChange={(v) => swapFood(idx, v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {foods.map((f) => (
                              <SelectItem key={f.id} value={f.id}>
                                {f.brand ? `${f.name} · ${f.brand}` : f.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {food && (
                        <AmountPicker
                          food={food}
                          value={row.amount}
                          onChange={(a) => patchRow(idx, { amount: a })}
                          compact
                        />
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* When? Default now; "Earlier" backdates a forgotten meal. */}
      <section className="space-y-2">
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
            aria-label="When the meal was fed"
          />
        )}
      </section>

      <Button
        type="button"
        size="lg"
        className="w-full"
        onClick={apply}
        disabled={pending || rows.length === 0}
      >
        {pending ? strings.common.loading : t.apply}
      </Button>
    </div>
  );
}

/** Grams for a row's current amount (exported for callers that preview totals). */
export function rowGrams(food: Food, amount: AmountValue): number {
  return resolveGrams(food, amount);
}
