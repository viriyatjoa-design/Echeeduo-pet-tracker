"use client";

import * as React from "react";
import { Plus, Pencil } from "lucide-react";
import type { Cat } from "@/lib/types";
import { createCat, updateCat, type CatInput } from "@/lib/actions/cats";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { strings } from "@/lib/strings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { actionErrorMessage } from "@/lib/action-error";

const t = {
  newCat: "New cat",
  editCat: "Edit cat",
  addTitle: "Add a cat",
  editTitle: "Edit cat",
  subtitle: "Profile, targets and their accent colour.",
  name: "Name",
  namePlaceholder: "e.g. Miso",
  sex: "Sex",
  sexUnset: "Prefer not to say",
  male: "Male",
  female: "Female",
  birthDate: "Birth date",
  breed: "Breed",
  neutered: "Neutered / spayed",
  microchip: "Microchip no.",
  weightTarget: "Weight target (kg)",
  bcs: "Body condition (BCS) target",
  bcsTo: "to",
  kcalOverride: "Vet-set daily kcal (optional)",
  accent: "Accent colour",
  saving: "Saving…",
  createdToast: "Cat added",
  updatedToast: "Cat updated",
} as const;

const SEX_UNSET = "unset";
const ACCENTS = [1, 2, 3, 4, 5] as const;

function toKgString(grams: number | null): string {
  return grams == null ? "" : (grams / 1000).toString();
}

type FormState = {
  name: string;
  sex: "male" | "female" | typeof SEX_UNSET;
  birth_date: string;
  breed: string;
  neutered: boolean;
  microchip_no: string;
  weight_target_kg: string;
  bcs_target_min: string;
  bcs_target_max: string;
  daily_kcal_override: string;
  accent_index: number;
  notes: string;
};

function initialState(cat?: Cat): FormState {
  return {
    name: cat?.name ?? "",
    sex: cat?.sex ?? SEX_UNSET,
    birth_date: cat?.birth_date ?? "",
    breed: cat?.breed ?? "British Shorthair",
    neutered: cat?.neutered ?? false,
    microchip_no: cat?.microchip_no ?? "",
    weight_target_kg: toKgString(cat?.weight_target_grams ?? null),
    bcs_target_min: String(cat?.bcs_target_min ?? 4),
    bcs_target_max: String(cat?.bcs_target_max ?? 5),
    daily_kcal_override:
      cat?.daily_kcal_override != null ? String(cat.daily_kcal_override) : "",
    accent_index: cat?.accent_index ?? 1,
    notes: cat?.notes ?? "",
  };
}

/**
 * Create/edit dialog for a cat. Pass a `cat` to edit; omit it to create.
 * Provide a custom `trigger` (e.g. the profile-header Edit button) or rely on
 * the default trigger.
 */
export function CatForm({
  cat,
  trigger,
}: {
  cat?: Cat;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(cat);
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [form, setForm] = React.useState<FormState>(() => initialState(cat));

  // Reset the form to the current cat each time the dialog opens.
  React.useEffect(() => {
    if (open) setForm(initialState(cat));
  }, [open, cat]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toIntOrNull(s: string): number | null {
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;

    const kg = parseFloat(form.weight_target_kg);
    const input: CatInput = {
      name: form.name,
      sex: form.sex === SEX_UNSET ? null : form.sex,
      birth_date: form.birth_date || null,
      breed: form.breed,
      neutered: form.neutered,
      microchip_no: form.microchip_no,
      weight_target_grams: Number.isFinite(kg) ? Math.round(kg * 1000) : null,
      bcs_target_min: toIntOrNull(form.bcs_target_min) ?? 4,
      bcs_target_max: toIntOrNull(form.bcs_target_max) ?? 5,
      daily_kcal_override: toIntOrNull(form.daily_kcal_override),
      accent_index: form.accent_index,
      notes: form.notes,
    };

    setPending(true);
    try {
      if (cat) await updateCat(cat.id, input);
      else await createCat(input);
      toast({
        title: isEdit ? t.updatedToast : t.createdToast,
        variant: "success",
      });
      setOpen(false);
    } catch (err) {
      toast({
        title: strings.auth.genericError,
        description: actionErrorMessage(err, "") || undefined,
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            variant={isEdit ? "ghost" : "default"}
            size={isEdit ? "sm" : "default"}
            className={isEdit ? "w-9 px-0" : undefined}
          >
            {isEdit ? (
              <>
                <Pencil className="h-4 w-4" />
                <span className="sr-only">{strings.common.edit}</span>
              </>
            ) : (
              <>
                <Plus className="h-4 w-4" />
                {t.newCat}
              </>
            )}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? t.editTitle : t.addTitle}</DialogTitle>
          <DialogDescription className="sr-only">{t.subtitle}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="cat-name">{t.name}</Label>
            <Input
              id="cat-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder={t.namePlaceholder}
              required
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-sex">{t.sex}</Label>
              <Select
                value={form.sex}
                onValueChange={(v) => set("sex", v as FormState["sex"])}
              >
                <SelectTrigger id="cat-sex">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="female">{t.female}</SelectItem>
                  <SelectItem value="male">{t.male}</SelectItem>
                  <SelectItem value={SEX_UNSET}>{t.sexUnset}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-birth">{t.birthDate}</Label>
              <Input
                id="cat-birth"
                type="date"
                value={form.birth_date}
                onChange={(e) => set("birth_date", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-breed">{t.breed}</Label>
            <Input
              id="cat-breed"
              value={form.breed}
              onChange={(e) => set("breed", e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-3.5 py-2.5">
            <Label htmlFor="cat-neutered" className="cursor-pointer">
              {t.neutered}
            </Label>
            <Switch
              id="cat-neutered"
              checked={form.neutered}
              onCheckedChange={(v) => set("neutered", v)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-chip">
              {t.microchip}{" "}
              <span className="text-muted-foreground">({strings.common.optional})</span>
            </Label>
            <Input
              id="cat-chip"
              value={form.microchip_no}
              onChange={(e) => set("microchip_no", e.target.value)}
              inputMode="numeric"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cat-weight">{t.weightTarget}</Label>
              <Input
                id="cat-weight"
                type="number"
                inputMode="decimal"
                step="0.05"
                min="0"
                value={form.weight_target_kg}
                onChange={(e) => set("weight_target_kg", e.target.value)}
                placeholder="4.50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-kcal">{t.kcalOverride}</Label>
              <Input
                id="cat-kcal"
                type="number"
                inputMode="numeric"
                min="0"
                value={form.daily_kcal_override}
                onChange={(e) => set("daily_kcal_override", e.target.value)}
                placeholder="auto"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t.bcs}</Label>
            <div className="flex items-center gap-2">
              <Input
                aria-label={`${t.bcs} min`}
                type="number"
                inputMode="numeric"
                min="1"
                max="9"
                className="w-20"
                value={form.bcs_target_min}
                onChange={(e) => set("bcs_target_min", e.target.value)}
              />
              <span className="text-sm text-muted-foreground">{t.bcsTo}</span>
              <Input
                aria-label={`${t.bcs} max`}
                type="number"
                inputMode="numeric"
                min="1"
                max="9"
                className="w-20"
                value={form.bcs_target_max}
                onChange={(e) => set("bcs_target_max", e.target.value)}
              />
              <span className="text-sm text-muted-foreground">/ 9</span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t.accent}</Label>
            <div className="flex items-center gap-2.5">
              {ACCENTS.map((n) => {
                const selected = form.accent_index === n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-label={`Accent ${n}`}
                    aria-pressed={selected}
                    onClick={() => set("accent_index", n)}
                    style={{ backgroundColor: `hsl(var(--cat-${n}))` }}
                    className={cn(
                      "h-9 w-9 rounded-full ring-offset-2 ring-offset-background transition-transform",
                      selected
                        ? "ring-2 ring-ring scale-110"
                        : "opacity-80 hover:opacity-100",
                    )}
                  />
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cat-notes">{strings.common.notes}</Label>
            <Textarea
              id="cat-notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                {strings.common.cancel}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? t.saving : strings.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
