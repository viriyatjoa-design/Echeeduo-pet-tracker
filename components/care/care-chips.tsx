"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { bucketCareEvents } from "@/lib/care";
import { relativeDay } from "@/lib/time";
import { completeCareEvent } from "@/lib/actions/care";
import { cn } from "@/lib/utils";
import type { CareEvent } from "@/lib/types";

const t = {
  done: "Marked done",
  nextUp: (d: string) => `Next up ${d}`,
} as const;

/**
 * Compact care chips for a cat's dashboard card: overdue (red) + due-today
 * (amber), each with an inline ✓ that completes the event. Presentational —
 * the dashboard passes this cat's open events + the type-label map.
 */
export function CareChips({
  events,
  typeLabels,
}: {
  events: CareEvent[];
  typeLabels: Map<string, string>;
}) {
  const { overdue, today } = bucketCareEvents(events);
  const chips = [
    ...overdue.map((e) => ({ event: e, tone: "overdue" as const })),
    ...today.map((e) => ({ event: e, tone: "today" as const })),
  ];

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map(({ event, tone }) => (
        <Chip
          key={event.id}
          event={event}
          tone={tone}
          label={typeLabels.get(event.event_type_id) ?? event.title}
        />
      ))}
    </div>
  );
}

function Chip({
  event,
  tone,
  label,
}: {
  event: CareEvent;
  tone: "overdue" | "today";
  label: string;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  function complete() {
    startTransition(async () => {
      try {
        const { nextDueDate } = await completeCareEvent(event.id);
        toast({
          title: t.done,
          description: nextDueDate ? t.nextUp(relativeDay(nextDueDate)) : undefined,
          variant: "success",
        });
      } catch (err) {
        toast({
          title: err instanceof Error ? err.message : "Something went wrong",
          variant: "destructive",
        });
      }
    });
  }

  const toneClass =
    tone === "overdue"
      ? "bg-destructive/12 text-destructive"
      : "bg-warning/15 text-warning";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs font-medium",
        toneClass,
      )}
    >
      <span className="truncate">{event.title}</span>
      <span className="opacity-70">· {label}</span>
      <button
        type="button"
        onClick={complete}
        disabled={pending}
        aria-label={`Mark ${event.title} done`}
        className="ml-0.5 grid h-5 w-5 place-items-center rounded-full transition-colors hover:bg-background/40 disabled:opacity-50"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

export default CareChips;
