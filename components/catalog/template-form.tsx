"use client";

import * as React from "react";
import { Plus, Pencil } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { createTemplate, updateTemplate } from "@/lib/actions/meal-templates";
import type { MealTemplate } from "@/lib/types";
import { strings } from "@/lib/strings";

const t = {
  newTemplate: "New template",
  editTemplate: "Edit template",
  desc: "Name a meal (e.g. Morning, Evening). Add each cat's food next.",
  name: "Name",
  namePh: "e.g. Morning",
  sortOrder: "Sort order",
} as const;

export function TemplateForm({ template }: { template?: MealTemplate }) {
  const isEdit = !!template;
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const [name, setName] = React.useState(template?.name ?? "");
  const [sortOrder, setSortOrder] = React.useState(
    template?.sort_order != null ? String(template.sort_order) : "0",
  );

  function reset() {
    setName(template?.name ?? "");
    setSortOrder(template?.sort_order != null ? String(template.sort_order) : "0");
  }

  function onOpenChange(next: boolean) {
    if (next) reset();
    setOpen(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = isEdit
        ? await updateTemplate(template!.id, { name, sort_order: sortOrder })
        : await createTemplate({ name, sort_order: sortOrder });
      if (!res.ok) {
        toast({ title: res.error, variant: "destructive" });
        return;
      }
      toast({
        title: isEdit ? "Template updated" : "Template created",
        variant: "success",
      });
      setOpen(false);
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
          {t.newTemplate}
        </Button>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t.editTemplate : t.newTemplate}</DialogTitle>
          <DialogDescription className="sr-only">{t.desc}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tpl-name">{t.name}</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.namePh}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tpl-sort">{t.sortOrder}</Label>
            <Input
              id="tpl-sort"
              type="number"
              inputMode="numeric"
              step="1"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
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
