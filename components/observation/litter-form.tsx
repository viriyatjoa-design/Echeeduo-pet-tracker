"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, ImagePlus, Loader2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/components/attachments/image-compress";
import { logLitter } from "@/lib/actions/observation";
import { uploadAttachmentAction } from "@/lib/actions/attachments";
import { strings } from "@/lib/strings";
import type { Cat, Lookup } from "@/lib/types";

const HOUSEHOLD = "__household__";

const t = {
  newLitter: "Litter",
  title: "Log litter",
  desc: "Record output from the box. Leave the cat unattributed for shared boxes.",
  cat: "Cat",
  household: "Unattributed / household",
  urine: "Urine",
  stool: "Stool",
  consistency: "Stool consistency",
  consistencyPh: "Pick consistency",
  photo: "Photo",
  addPhoto: "Add photo",
  saved: "Litter logged",
  error: "Couldn't log litter",
} as const;

export type LitterFormProps = {
  cats: Cat[];
  stoolConsistencies: Lookup[];
  /** Controlled open (e.g. from the FAB menu). Omit for the default trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Render the built-in trigger button (ignored when controlled). */
  showTrigger?: boolean;
};

export function LitterForm({
  cats,
  stoolConsistencies,
  open,
  onOpenChange,
  showTrigger = true,
}: LitterFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const controlled = open !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = controlled ? open! : internalOpen;

  const [catId, setCatId] = React.useState<string>(HOUSEHOLD);
  const [urine, setUrine] = React.useState(true);
  const [stool, setStool] = React.useState(false);
  const [consistencyId, setConsistencyId] = React.useState<string>("");
  const [notes, setNotes] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);

  function reset() {
    setCatId(HOUSEHOLD);
    setUrine(true);
    setStool(false);
    setConsistencyId("");
    setNotes("");
    setFile(null);
  }

  function setOpen(next: boolean) {
    if (next) reset();
    if (controlled) onOpenChange?.(next);
    else setInternalOpen(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const id = await logLitter({
          cat_id: catId === HOUSEHOLD ? null : catId,
          urine,
          stool,
          stool_consistency_id: stool && consistencyId ? consistencyId : null,
          notes,
        });

        // Photo-then-id: the row exists, now attach the (optional) photo to it.
        if (file) {
          const compressed = await compressImage(file);
          const fd = new FormData();
          fd.set("entityType", "litter_log");
          fd.set("entityId", id);
          fd.set("revalidate", "/journal");
          fd.set("file", compressed);
          await uploadAttachmentAction(fd);
        }

        toast({ title: t.saved, variant: "success" });
        setOpen(false);
        router.refresh();
      } catch (err) {
        toast({
          title: t.error,
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {!controlled && showTrigger && (
        <DialogTrigger asChild>
          <Button type="button">
            <Plus className="h-4 w-4" />
            {t.newLitter}
          </Button>
        </DialogTrigger>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.desc}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.cat}</Label>
            <Select value={catId} onValueChange={setCatId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={HOUSEHOLD}>{t.household}</SelectItem>
                {cats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5">
            <Label htmlFor="litter-urine">{t.urine}</Label>
            <Switch id="litter-urine" checked={urine} onCheckedChange={setUrine} />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5">
            <Label htmlFor="litter-stool">{t.stool}</Label>
            <Switch id="litter-stool" checked={stool} onCheckedChange={setStool} />
          </div>

          {stool && (
            <div className="space-y-1.5">
              <Label>{t.consistency}</Label>
              <Select value={consistencyId} onValueChange={setConsistencyId}>
                <SelectTrigger>
                  <SelectValue placeholder={t.consistencyPh} />
                </SelectTrigger>
                <SelectContent>
                  {stoolConsistencies.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="litter-notes">
              {strings.common.notes}{" "}
              <span className="text-muted-foreground">
                ({strings.common.optional})
              </span>
            </Label>
            <Textarea
              id="litter-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="litter-photo">
              {t.photo}{" "}
              <span className="text-muted-foreground">
                ({strings.common.optional})
              </span>
            </Label>
            <label
              htmlFor="litter-photo"
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-input bg-background px-3.5 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <ImagePlus className="h-4 w-4" />
              {file ? file.name : t.addPhoto}
            </label>
            <input
              id="litter-photo"
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                {strings.common.cancel}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                strings.common.save
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default LitterForm;
