"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PackageOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { openOnePack } from "@/lib/actions/inventory";
import { actionErrorMessage } from "@/lib/action-error";

const t = {
  label: "Opened one",
  done: (n: number) => `Opened one — ${n} left in stock`,
  error: "Couldn't record it",
} as const;

/**
 * One-tap "I just opened a new pack/bag" (owner-approved Option A). Stock
 * counts sealed packs; this is the whole consumption UX for litter-type items.
 */
export function OpenOneButton({
  itemId,
  quantity,
}: {
  itemId: string;
  quantity: number;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);

  async function onOpen() {
    setPending(true);
    try {
      await openOnePack(itemId);
      toast({ title: t.done(Math.max(0, quantity - 1)), variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: t.error,
        description: actionErrorMessage(err, ""),
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending || quantity < 1}
      onClick={onOpen}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <PackageOpen className="h-3.5 w-3.5" />
      )}
      {t.label}
    </Button>
  );
}

export default OpenOneButton;
