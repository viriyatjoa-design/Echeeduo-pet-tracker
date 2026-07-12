"use client";

import * as React from "react";
import { Plus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { createCareEvent, logPastCareEvent } from "@/lib/actions/care";
import { relativeDay, todayInTz } from "@/lib/time";
import type { Cat, Lookup } from "@/lib/types";
import { strings } from "@/lib/strings";
import { actionErrorMessage } from "@/lib/action-error";

const t = {
  desc: "Schedule a one-off or recurring care event for a cat.",
  cat: "Cat",
  catPh: "Pick a cat",
  type: "Type",
  typePh: "Pick a care type",
  title: "Title",
  titlePh: "e.g. Rabies booster",
  dueDate: "Due date",
  dueTime: "Time",
  interval: "Repeat every (days)",
  intervalHint: "e.g. 90 for quarterly deworm — leave blank for one-off",
  vet: "Vet",
  vetPh: "e.g. Dr. Tan · Happy Paws",
  saved: "Event created",
  // "Already done" mode — for entering historical care (old vaccinations etc.)
  alreadyDone: "Already done?",
  alreadyDoneHint: "Record care that happened in the past",
  doneDate: "Date done",
  pastIntervalHint: "e.g. 365 for annual vaccine — schedules the next one",
  savedPast: "Recorded",
  savedPastNext: (d: string) => `Recorded — next one due ${d}`,
} as const;

export function CareEventForm({
  cats,
  careTypes,
}: {
  cats: Cat[];
  careTypes: Lookup[];
}) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();

  const [catId, setCatId] = React.useState("");
  const [typeId, setTypeId] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");
  const [dueTime, setDueTime] = React.useState("");
  const [interval, setInterval] = React.useState("");
  const [vet, setVet] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [alreadyDone, setAlreadyDone] = React.useState(false);
  const [doneDate, setDoneDate] = React.useState("");

  function reset() {
    setCatId("");
    setTypeId("");
    setTitle("");
    setDueDate("");
    setDueTime("");
    setInterval("");
    setVet("");
    setNotes("");
    setAlreadyDone(false);
    setDoneDate("");
  }

  function onOpenChange(next: boolean) {
    if (next) reset();
    setOpen(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        if (alreadyDone) {
          const { nextDueDate } = await logPastCareEvent({
            cat_id: catId,
            event_type_id: typeId,
            title,
            done_date: doneDate,
            interval_days: interval || null,
            vet_name: vet || null,
            notes: notes || null,
          });
          toast({
            title: nextDueDate
              ? t.savedPastNext(relativeDay(nextDueDate))
              : t.savedPast,
            variant: "success",
          });
        } else {
          await createCareEvent({
            cat_id: catId,
            event_type_id: typeId,
            title,
            due_date: dueDate || null,
            due_time: dueTime || null,
            interval_days: interval || null,
            vet_name: vet || null,
            notes: notes || null,
          });
          toast({ title: t.saved, variant: "success" });
        }
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
      <Button type="button" onClick={() => onOpenChange(true)}>
        <Plus className="h-4 w-4" />
        {strings.care.newEvent}
      </Button>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{strings.care.newEvent}</DialogTitle>
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
            <Label>{t.type}</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger>
                <SelectValue placeholder={t.typePh} />
              </SelectTrigger>
              <SelectContent>
                {careTypes.map((ct) => (
                  <SelectItem key={ct.id} value={ct.id}>
                    {ct.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="care-title">{t.title}</Label>
            <Input
              id="care-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.titlePh}
              required
            />
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5">
            <div>
              <Label htmlFor="care-already-done" className="cursor-pointer">
                {t.alreadyDone}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t.alreadyDoneHint}
              </p>
            </div>
            <Switch
              id="care-already-done"
              checked={alreadyDone}
              onCheckedChange={setAlreadyDone}
            />
          </div>

          {alreadyDone ? (
            <div className="space-y-1.5">
              <Label htmlFor="care-done-date">{t.doneDate}</Label>
              <Input
                id="care-done-date"
                type="date"
                value={doneDate}
                max={todayInTz()}
                onChange={(e) => setDoneDate(e.target.value)}
                required
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="care-date">
                  {t.dueDate}{" "}
                  <span className="text-muted-foreground">
                    ({strings.common.optional})
                  </span>
                </Label>
                <Input
                  id="care-date"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="care-time">
                  {t.dueTime}{" "}
                  <span className="text-muted-foreground">
                    ({strings.common.optional})
                  </span>
                </Label>
                <Input
                  id="care-time"
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="care-interval">
              {t.interval}{" "}
              <span className="text-muted-foreground">
                ({strings.common.optional})
              </span>
            </Label>
            <Input
              id="care-interval"
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              placeholder={alreadyDone ? t.pastIntervalHint : t.intervalHint}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="care-vet">
              {t.vet}{" "}
              <span className="text-muted-foreground">
                ({strings.common.optional})
              </span>
            </Label>
            <Input
              id="care-vet"
              value={vet}
              onChange={(e) => setVet(e.target.value)}
              placeholder={t.vetPh}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="care-notes">
              {strings.common.notes}{" "}
              <span className="text-muted-foreground">
                ({strings.common.optional})
              </span>
            </Label>
            <Textarea
              id="care-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                {strings.common.cancel}
              </Button>
            </DialogClose>
            <Button
              type="submit"
              disabled={pending || !catId || !typeId || (alreadyDone && !doneDate)}
            >
              {pending ? strings.common.loading : strings.common.save}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CareEventForm;
