"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { ButtonProps } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

/**
 * A button that runs a bound Server Action inside a transition, with a confirm
 * prompt + toast feedback. Server components pass a pre-bound action, e.g.
 * `action={setFoodActive.bind(null, food.id, false)}`.
 */
export function ActionButton({
  action,
  children,
  confirmText,
  successText,
  variant,
  size,
  className,
  disabled,
}: {
  action: () => Promise<void>;
  children: React.ReactNode;
  confirmText?: string;
  successText?: string;
} & Pick<ButtonProps, "variant" | "size" | "className" | "disabled">) {
  const { toast } = useToast();
  const [pending, startTransition] = React.useTransition();

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      disabled={pending || disabled}
      onClick={() => {
        if (confirmText && !window.confirm(confirmText)) return;
        startTransition(async () => {
          try {
            await action();
            if (successText) toast({ title: successText, variant: "success" });
          } catch (err) {
            toast({
              title: err instanceof Error ? err.message : "Something went wrong",
              variant: "destructive",
            });
          }
        });
      }}
    >
      {children}
    </Button>
  );
}
