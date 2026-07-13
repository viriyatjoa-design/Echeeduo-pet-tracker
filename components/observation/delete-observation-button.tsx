"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { removeObservation } from "@/lib/actions/observation";

const t = {
  confirm: (k: string) => `Delete this ${k} entry? It's hidden everywhere but kept in history.`,
  removed: "Entry removed",
  failed: "Couldn't delete it",
  label: "Delete entry",
} as const;

/** Soft-deletes a journal water/litter/symptom entry (with confirm). */
export function DeleteObservationButton({
  kind,
  id,
}: {
  kind: "water" | "litter" | "symptom";
  id: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = React.useState(false);

  async function onDelete() {
    if (!window.confirm(t.confirm(kind))) return;
    setBusy(true);
    try {
      const res = await removeObservation(kind, id);
      if (!res.ok) {
        toast({ title: t.failed, description: res.error, variant: "destructive" });
        return;
      }
      toast({ title: t.removed, variant: "success" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={onDelete}
      disabled={busy}
      aria-label={t.label}
      title={t.label}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
    >
      {busy ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

export default DeleteObservationButton;
