"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Droplets, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { logWater } from "@/lib/actions/observation";
import type { Cat } from "@/lib/types";

const t = {
  water: "Water",
  pickCat: "Which cat?",
  addMl: (ml: number) => `+${ml}`,
  ml: "ml",
  custom: "Custom ml",
  add: "Add",
  saved: (ml: number, name: string) => `+${ml} ml logged for ${name}`,
  error: "Couldn't log water",
  noCat: "Pick a cat first.",
  invalid: "Enter ml greater than 0",
} as const;

const PRESETS = [25, 50, 100] as const;

export type WaterQuickAddProps = {
  /** Cats to choose from. Pass a single cat to lock to it (dashboard card). */
  cats: Cat[];
  /** Preselect a cat in multi-cat mode. */
  catId?: string;
  className?: string;
};

/**
 * Per-cat water quick-add: +25 / +50 / +100 ml chips + a custom amount (SPEC
 * §6.5). No daily-target math. Works standalone in the FAB (pass all cats) or on
 * a dashboard card (pass a single cat).
 */
export function WaterQuickAdd({ cats, catId, className }: WaterQuickAddProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  // Which preset chip is in flight — so only that chip shows a spinner.
  const [pendingPreset, setPendingPreset] = React.useState<number | null>(null);
  const [selected, setSelected] = React.useState<string>(
    catId ?? cats[0]?.id ?? "",
  );
  const [custom, setCustom] = React.useState("");

  const lockCat = cats.length === 1;
  const activeCat = cats.find((c) => c.id === selected) ?? cats[0];

  function submit(ml: number, preset?: number) {
    if (!selected) {
      toast({ title: t.noCat, variant: "warning" });
      return;
    }
    const name = activeCat?.name ?? "cat";
    setPendingPreset(preset ?? null);
    startTransition(async () => {
      try {
        const res = await logWater({ cat_id: selected, ml });
        if (!res.ok) {
          toast({
            title: t.error,
            description: res.error || undefined,
            variant: "destructive",
          });
          return;
        }
        toast({ title: t.saved(ml, name), variant: "success" });
        setCustom("");
        router.refresh();
      } finally {
        setPendingPreset(null);
      }
    });
  }

  function submitCustom(e: React.FormEvent) {
    e.preventDefault();
    const ml = Math.round(Number(custom));
    if (!Number.isFinite(ml) || ml <= 0) {
      toast({ title: t.invalid, variant: "destructive" });
      return;
    }
    submit(ml);
  }

  return (
    <div className={cn("space-y-3", className)}>
      {!lockCat && (
        <Select value={selected} onValueChange={setSelected}>
          <SelectTrigger>
            <SelectValue placeholder={t.pickCat} />
          </SelectTrigger>
          <SelectContent>
            {cats.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Droplets className="h-4 w-4 text-muted-foreground" aria-hidden />
        {PRESETS.map((ml) => (
          <Button
            key={ml}
            type="button"
            variant="secondary"
            size="pill"
            disabled={pending || !selected}
            onClick={() => submit(ml, ml)}
          >
            {pendingPreset === ml ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                {t.addMl(ml)} {t.ml}
              </>
            )}
          </Button>
        ))}
      </div>

      <form onSubmit={submitCustom} className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min="1"
          step="1"
          placeholder={t.custom}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="max-w-[9rem]"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={pending || !selected || custom.trim() === ""}
        >
          <Plus className="h-4 w-4" />
          {t.add}
        </Button>
      </form>
    </div>
  );
}

export default WaterQuickAdd;
