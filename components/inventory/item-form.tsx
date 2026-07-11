"use client";

import * as React from "react";
import { Plus } from "lucide-react";
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
import { createItem, updateItem } from "@/lib/actions/inventory";
import type { InventoryItem, Lookup } from "@/lib/types";
import { strings } from "@/lib/strings";

const NO_FOOD = "__none__";

const t = {
  newItem: "New item",
  editItem: "Edit item",
  newDesc: "Track a supply — food, litter, medicine — and its stock level.",
  editDesc: "Stock level changes go through Purchase or Adjust, not here.",
  name: "Name",
  namePh: "e.g. Royal Canin 2 kg bag",
  type: "Type",
  typePh: "Pick a type",
  unit: "Unit",
  unitPh: "Pick a unit",
  food: "Linked food",
  foodNone: "None",
  foodHint: "Feeds of a linked food use up this item's stock automatically.",
  quantity: "Initial quantity",
  quantityHint: "Logged as opening stock.",
  cost: "Cost per unit (IDR)",
  costPh: "e.g. 250",
  reorder: "Alert when ≤ N days left",
  reorderPh: "e.g. 7",
  expiry: "Expiry date",
  saved: "Item updated",
  added: "Item added",
  wrong: "Something went wrong",
} as const;

export type FoodOption = { id: string; name: string; brand: string | null };

/**
 * Create/edit dialog for an inventory item. Self-contained (renders its own
 * trigger) by default; pass `open`/`onOpenChange` to control it externally
 * (the overflow menu does this for Edit). Edit mode never touches `quantity`
 * — stock changes go through purchase/adjust so the ledger stays true.
 */
export function ItemForm({
  types,
  units,
  foods,
  item,
  open: controlledOpen,
  onOpenChange,
}: {
  types: Lookup[];
  units: Lookup[];
  foods: FoodOption[];
  item?: InventoryItem;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = !!item;
  const controlled = controlledOpen !== undefined;
  const { toast } = useToast();
  const [internalOpen, setInternalOpen] = React.useState(false);
  const open = controlled ? controlledOpen : internalOpen;
  const [pending, startTransition] = React.useTransition();

  const [name, setName] = React.useState(item?.name ?? "");
  const [typeId, setTypeId] = React.useState(item?.item_type_id ?? "");
  const [unitId, setUnitId] = React.useState(item?.unit_id ?? "");
  const [foodId, setFoodId] = React.useState(item?.food_id ?? NO_FOOD);
  const [quantity, setQuantity] = React.useState("");
  const [cost, setCost] = React.useState(
    item?.cost_per_unit != null ? String(item.cost_per_unit) : "",
  );
  const [reorder, setReorder] = React.useState(
    item?.reorder_days != null ? String(item.reorder_days) : "",
  );
  const [expiry, setExpiry] = React.useState(item?.expiry ?? "");
  const [notes, setNotes] = React.useState(item?.notes ?? "");

  // Fresh fields every time the dialog opens (also covers controlled opens).
  React.useEffect(() => {
    if (!open) return;
    setName(item?.name ?? "");
    setTypeId(item?.item_type_id ?? "");
    setUnitId(item?.unit_id ?? "");
    setFoodId(item?.food_id ?? NO_FOOD);
    setQuantity("");
    setCost(item?.cost_per_unit != null ? String(item.cost_per_unit) : "");
    setReorder(item?.reorder_days != null ? String(item.reorder_days) : "");
    setExpiry(item?.expiry ?? "");
    setNotes(item?.notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function setOpen(next: boolean) {
    if (controlled) onOpenChange?.(next);
    else setInternalOpen(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const shared = {
      name,
      item_type_id: typeId,
      unit_id: unitId,
      food_id: foodId === NO_FOOD ? null : foodId,
      cost_per_unit: cost === "" ? null : Number(cost),
      reorder_days: reorder === "" ? null : Number(reorder),
      expiry: expiry === "" ? null : expiry,
      notes: notes === "" ? null : notes,
    };
    startTransition(async () => {
      try {
        if (isEdit) {
          await updateItem(item!.id, shared); // no quantity — see docstring
        } else {
          await createItem({
            ...shared,
            quantity: quantity === "" ? null : Number(quantity),
          });
        }
        toast({ title: isEdit ? t.saved : t.added, variant: "success" });
        setOpen(false);
      } catch (err) {
        toast({
          title: err instanceof Error ? err.message : t.wrong,
          variant: "destructive",
        });
      }
    });
  }

  const optional = (
    <span className="text-muted-foreground">({strings.common.optional})</span>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!controlled && (
        <Button type="button" onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" />
          {t.newItem}
        </Button>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t.editItem : t.newItem}</DialogTitle>
          <DialogDescription>
            {isEdit ? t.editDesc : t.newDesc}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="item-name">{t.name}</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePh}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.type}</Label>
              <Select value={typeId} onValueChange={setTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder={t.typePh} />
                </SelectTrigger>
                <SelectContent>
                  {types.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t.unit}</Label>
              <Select value={unitId} onValueChange={setUnitId}>
                <SelectTrigger>
                  <SelectValue placeholder={t.unitPh} />
                </SelectTrigger>
                <SelectContent>
                  {units.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              {t.food} {optional}
            </Label>
            <Select value={foodId} onValueChange={setFoodId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_FOOD}>{t.foodNone}</SelectItem>
                {foods.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.brand ? `${f.name} · ${f.brand}` : f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t.foodHint}</p>
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label htmlFor="item-qty">
                {t.quantity} {optional}
              </Label>
              <Input
                id="item-qty"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">{t.quantityHint}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-cost">
                {t.cost} {optional}
              </Label>
              <Input
                id="item-cost"
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder={t.costPh}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-reorder">
                {t.reorder} {optional}
              </Label>
              <Input
                id="item-reorder"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={reorder}
                onChange={(e) => setReorder(e.target.value)}
                placeholder={t.reorderPh}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-expiry">
              {t.expiry} {optional}
            </Label>
            <Input
              id="item-expiry"
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="item-notes">
              {strings.common.notes} {optional}
            </Label>
            <Textarea
              id="item-notes"
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
            <Button type="submit" disabled={pending}>
              {pending ? strings.common.loading : strings.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
