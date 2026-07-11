"use client";

import * as React from "react";
import type { UUID } from "@/lib/types";
import { setCatActive } from "@/lib/actions/cats";
import { setMemberActive } from "@/lib/actions/members";
import { useToast } from "@/hooks/use-toast";
import { strings } from "@/lib/strings";
import { Button } from "@/components/ui/button";

/**
 * Activate/deactivate toggle shared by the settings cat rows and member rows.
 * Calls the matching server action for `kind`; the action revalidates.
 */
export function ActiveToggle({
  kind,
  id,
  active,
  label,
}: {
  kind: "cat" | "member";
  id: UUID;
  active: boolean;
  /** Name shown in the toast (e.g. the cat or member name). */
  label?: string;
}) {
  const { toast } = useToast();
  const [pending, setPending] = React.useState(false);

  async function handleClick() {
    if (pending) return;
    const next = !active;
    setPending(true);
    try {
      if (kind === "cat") await setCatActive(id, next);
      else await setMemberActive(id, next);
      toast({
        title: `${label ? label + " " : ""}${
          next ? strings.common.activate.toLowerCase() : strings.common.deactivate.toLowerCase()
        }d`,
        variant: "success",
      });
    } catch (err) {
      toast({
        title: strings.auth.genericError,
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      type="button"
      variant={active ? "ghost" : "outline"}
      size="sm"
      disabled={pending}
      onClick={handleClick}
    >
      {active ? strings.common.deactivate : strings.common.activate}
    </Button>
  );
}
