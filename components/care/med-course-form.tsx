"use client";

import * as React from "react";
import { Pill } from "lucide-react";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createMedCourse } from "@/lib/actions/care";
import type { Cat } from "@/lib/types";
import { strings } from "@/lib/strings";
import { actionErrorMessage } from "@/lib/action-error";

const t = {
  desc: "Generates one tickable dose for every day × time across the course.",
  cat: "Cat",
  catPh: "Pick a cat",
  medicine: "Medicine",
  medicinePh: "e.g. Amoxicillin 50mg",
  startDate: "Start date",
  duration: "Duration (days)",
  perDay: "Times per day",
  times: "Dose times",
  doses: (n: number) => `Will create ${n} dose${n === 1 ? "" : "s"}.`,
  saved: "Med course created",
} as const;

/** Sensible default clock times when the count changes. */
const DEFAULT_TIMES = ["08:00", "20:00", "13:00", "23:00"];

function defaultTimesFor(count: number): string[] {
  return Array.from({ length: count }, (_, i) => DEFAULT_TIMES[i] ?? "12:00");
}

export function MedCourseForm({ cats }: { cats: Cat[] }) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const [catId, setCatId] = React.useState("");
  const [medicine, setMedicine] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [duration, setDuration] = React.useState("7");
  const [times, setTimes] = React.useState<string[]>(["08:00", "20:00"]);

  function reset() {
    setCatId("");
    setMedicine("");
    setStartDate("");
    setDuration("7");
    setTimes(["08:00", "20:00"]);
  }

  function onOpenChange(next: boolean) {
    if (next) reset();
    setOpen(next);
  }

  function onPerDayChange(value: string) {
    const count = Math.max(1, Math.min(4, Number(value) || 1));
    setTimes((prev) => {
      const next = defaultTimesFor(count);
      // Preserve any times the user already customised.
      for (let i = 0; i < count; i++) if (prev[i]) next[i] = prev[i];
      return next;
    });
  }

  function setTimeAt(i: number, value: string) {
    setTimes((prev) => prev.map((tm, idx) => (idx === i ? value : tm)));
  }

  const dosesTotal =
    (Number(duration) > 0 ? Math.round(Number(duration)) : 0) * times.length;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await createMedCourse({
          cat_id: catId,
          medicine_name: medicine,
          start_date: startDate,
          duration_days: duration,
          times,
        });
        toast({ title: t.saved, variant: "success" });
        setOpen(false);
      } catch (err) {
        toast({
          title: actionErrorMessage(err, "Something went wrong"),
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Button type="button" variant="outline" onClick={() => onOpenChange(true)}>
        <Pill className="h-4 w-4" />
        {strings.care.newCourse}
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{strings.care.newCourse}</DialogTitle>
          <DialogDescription>{t.desc}</DialogDescription>
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
            <Label htmlFor="med-name">{t.medicine}</Label>
            <Input
              id="med-name"
              value={medicine}
              onChange={(e) => setMedicine(e.target.value)}
              placeholder={t.medicinePh}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="med-start">{t.startDate}</Label>
              <Input
                id="med-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="med-duration">{t.duration}</Label>
              <Input
                id="med-duration"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t.perDay}</Label>
            <Select value={String(times.length)} onValueChange={onPerDayChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}×
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t.times}</Label>
            <div className="grid grid-cols-2 gap-3">
              {times.map((tm, i) => (
                <Input
                  key={i}
                  type="time"
                  value={tm}
                  onChange={(e) => setTimeAt(i, e.target.value)}
                  aria-label={`Dose ${i + 1} time`}
                  required
                />
              ))}
            </div>
          </div>

          {dosesTotal > 0 && (
            <p className="text-sm text-muted-foreground">{t.doses(dosesTotal)}</p>
          )}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                {strings.common.cancel}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending || !catId}>
              {pending ? strings.common.loading : strings.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default MedCourseForm;
