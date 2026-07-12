"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { completeCareEvent } from "@/lib/actions/care";
import { relativeDay, todayInTz } from "@/lib/time";
import { strings } from "@/lib/strings";

const t = {
  done: "Marked done",
  nextUp: (d: string) => `Next up ${d}`,
  earlyConfirm: (d: string) =>
    `This isn't due until ${d}. Mark it done anyway? (For recurring care this also schedules the next one from today.)`,
} as const;

/**
 * Inline "✓ Done" control. Calls completeCareEvent; if the event was recurring
 * the toast mentions the next occurrence's due date.
 */
export function CompleteButton({
  id,
  dueDate,
  variant = "outline",
  size = "default",
  className,
  label = strings.care.complete,
  iconOnly = false,
}: {
  id: string;
  /** 'YYYY-MM-DD'. When in the future, completing asks for confirmation first. */
  dueDate?: string | null;
  label?: string;
  iconOnly?: boolean;
} & Pick<ButtonProps, "variant" | "size" | "className">) {
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  function onClick() {
    // Guard against accidental early completion — each "Done" on a recurring
    // event is real (it chains the next occurrence), so a stray tap on an
    // upcoming item would silently march the schedule forward.
    if (dueDate && dueDate > todayInTz()) {
      if (!window.confirm(t.earlyConfirm(relativeDay(dueDate)))) return;
    }
    startTransition(async () => {
      try {
        const { nextDueDate } = await completeCareEvent(id);
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

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={onClick}
      aria-label={iconOnly ? strings.care.complete : undefined}
    >
      <Check className="h-4 w-4" />
      {!iconOnly && <span>{label}</span>}
    </Button>
  );
}

export default CompleteButton;
