"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Droplets, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { WaterQuickAdd } from "@/components/observation/water-quick-add";
import { useToast } from "@/hooks/use-toast";
import { formatTime } from "@/lib/time";
import {
  getTodayWater,
  removeObservation,
  type TodayWaterEntry,
} from "@/lib/actions/observation";
import type { Cat } from "@/lib/types";

const t = {
  today: "ml today",
  title: (name: string) => `Water · ${name}`,
  desc: "Tap an amount to log. Remove a wrong entry below.",
  loggedToday: "Logged today",
  none: "Nothing logged today yet.",
  removed: "Water entry removed",
  removeFailed: "Couldn't remove it",
  remove: "Remove entry",
} as const;

/**
 * The dashboard cat card's water figure, now a button: tap it to log water for
 * this cat (fast presets via WaterQuickAdd) and undo a mis-log from the
 * "logged today" list — all without leaving the home screen.
 */
export function CatWaterButton({
  cat,
  waterMl,
  trigger,
  triggerClassName,
}: {
  cat: Cat;
  waterMl: number;
  /** Custom trigger content (e.g. the water bowl). Falls back to the pill. */
  trigger?: React.ReactNode;
  /** Class for the trigger button when `trigger` is provided. */
  triggerClassName?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [entries, setEntries] = React.useState<TodayWaterEntry[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [removingId, setRemovingId] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setLoading(true);
    try {
      setEntries(await getTodayWater(cat.id));
    } finally {
      setLoading(false);
    }
  }, [cat.id]);

  React.useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  async function remove(id: string) {
    setRemovingId(id);
    try {
      const res = await removeObservation("water", id);
      if (!res.ok) {
        toast({ title: t.removeFailed, description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: t.removed, variant: "success" });
      await refresh();
      router.refresh(); // update the card's total
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          triggerClassName ??
          "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-sm tabular-nums text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        }
        aria-label={`Log water for ${cat.name}`}
      >
        {trigger ?? (
          <>
            <Droplets className="h-4 w-4 text-cat" aria-hidden />
            {waterMl} {t.today}
          </>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.title(cat.name)}</DialogTitle>
            <DialogDescription className="sr-only">{t.desc}</DialogDescription>
          </DialogHeader>

          <WaterQuickAdd cats={[cat]} onLogged={refresh} />

          <div className="space-y-1.5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t.loggedToday}
            </p>
            {loading && entries.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">
                <Loader2 className="inline h-4 w-4 animate-spin" />
              </p>
            ) : entries.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">{t.none}</p>
            ) : (
              <ul className="space-y-1">
                {entries.map((e) => (
                  <li
                    key={e.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border px-3 py-2"
                  >
                    <span className="text-sm text-foreground">
                      <span className="font-semibold tabular-nums">{e.ml} ml</span>{" "}
                      <span className="text-muted-foreground">
                        · {formatTime(e.at)}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(e.id)}
                      disabled={removingId === e.id}
                      aria-label={t.remove}
                      className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    >
                      {removingId === e.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default CatWaterButton;
