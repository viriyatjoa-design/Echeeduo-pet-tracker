"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { MoreHorizontal, Pencil, History, Archive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { setItemActive } from "@/lib/actions/inventory";
import type { Lookup } from "@/lib/types";
import type { InventoryItemView } from "@/lib/inventory-queries";
import { ItemForm, type FoodOption } from "./item-form";
import { ItemHistory } from "./item-history";
import { actionErrorMessage } from "@/lib/action-error";

const t = {
  more: "More actions",
  edit: "Edit",
  history: "History",
  deactivate: "Deactivate",
  confirmDeactivate:
    "Deactivate this item? Its history is kept but it disappears from the list.",
  deactivated: "Item deactivated",
  wrong: "Something went wrong",
} as const;

const itemClass =
  "flex w-full cursor-default select-none items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50";

/** Per-item overflow menu: Edit / History / Deactivate. */
export function ActionMenu({
  item,
  types,
  units,
  foods,
}: {
  item: InventoryItemView;
  types: Lookup[];
  units: Lookup[];
  foods: FoodOption[];
}) {
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [editOpen, setEditOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);

  function deactivate() {
    if (!window.confirm(t.confirmDeactivate)) return;
    startTransition(async () => {
      try {
        await setItemActive(item.id, false);
        toast({ title: t.deactivated, variant: "success" });
      } catch (err) {
        toast({
          title: actionErrorMessage(err, t.wrong),
          variant: "destructive",
        });
      }
    });
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={t.more}
            disabled={pending}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={4}
            className="z-50 min-w-[10rem] rounded-xl border border-border bg-card p-1 text-card-foreground shadow-md"
          >
            <DropdownMenu.Item
              className={itemClass}
              // Let the menu close first, then open the dialog.
              onSelect={() => setTimeout(() => setEditOpen(true), 0)}
            >
              <Pencil className="h-4 w-4 text-muted-foreground" />
              {t.edit}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={itemClass}
              onSelect={() => setTimeout(() => setHistoryOpen(true), 0)}
            >
              <History className="h-4 w-4 text-muted-foreground" />
              {t.history}
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className={itemClass}
              onSelect={() => setTimeout(deactivate, 0)}
            >
              <Archive className="h-4 w-4 text-muted-foreground" />
              {t.deactivate}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <ItemForm
        types={types}
        units={units}
        foods={foods}
        item={item}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
      <ItemHistory
        item={item}
        open={historyOpen}
        onOpenChange={setHistoryOpen}
      />
    </>
  );
}
