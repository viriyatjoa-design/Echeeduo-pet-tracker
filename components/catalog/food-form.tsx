"use client";

import * as React from "react";
import { Plus, Pencil, Camera, Loader2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createFood, updateFood, type FoodInput } from "@/lib/actions/foods";
import { scanFoodLabel } from "@/lib/actions/ai";
import { compressImage } from "@/components/attachments/image-compress";
import type { Food, Lookup } from "@/lib/types";
import { strings } from "@/lib/strings";

const NO_UNIT = "__none__";

const t = {
  addFood: "Add food",
  editFood: "Edit food",
  newFoodDesc: "Add a food to the catalog with its calories and optional unit.",
  name: "Name",
  namePh: "e.g. British Shorthair Adult",
  brand: "Brand",
  brandPh: "e.g. Royal Canin",
  type: "Type",
  typePh: "Pick a food type",
  kcal: "Calories per 100 g",
  unit: "Unit",
  gramsOnly: "Grams only",
  unitGrams: "Grams per unit",
  unitGramsHint: "e.g. 85 for one can",
  defaultServing: "Default serving (g)",
  scanLabel: "Scan label",
  scanning: "Reading label…",
  scanEmpty: "Couldn't read the label — enter it manually.",
  scanFound: "Found:",
  scanPickUnit: "Pick the unit type (can/pouch/…).",
  scanError: "Couldn't scan the label. Try again.",
} as const;

export function FoodForm({
  foodTypes,
  foodUnits,
  food,
  aiReady = false,
}: {
  foodTypes: Lookup[];
  foodUnits: Lookup[];
  food?: Food;
  aiReady?: boolean;
}) {
  const isEdit = !!food;
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const [name, setName] = React.useState(food?.name ?? "");
  const [brand, setBrand] = React.useState(food?.brand ?? "");
  const [foodTypeId, setFoodTypeId] = React.useState(food?.food_type_id ?? "");
  const [kcal, setKcal] = React.useState(
    food?.kcal_per_100g != null ? String(food.kcal_per_100g) : "",
  );
  const [unitId, setUnitId] = React.useState(food?.unit_id ?? NO_UNIT);
  const [unitGrams, setUnitGrams] = React.useState(
    food?.unit_grams != null ? String(food.unit_grams) : "",
  );
  const [defaultServing, setDefaultServing] = React.useState(
    food?.default_serving_grams != null
      ? String(food.default_serving_grams)
      : "",
  );
  const [notes, setNotes] = React.useState(food?.notes ?? "");

  const [scanning, setScanning] = React.useState(false);
  const scanInputRef = React.useRef<HTMLInputElement>(null);

  const hasUnit = unitId !== NO_UNIT;

  async function onScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setScanning(true);
    try {
      const compressed = await compressImage(picked, 1600, 0.82);
      const fd = new FormData();
      fd.append("file", compressed);
      const scanned = await scanFoodLabel(fd);

      if (
        scanned.name == null &&
        scanned.brand == null &&
        scanned.kcal_per_100g == null &&
        scanned.unit_grams == null
      ) {
        toast({
          title: t.scanEmpty,
          description: scanned.note ?? undefined,
          variant: "warning",
        });
        return;
      }

      // Prefill only fields the user hasn't typed into (functional setters so
      // anything typed while the scan ran is never overwritten).
      if (scanned.name) {
        setName((cur) => (cur.trim() === "" ? scanned.name! : cur));
      }
      if (scanned.brand) {
        setBrand((cur) => (cur.trim() === "" ? scanned.brand! : cur));
      }
      if (scanned.kcal_per_100g != null) {
        setKcal((cur) =>
          cur.trim() === "" ? String(scanned.kcal_per_100g) : cur,
        );
      }
      if (scanned.unit_grams != null) {
        setUnitGrams((cur) =>
          cur.trim() === "" ? String(scanned.unit_grams) : cur,
        );
      }

      const parts: string[] = [];
      if (scanned.brand) parts.push(scanned.brand);
      if (scanned.name) parts.push(scanned.name);
      if (scanned.kcal_per_100g != null)
        parts.push(`${scanned.kcal_per_100g} kcal/100g`);
      if (scanned.unit_grams != null)
        parts.push(`${scanned.unit_grams} g per unit`);

      const descriptionBits: string[] = [];
      if (scanned.note) descriptionBits.push(scanned.note);
      if (scanned.unit_grams != null && unitId === NO_UNIT) {
        descriptionBits.push(t.scanPickUnit);
      }

      toast({
        title: `${t.scanFound} ${parts.join(" · ")}`,
        description:
          descriptionBits.length > 0 ? descriptionBits.join(" ") : undefined,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : t.scanError,
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  }

  function reset() {
    setName(food?.name ?? "");
    setBrand(food?.brand ?? "");
    setFoodTypeId(food?.food_type_id ?? "");
    setKcal(food?.kcal_per_100g != null ? String(food.kcal_per_100g) : "");
    setUnitId(food?.unit_id ?? NO_UNIT);
    setUnitGrams(food?.unit_grams != null ? String(food.unit_grams) : "");
    setDefaultServing(
      food?.default_serving_grams != null
        ? String(food.default_serving_grams)
        : "",
    );
    setNotes(food?.notes ?? "");
  }

  function onOpenChange(next: boolean) {
    if (next) reset();
    setOpen(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const input: FoodInput = {
      name,
      brand,
      food_type_id: foodTypeId,
      kcal_per_100g: Number(kcal),
      unit_id: hasUnit ? unitId : null,
      unit_grams: hasUnit ? Number(unitGrams) : null,
      default_serving_grams: defaultServing === "" ? null : Number(defaultServing),
      notes,
    };
    startTransition(async () => {
      try {
        if (isEdit) await updateFood(food!.id, input);
        else await createFood(input);
        toast({
          title: isEdit ? "Food updated" : "Food added",
          variant: "success",
        });
        setOpen(false);
      } catch (err) {
        toast({
          title: err instanceof Error ? err.message : "Something went wrong",
          variant: "destructive",
        });
      }
    });
  }

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
        <Button type="button" onClick={() => onOpenChange(true)}>
          <Plus className="h-4 w-4" />
          {t.addFood}
        </Button>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t.editFood : t.addFood}</DialogTitle>
          <DialogDescription>{t.newFoodDesc}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {aiReady && (
            <>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={scanning}
                onClick={() => scanInputRef.current?.click()}
              >
                {scanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
                {scanning ? t.scanning : t.scanLabel}
              </Button>
              <input
                ref={scanInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onScanFile}
              />
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="food-name">{t.name}</Label>
            <Input
              id="food-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePh}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="food-brand">
              {t.brand}{" "}
              <span className="text-muted-foreground">
                ({strings.common.optional})
              </span>
            </Label>
            <Input
              id="food-brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder={t.brandPh}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t.type}</Label>
            <Select value={foodTypeId} onValueChange={setFoodTypeId}>
              <SelectTrigger>
                <SelectValue placeholder={t.typePh} />
              </SelectTrigger>
              <SelectContent>
                {foodTypes.map((ft) => (
                  <SelectItem key={ft.id} value={ft.id}>
                    {ft.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="food-kcal">{t.kcal}</Label>
            <Input
              id="food-kcal"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.1"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.unit}</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_UNIT}>{t.gramsOnly}</SelectItem>
                  {foodUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="food-unit-grams">{t.unitGrams}</Label>
              <Input
                id="food-unit-grams"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={unitGrams}
                onChange={(e) => setUnitGrams(e.target.value)}
                placeholder={t.unitGramsHint}
                disabled={!hasUnit}
                required={hasUnit}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="food-serving">
              {t.defaultServing}{" "}
              <span className="text-muted-foreground">
                ({strings.common.optional})
              </span>
            </Label>
            <Input
              id="food-serving"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={defaultServing}
              onChange={(e) => setDefaultServing(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="food-notes">
              {strings.common.notes}{" "}
              <span className="text-muted-foreground">
                ({strings.common.optional})
              </span>
            </Label>
            <Textarea
              id="food-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                {strings.common.cancel}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending || !foodTypeId}>
              {pending ? strings.common.loading : strings.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
