"use client";

import * as React from "react";
import { Plus, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  upsertTemplateItem,
  type TemplateItemInput,
} from "@/lib/actions/meal-templates";
import { gramsFromPortion, kcalFromGrams, round1 } from "@/lib/kcal";
import type { Cat, Food, MealTemplateItem } from "@/lib/types";
import { strings } from "@/lib/strings";
import { actionErrorMessage } from "@/lib/action-error";

const PORTIONS: { value: number; label: string }[] = [
  { value: 0.25, label: "¼" },
  { value: 0.33, label: "⅓" },
  { value: 0.5, label: "½" },
  { value: 1, label: "1" },
  { value: 1.5, label: "1½" },
  { value: 2, label: "2" },
];

const t = {
  addItem: "Add cat",
  editItem: "Edit item",
  desc: "One item per cat: pick the cat, the food, and how much.",
  cat: "Cat",
  catPh: "Pick a cat",
  food: "Food",
  foodPh: "Pick a food",
  portion: "Portion",
  grams: "Grams",
  custom: "Custom",
  preview: "≈",
} as const;

export function TemplateItemForm({
  templateId,
  cats,
  foods,
  item,
  usedCatIds = [],
}: {
  templateId: string;
  cats: Cat[];
  foods: Food[];
  item?: MealTemplateItem;
  /** cats already having an item on this template (excluded when adding) */
  usedCatIds?: string[];
}) {
  const isEdit = !!item;
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const [catId, setCatId] = React.useState(item?.cat_id ?? "");
  const [foodId, setFoodId] = React.useState(item?.food_id ?? "");
  const [qty, setQty] = React.useState(item?.qty != null ? String(item.qty) : "1");
  const [grams, setGrams] = React.useState(
    item?.grams != null ? String(item.grams) : "",
  );

  const selectedFood = foods.find((f) => f.id === foodId) ?? null;
  const hasUnit = !!(selectedFood?.unit_id && selectedFood?.unit_grams);

  function reset() {
    setCatId(item?.cat_id ?? "");
    setFoodId(item?.food_id ?? "");
    setQty(item?.qty != null ? String(item.qty) : "1");
    setGrams(item?.grams != null ? String(item.grams) : "");
  }

  function onOpenChange(next: boolean) {
    if (next) reset();
    setOpen(next);
  }

  function onFoodChange(id: string) {
    setFoodId(id);
    const f = foods.find((x) => x.id === id);
    if (f?.unit_id && f.unit_grams) {
      if (!qty) setQty("1");
    } else {
      // grams-only food: prefill with its default serving if we have nothing yet
      if (!grams && f?.default_serving_grams)
        setGrams(String(f.default_serving_grams));
    }
  }

  // Live grams + kcal preview.
  let previewGrams: number | null = null;
  if (selectedFood) {
    if (hasUnit) {
      const q = Number(qty);
      if (Number.isFinite(q) && q > 0 && selectedFood.unit_grams)
        previewGrams = gramsFromPortion(q, selectedFood.unit_grams);
    } else {
      const g = Number(grams);
      if (Number.isFinite(g) && g > 0) previewGrams = round1(g);
    }
  }
  const previewKcal =
    selectedFood && previewGrams != null
      ? kcalFromGrams(previewGrams, selectedFood.kcal_per_100g)
      : null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input: TemplateItemInput = {
      id: item?.id,
      template_id: templateId,
      cat_id: catId,
      food_id: foodId,
      // Exactly one of qty / grams, chosen by whether the food has a unit.
      qty: hasUnit ? Number(qty) : null,
      grams: hasUnit ? null : Number(grams),
    };
    startTransition(async () => {
      try {
        await upsertTemplateItem(input);
        toast({ title: isEdit ? "Item updated" : "Item added", variant: "success" });
        setOpen(false);
      } catch (err) {
        toast({
          title: actionErrorMessage(err, "Something went wrong"),
          variant: "destructive",
        });
      }
    });
  }

  // When adding, hide cats that already have an item; when editing keep the
  // current cat selectable.
  const catOptions = cats.filter(
    (c) => c.id === item?.cat_id || !usedCatIds.includes(c.id),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {isEdit ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(true)}
        >
          <Pencil className="h-4 w-4" />
          {strings.common.edit}
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(true)}
        >
          <Plus className="h-4 w-4" />
          {t.addItem}
        </Button>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t.editItem : t.addItem}</DialogTitle>
          <DialogDescription className="sr-only">{t.desc}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.cat}</Label>
            <Select value={catId} onValueChange={setCatId} disabled={isEdit}>
              <SelectTrigger>
                <SelectValue placeholder={t.catPh} />
              </SelectTrigger>
              <SelectContent>
                {catOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t.food}</Label>
            <Select value={foodId} onValueChange={onFoodChange}>
              <SelectTrigger>
                <SelectValue placeholder={t.foodPh} />
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

          {selectedFood && hasUnit && (
            <div className="space-y-1.5">
              <Label>{t.portion}</Label>
              <div className="flex flex-wrap gap-2">
                {PORTIONS.map((p) => (
                  <Button
                    key={p.value}
                    type="button"
                    size="pill"
                    variant={Number(qty) === p.value ? "default" : "outline"}
                    onClick={() => setQty(String(p.value))}
                  >
                    {p.label}
                  </Button>
                ))}
              </div>
              <Input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder={t.custom}
              />
            </div>
          )}

          {selectedFood && !hasUnit && (
            <div className="space-y-1.5">
              <Label htmlFor="item-grams">{t.grams}</Label>
              <Input
                id="item-grams"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={grams}
                onChange={(e) => setGrams(e.target.value)}
                required
              />
            </div>
          )}

          {previewKcal != null && previewGrams != null && (
            <p className="text-sm text-muted-foreground">
              {t.preview} {previewGrams} g · {previewKcal} {strings.today.kcal}
            </p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                {strings.common.cancel}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending || !selectedFood || !catId}>
              {pending ? strings.common.loading : strings.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
