"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { removeCareEvent } from "@/lib/actions/care";
import { actionErrorMessage } from "@/lib/action-error";

const t = {
  label: "Remove",
  confirm: (title: string) =>
    `Remove "${title}"? It disappears from the timeline and care lists (history is kept, not erased).`,
  removed: "Removed",
} as const;

/** Trash icon-button: soft-deletes a care event (open or done) after confirm. */
export function RemoveEventButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  function onClick() {
    if (!window.confirm(t.confirm(title))) return;
    startTransition(async () => {
      try {
        await removeCareEvent(id);
        toast({ title: t.removed, variant: "success" });
      } catch (err) {
        toast({
          title: actionErrorMessage(err, "Something went wrong"),
          variant: "destructive",
        });
      }
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t.label}
      disabled={pending}
      onClick={onClick}
      className="text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="h-5 w-5" />
    </Button>
  );
}

export default RemoveEventButton;
