"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { InventoryItemView, StockMovementView } from "@/lib/inventory-queries";
import { getItemMovementsAction } from "@/lib/actions/inventory";
import { formatIdr, formatQty } from "./format";

const t = {
  title: "Stock history",
  empty: "No movements yet.",
  error: "Couldn't load history.",
} as const;

/**
 * Controlled dialog listing an item's recent stock movements (newest first).
 * Fetched on open via a read action — the page doesn't prefetch per item.
 */
export function ItemHistory({
  item,
  open,
  onOpenChange,
}: {
  item: InventoryItemView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [movements, setMovements] = React.useState<StockMovementView[] | null>(
    null,
  );
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setFailed(false);
    setMovements(null); // don't flash the previous open's list while refetching
    getItemMovementsAction(item.id)
      .then((rows) => {
        if (!cancelled) setMovements(rows);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, item.id]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{item.name}</DialogDescription>
        </DialogHeader>

        {failed ? (
          <p className="py-4 text-center text-sm text-destructive">
            {t.error}
          </p>
        ) : movements === null ? (
          <div className="space-y-2 py-2">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ) : movements.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            {t.empty}
          </p>
        ) : (
          <ul className="max-h-[60vh] divide-y divide-border overflow-y-auto">
            {movements.map((m) => (
              <li
                key={m.id}
                className="flex items-start justify-between gap-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {m.reasonLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(m.moved_at)} · {m.by}
                  </p>
                  {m.notes && (
                    <p className="truncate text-xs text-muted-foreground">
                      {m.notes}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p
                    className={cn(
                      "text-sm font-semibold tabular-nums",
                      m.delta > 0 ? "text-success" : "text-foreground",
                    )}
                  >
                    {m.delta > 0 ? "+" : "−"}
                    {formatQty(Math.abs(m.delta))} {item.unitCode}
                  </p>
                  {m.reasonCode === "purchase" && m.unit_cost != null && (
                    <p className="text-xs text-muted-foreground">
                      {formatIdr(m.unit_cost)} / {item.unitCode}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
