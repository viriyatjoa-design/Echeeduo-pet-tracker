"use client";

import * as React from "react";
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
import { adjustStock } from "@/lib/actions/inventory";
import type { InventoryItemView } from "@/lib/inventory-queries";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";

type Reason = "adjustment" | "expired";

const t = {
  trigger: "Adjust",
  title: "Adjust stock",
  desc: "Manual correction or expired/discarded stock.",
  direction: "Direction",
  remove: "Remove",
  add: "Add",
  amount: "Amount",
  reason: "Reason",
  reasonAdjustment: "Correction",
  reasonExpired: "Expired / discarded",
  adjusted: "Stock adjusted",
  wrong: "Something went wrong",
} as const;

/** "Adjust" button + dialog: signed amount (Remove/Add toggle), reason, notes. */
export function AdjustDialog({ item }: { item: InventoryItemView }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const [sign, setSign] = React.useState<"remove" | "add">("remove");
  const [amount, setAmount] = React.useState("");
  const [reason, setReason] = React.useState<Reason>("adjustment");
  const [notes, setNotes] = React.useState("");

  function onOpenChange(next: boolean) {
    if (next) {
      setSign("remove");
      setAmount("");
      setReason("adjustment");
      setNotes("");
    }
    setOpen(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const magnitude = Math.abs(Number(amount));
    startTransition(async () => {
      const res = await adjustStock({
        item_id: item.id,
        delta: sign === "remove" ? -magnitude : magnitude,
        reason,
        notes: notes === "" ? null : notes,
      });
      if (!res.ok) {
        toast({
          title: t.wrong,
          description: res.error,
          variant: "destructive",
        });
        return;
      }
      toast({ title: t.adjusted, variant: "success" });
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onOpenChange(true)}
      >
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
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t.direction}</Label>
              <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
                {(
                  [
                    ["remove", t.remove],
                    ["add", t.add],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setSign(value)}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      sign === value
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground",
                    )}
                    aria-pressed={sign === value}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adjust-amount">
                {t.amount} ({item.unitLabel})
              </Label>
              <Input
                id="adjust-amount"
                type="number"
                inputMode="decimal"
                min="0.1"
                step="0.1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t.reason}</Label>
            <Select
              value={reason}
              onValueChange={(v) => setReason(v as Reason)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="adjustment">{t.reasonAdjustment}</SelectItem>
                <SelectItem value="expired">{t.reasonExpired}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="adjust-notes">
              {strings.common.notes}{" "}
              <span className="text-muted-foreground">
                ({strings.common.optional})
              </span>
            </Label>
            <Textarea
              id="adjust-notes"
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
