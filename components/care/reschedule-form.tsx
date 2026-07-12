"use client";

import * as React from "react";
import { CalendarClock } from "lucide-react";
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
import { rescheduleCareEvent } from "@/lib/actions/care";
import { strings } from "@/lib/strings";

const t = {
  title: "Reschedule",
  desc: "Pick a new due date (and optional time) for this event.",
  dueDate: "Due date",
  dueTime: "Time",
  saved: "Rescheduled",
} as const;

export function RescheduleForm({
  id,
  dueDate,
  dueTime,
  iconOnly = false,
}: {
  id: string;
  dueDate?: string | null;
  dueTime?: string | null;
  /** Compact calendar-icon trigger for tight rows (label via aria). */
  iconOnly?: boolean;
}) {
  const { toast } = useToast();
  const [open, setOpen] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [date, setDate] = React.useState(dueDate ?? "");
  const [time, setTime] = React.useState((dueTime ?? "").slice(0, 5));

  function onOpenChange(next: boolean) {
    if (next) {
      setDate(dueDate ?? "");
      setTime((dueTime ?? "").slice(0, 5));
    }
    setOpen(next);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        await rescheduleCareEvent(id, date, time || null);
        toast({ title: t.saved, variant: "success" });
        setOpen(false);
      } catch (err) {
        toast({
          title: err instanceof Error ? err.message : "Something went wrong",
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {iconOnly ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={strings.care.reschedule}
          onClick={() => onOpenChange(true)}
        >
          <CalendarClock className="h-5 w-5" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onOpenChange(true)}
        >
          <CalendarClock className="h-4 w-4" />
          {strings.care.reschedule}
        </Button>
      )}

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t.title}</DialogTitle>
          <DialogDescription>{t.desc}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="resched-date">{t.dueDate}</Label>
            <Input
              id="resched-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resched-time">
              {t.dueTime}{" "}
              <span className="text-muted-foreground">
                ({strings.common.optional})
              </span>
            </Label>
            <Input
              id="resched-time"
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
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

export default RescheduleForm;
