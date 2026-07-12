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
import { useToast } from "@/hooks/use-toast";
import { purchaseStock } from "@/lib/actions/inventory";
import type { InventoryItemView } from "@/lib/inventory-queries";
import { strings } from "@/lib/strings";
import { actionErrorMessage } from "@/lib/action-error";

const t = {
  trigger: "Purchase",
  title: "Log a purchase",
  desc: "Adds to stock and counts toward this month's spending.",
  qty: "Amount",
  cost: "Cost per unit (IDR)",
  costHint: "Also becomes the item's latest price.",
  logged: "Purchase logged",
  wrong: "Something went wrong",
} as const;

/** "+ Purchase" button + dialog: qty, unit cost (prefilled), notes. */
export function PurchaseDialog({ item }: { item: InventoryItemView }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const [qty, setQty] = React.useState("");
  const [cost, setCost] = React.useState(
    item.cost_per_unit != null ? String(item.cost_per_unit) : "",
  );
  const [notes, setNotes] = React.useState("");

  function onOpenChange(next: boolean) {
    if (next) {
      setQty("");
      setCost(item.cost_per_unit != null ? String(item.cost_per_unit) : "");
      setNotes("");
    }
    setOpen(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await purchaseStock({
          item_id: item.id,
          qty: Number(qty),
          unit_cost: cost === "" ? null : Number(cost),
          notes: notes === "" ? null : notes,
        });
        toast({ title: t.logged, variant: "success" });
        setOpen(false);
      } catch (err) {
        toast({
          title: actionErrorMessage(err, t.wrong),
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button type="button" size="sm" onClick={() => onOpenChange(true)}>
        <Plus className="h-4 w-4" />
        {t.trigger}
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>
            {item.name} — {t.desc}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="purchase-qty">
              {t.qty} ({item.unitLabel})
            </Label>
            <Input
              id="purchase-qty"
              type="number"
              inputMode="decimal"
              min="0.1"
              step="0.1"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="purchase-cost">
              {t.cost}{" "}
              <span className="text-muted-foreground">
                ({strings.common.optional})
              </span>
            </Label>
            <Input
              id="purchase-cost"
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">{t.costHint}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="purchase-notes">
              {strings.common.notes}{" "}
              <span className="text-muted-foreground">
                ({strings.common.optional})
              </span>
            </Label>
            <Textarea
              id="purchase-notes"
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
