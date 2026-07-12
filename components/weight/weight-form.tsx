"use client";

import * as React from "react";
import { Scale } from "lucide-react";
import {
  Dialog,
  DialogTrigger,
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
import { logWeight } from "@/lib/actions/weight";
import { todayInTz } from "@/lib/time";
import { strings } from "@/lib/strings";
import type { UUID } from "@/lib/types";
import { actionErrorMessage } from "@/lib/action-error";

const NO_BCS = "__none__";
const BCS_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const t = {
  title: "Log weight",
  desc: "Record a new weight and (optionally) a body condition score.",
  weight: "Weight",
  kg: "kg",
  bcs: "Body condition score",
  bcsHint: "1 emaciated · 5 ideal · 9 obese",
  date: "Measured on",
  saved: "Weight logged",
  invalid: "Enter a weight greater than 0.",
} as const;

/**
 * Weight/BCS logging dialog (SPEC §6.3, §7). Weight is entered in kg and stored
 * as grams (§2.9). `trigger` lets the same dialog mount on the cat profile and
 * in the dashboard quick-log FAB; without one it renders its own button. Pass
 * `open`/`onOpenChange` to control it externally (no trigger is rendered then)
 * — internal state is the uncontrolled fallback.
 */
export function WeightForm({
  catId,
  catName,
  trigger,
  open,
  onOpenChange,
}: {
  catId: UUID;
  catName?: string;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const controlled = open !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = controlled ? open! : internalOpen;
  const [pending, startTransition] = React.useTransition();

  const [kg, setKg] = React.useState("");
  const [bcs, setBcs] = React.useState<string>(NO_BCS);
  const [measuredAt, setMeasuredAt] = React.useState(() => todayInTz());
  const [notes, setNotes] = React.useState("");

  // Reset fields whenever the dialog opens (covers both trigger + controlled).
  React.useEffect(() => {
    if (!isOpen) return;
    setKg("");
    setBcs(NO_BCS);
    setMeasuredAt(todayInTz());
    setNotes("");
  }, [isOpen]);

  function setOpen(next: boolean) {
    if (controlled) onOpenChange?.(next);
    else setInternalOpen(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const kgNum = Number(kg);
    if (!Number.isFinite(kgNum) || kgNum <= 0) {
      toast({ title: t.invalid, variant: "destructive" });
      return;
    }
    startTransition(async () => {
      try {
        await logWeight({
          cat_id: catId,
          weight_grams: Math.round(kgNum * 1000),
          bcs: bcs === NO_BCS ? null : Number(bcs),
          measured_at: measuredAt,
          notes,
        });
        toast({ title: t.saved, variant: "success" });
        setOpen(false);
      } catch (err) {
        toast({
          title: actionErrorMessage(err, "Something went wrong"),
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {!controlled && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button type="button">
              <Scale className="h-4 w-4" />
              {t.title}
            </Button>
          )}
        </DialogTrigger>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t.title}
            {catName ? ` · ${catName}` : ""}
          </DialogTitle>
          <DialogDescription>{t.desc}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="weight-kg">{t.weight}</Label>
            <div className="relative">
              <Input
                id="weight-kg"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={kg}
                onChange={(e) => setKg(e.target.value)}
                placeholder="4.55"
                className="pr-10"
                required
                autoFocus
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                {t.kg}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>
              {t.bcs}{" "}
              <span className="text-muted-foreground">
                ({strings.common.optional})
              </span>
            </Label>
            <Select value={bcs} onValueChange={setBcs}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_BCS}>{strings.common.none}</SelectItem>
                {BCS_SCORES.map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t.bcsHint}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="weight-date">{t.date}</Label>
            <Input
              id="weight-date"
              type="date"
              value={measuredAt}
              max={todayInTz()}
              onChange={(e) => setMeasuredAt(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="weight-notes">
              {strings.common.notes}{" "}
              <span className="text-muted-foreground">
                ({strings.common.optional})
              </span>
            </Label>
            <Textarea
              id="weight-notes"
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
