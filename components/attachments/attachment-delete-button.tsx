"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { deleteAttachmentAction } from "@/lib/actions/attachments";

const t = {
  remove: "Remove photo",
  removed: "Photo removed",
  error: "Couldn't remove photo",
} as const;

export type AttachmentDeleteButtonProps = {
  id: string;
  revalidate?: string;
  className?: string;
};

/** Small client control that soft-deletes an attachment, then refreshes. */
export function AttachmentDeleteButton({
  id,
  revalidate,
  className,
}: AttachmentDeleteButtonProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function onDelete() {
    setBusy(true);
    try {
      await deleteAttachmentAction(id, revalidate);
      toast({ title: t.removed, variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: t.error,
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      aria-label={t.remove}
      title={t.remove}
      disabled={busy}
      onClick={onDelete}
      className={cn(
        "absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full",
        "bg-background/80 text-foreground shadow-sm backdrop-blur",
        "transition-opacity hover:bg-background disabled:opacity-50",
        className,
      )}
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export default AttachmentDeleteButton;
