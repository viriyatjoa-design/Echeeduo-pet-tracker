"use client";

import { CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";

const t = {
  title: "Something went wrong loading this page",
  body: "It's usually temporary — a quick retry often fixes it.",
  retry: "Try again",
  ref: "Ref",
} as const;

/** Error boundary for the authed app — renders inside the shell, so theme tokens apply. */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-12 text-center shadow-sm">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <CloudOff className="h-7 w-7" aria-hidden />
      </div>
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">{t.title}</h2>
        <p className="mx-auto max-w-xs text-sm text-muted-foreground">
          {t.body}
        </p>
      </div>
      <Button type="button" onClick={() => reset()}>
        {t.retry}
      </Button>
      {error.digest && (
        <p className="text-xs text-muted-foreground/70">
          {t.ref}: {error.digest}
        </p>
      )}
    </div>
  );
}
