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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { compressImage } from "@/components/attachments/image-compress";
import { logSymptom } from "@/lib/actions/observation";
import { uploadAttachmentAction } from "@/lib/actions/attachments";
import { strings } from "@/lib/strings";
import type { Cat, Lookup } from "@/lib/types";
import { actionErrorMessage } from "@/lib/action-error";

const t = {
  newSymptom: "Symptom",
  title: "Log symptom",
  desc: "Note something you observed — with severity and an optional photo.",
  cat: "Cat",
  catPh: "Which cat?",
  type: "Symptom",
  typePh: "Pick a symptom",
  severity: "Severity",
  sev: ["Mild", "Moderate", "Severe"] as const,
  photo: "Photo",
  addPhoto: "Add photo",
  saved: "Symptom logged",
  error: "Couldn't log symptom",
  photoFailed: "Saved — photo upload failed, add it later from the health tab",
} as const;

const SEVERITIES = [1, 2, 3] as const;

export type SymptomFormProps = {
  cats: Cat[];
  symptomTypes: Lookup[];
  /** Controlled open (e.g. from the FAB menu). Omit for the default trigger. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Render the built-in trigger button (ignored when controlled). */
  showTrigger?: boolean;
};

export function SymptomForm({
  cats,
  symptomTypes,
  open,
  onOpenChange,
  showTrigger = true,
}: SymptomFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  const controlled = open !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = controlled ? open! : internalOpen;

  const [catId, setCatId] = React.useState<string>("");
  const [typeId, setTypeId] = React.useState<string>("");
  const [severity, setSeverity] = React.useState<number>(1);
  const [notes, setNotes] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);

  // Reset fields whenever the dialog opens (covers both trigger + controlled/FAB).
  React.useEffect(() => {
    if (!isOpen) return;
    setCatId(cats.length === 1 ? cats[0].id : "");
    setTypeId("");
    setSeverity(1);
    setNotes("");
    setFile(null);
  }, [isOpen, cats]);

  function setOpen(next: boolean) {
    if (controlled) onOpenChange?.(next);
    else setInternalOpen(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      let id: string;
      try {
        id = await logSymptom({
          cat_id: catId,
          symptom_type_id: typeId,
          severity,
          notes,
        });
      } catch (err) {
        toast({
          title: t.error,
          description: actionErrorMessage(err, "") || undefined,
          variant: "destructive",
        });
        return;
      }

      // Photo-then-id: attach the optional photo to the freshly-created row.
      // The row is saved either way — an upload failure must still close the
      // dialog, or re-saving would duplicate the row.
      if (file) {
        try {
          const compressed = await compressImage(file);
          const fd = new FormData();
          fd.set("entityType", "symptom_log");
          fd.set("entityId", id);
          fd.set("revalidate", "/journal");
          fd.set("file", compressed);
          await uploadAttachmentAction(fd);
        } catch {
          toast({ title: t.photoFailed, variant: "warning" });
          setOpen(false);
          router.refresh();
          return;
        }
      }

      toast({ title: t.saved, variant: "success" });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {!controlled && showTrigger && (
        <DialogTrigger asChild>
          <Button type="button">
            <Plus className="h-4 w-4" />
            {t.newSymptom}
          </Button>
        </DialogTrigger>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription className="sr-only">{t.desc}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t.cat}</Label>
            <Select value={catId} onValueChange={setCatId}>
              <SelectTrigger>
                <SelectValue placeholder={t.catPh} />
              </SelectTrigger>
              <SelectContent>
                {cats.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t.type}</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger>
                <SelectValue placeholder={t.typePh} />
              </SelectTrigger>
              <SelectContent>
                {symptomTypes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t.severity}</Label>
            <div className="grid grid-cols-3 gap-2">
              {SEVERITIES.map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={severity === s ? "default" : "outline"}
                  className={cn(severity !== s && "text-muted-foreground")}
                  onClick={() => setSeverity(s)}
                >
                  {s} · {t.sev[s - 1]}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="symptom-notes">
              {strings.common.notes}{" "}
              <span className="text-muted-foreground">
                ({strings.common.optional})
              </span>
            </Label>
            <Textarea
              id="symptom-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="symptom-photo">
              {t.photo}{" "}
              <span className="text-muted-foreground">
                ({strings.common.optional})
              </span>
            </Label>
            <label
              htmlFor="symptom-photo"
              className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-input bg-background px-3.5 py-2 text-sm text-foreground hover:bg-accent hover:text-accent-foreground"
            >
              <ImagePlus className="h-4 w-4" />
              {file ? file.name : t.addPhoto}
            </label>
            <input
              id="symptom-photo"
              type="file"
              accept="image/*"
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
            <Button type="submit" disabled={pending || !catId || !typeId}>
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

export default SymptomForm;
