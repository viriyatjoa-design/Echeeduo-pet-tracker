"use client";

import * as React from "react";
import { X } from "lucide-react";
import {
  useToast,
  dismissToast,
  type Toast,
  type ToastVariant,
} from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const variantClasses: Record<ToastVariant, string> = {
  default: "bg-card text-card-foreground border-border",
  warning: "bg-warning text-warning-foreground border-transparent",
  destructive:
    "bg-destructive text-destructive-foreground border-transparent",
  success: "bg-success text-success-foreground border-transparent",
};

function ToastItem({ toast }: { toast: Toast }) {
  React.useEffect(() => {
    const timer = setTimeout(
      () => dismissToast(toast.id),
      toast.duration ?? 4000,
    );
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg animate-in slide-in-from-bottom-2 fade-in-0",
        variantClasses[toast.variant ?? "default"],
      )}
    >
      <div className="flex-1 space-y-1">
        {toast.title && (
          <p className="text-sm font-semibold leading-tight">{toast.title}</p>
        )}
        {toast.description && (
          <p className="text-sm opacity-90">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismissToast(toast.id)}
        className="shrink-0 rounded-md p-0.5 opacity-70 transition-opacity hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function Toaster() {
  const { toasts } = useToast();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[60] mx-auto flex max-w-md flex-col gap-2 px-4">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
