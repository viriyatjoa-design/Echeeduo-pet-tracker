"use client";

import * as React from "react";
import { ChevronUp, ChevronDown, Pencil, Check, X } from "lucide-react";
import type { Lookup } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { slugify } from "@/components/admin/lookups-util";
import {
  updateLookup,
  setLookupActive,
  moveLookup,
  type LookupResult,
} from "@/lib/actions/lookups";

const t = {
  editEntry: "Edit entry",
  labelLabel: "Label",
  codeLabel: "Code",
  save: "Save",
  cancel: "Cancel",
  moveUp: "Move up",
  moveDown: "Move down",
  inactive: "Inactive",
  active: "Active",
  saveFailed: "Couldn't save",
  moveFailed: "Couldn't reorder",
  toggleFailed: "Couldn't update",
} as const;

export function LookupRow({
  lookup,
  isFirst,
  isLast,
}: {
  lookup: Lookup;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();
  const [editing, setEditing] = React.useState(false);
  const [label, setLabel] = React.useState(lookup.label);
  const [code, setCode] = React.useState(lookup.code);

  // Keep local edit fields in sync if the row data changes underneath us.
  React.useEffect(() => {
    if (!editing) {
      setLabel(lookup.label);
      setCode(lookup.code);
    }
  }, [lookup.label, lookup.code, editing]);

  function run(
    fn: () => Promise<LookupResult>,
    failTitle: string,
    onOk?: () => void,
  ) {
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: failTitle,
          description: res.error,
        });
        return;
      }
      onOk?.();
    });
  }

  function saveEdit() {
    const nextLabel = label.trim();
    if (!nextLabel) {
      toast({ variant: "destructive", title: t.saveFailed, description: t.labelLabel + " is required." });
      return;
    }
    run(
      () => updateLookup({ id: lookup.id, label: nextLabel, code }),
      t.saveFailed,
      () => setEditing(false),
    );
  }

  if (editing) {
    return (
      <div className="rounded-xl border border-border bg-card p-3 shadow-sm">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor={`label-${lookup.id}`}>{t.labelLabel}</Label>
            <Input
              id={`label-${lookup.id}`}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`code-${lookup.id}`}>{t.codeLabel}</Label>
            <Input
              id={`code-${lookup.id}`}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onBlur={(e) => setCode(slugify(e.target.value))}
              className="font-mono"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={saveEdit} disabled={pending}>
              <Check /> {t.save}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setLabel(lookup.label);
                setCode(lookup.code);
              }}
              disabled={pending}
            >
              <X /> {t.cancel}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border border-border bg-card p-2.5 pl-3 shadow-sm",
        !lookup.is_active && "opacity-60",
      )}
    >
      {/* Reorder */}
      <div className="flex flex-col">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label={t.moveUp}
          disabled={isFirst || pending}
          onClick={() => run(() => moveLookup(lookup.id, "up"), t.moveFailed)}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-8 w-8"
          aria-label={t.moveDown}
          disabled={isLast || pending}
          onClick={() => run(() => moveLookup(lookup.id, "down"), t.moveFailed)}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
      </div>

      {/* Label + code */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">
            {lookup.label}
          </span>
          {!lookup.is_active && (
            <Badge variant="outline" className="shrink-0">
              {t.inactive}
            </Badge>
          )}
        </div>
        <span className="truncate font-mono text-xs text-muted-foreground">
          {lookup.code}
        </span>
      </div>

      {/* Edit */}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-9 w-9"
        aria-label={t.editEntry}
        disabled={pending}
        onClick={() => setEditing(true)}
      >
        <Pencil className="h-4 w-4" />
      </Button>

      {/* Active toggle */}
      <Switch
        checked={lookup.is_active}
        disabled={pending}
        aria-label={lookup.is_active ? t.active : t.inactive}
        onCheckedChange={(next) =>
          run(() => setLookupActive(lookup.id, next), t.toggleFailed)
        }
      />
    </div>
  );
}
