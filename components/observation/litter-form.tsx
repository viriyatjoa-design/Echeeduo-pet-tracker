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
import { analyzeLitterPhoto } from "@/lib/actions/ai";
import { actionErrorMessage } from "@/lib/action-error";
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
  savedAnalyzing: "Litter logged — AI is reading the photo…",
  analysisReady: "Photo analysis ready — see the journal",
  analysisFailed: "Photo analysis failed",
  error: "Couldn't log litter",
  photoFailed: "Saved — photo upload failed, add it later from the journal",
} as const;

export type LitterFormProps = {
  cats: Cat[];
  stoolConsistencies: Lookup[];
  /** Controlled open (e.g. from the FAB menu). Omit for the default trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Render the built-in trigger button (ignored when controlled). */
  showTrigger?: boolean;
  /** AI configured server-side → photo uploads auto-trigger stool/urine analysis. */
  aiReady?: boolean;
};

export function LitterForm({
  cats,
  stoolConsistencies,
  open,
  onOpenChange,
  showTrigger = true,
  aiReady = false,
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

  // Reset fields whenever the dialog opens (covers both trigger + controlled/FAB).
  React.useEffect(() => {
    if (!isOpen) return;
    setCatId(HOUSEHOLD);
    setUrine(true);
    setStool(false);
    setConsistencyId("");
    setNotes("");
    setFile(null);
  }, [isOpen]);

  function setOpen(next: boolean) {
    if (controlled) onOpenChange?.(next);
    else setInternalOpen(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      let id: string;
      try {
        id = await logLitter({
          cat_id: catId === HOUSEHOLD ? null : catId,
          urine,
          stool,
          stool_consistency_id: stool && consistencyId ? consistencyId : null,
          notes,
        });
      } catch (err) {
        toast({
          title: t.error,
          description: actionErrorMessage(err, ""),
          variant: "destructive",
        });
        return;
      }

      // Photo-then-id: the row exists, now attach the (optional) photo to it.
      // The row is saved either way — an upload failure must still close the
      // dialog, or re-saving would duplicate the row.
      let photoUploaded = false;
      if (file) {
        try {
          const compressed = await compressImage(file);
          const fd = new FormData();
          fd.set("entityType", "litter_log");
          fd.set("entityId", id);
          fd.set("revalidate", "/journal");
          fd.set("file", compressed);
          await uploadAttachmentAction(fd);
          photoUploaded = true;
        } catch {
          toast({ title: t.photoFailed, variant: "warning" });
          setOpen(false);
          router.refresh();
          return;
        }
      }

      const analyze = photoUploaded && aiReady;
      toast({
        title: analyze ? t.savedAnalyzing : t.saved,
        variant: "success",
      });
      setOpen(false);
      router.refresh();

      // Auto-analysis (owner-requested): fire-and-forget AFTER the dialog
      // closes so saving never waits on the model. The result lands on the
      // row (refresh shows it); toasts report either way.
      if (analyze) {
        void analyzeLitterPhoto(id)
          .then((res) => {
            if (res.ok) {
              toast({ title: t.analysisReady, variant: "success" });
            } else {
              toast({
                title: t.analysisFailed,
                description: res.error,
                variant: "warning",
              });
            }
            router.refresh();
          })
          .catch((err) => {
            toast({
              title: t.analysisFailed,
              description: actionErrorMessage(err, ""),
              variant: "warning",
            });
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
