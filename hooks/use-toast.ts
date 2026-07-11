"use client";

import * as React from "react";

export type ToastVariant = "default" | "warning" | "destructive" | "success";

export type ToastInput = {
  title?: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

export type Toast = ToastInput & {
  id: string;
};

type Listener = (toasts: Toast[]) => void;

const DEFAULT_DURATION = 4000;

// Tiny module-level store so any component can push a toast without a provider
// wrapping the whole tree. The Toaster subscribes; useToast pushes.
let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function emit() {
  for (const listener of listeners) listener(toasts);
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(toasts);
  return () => {
    listeners.delete(listener);
  };
}

export function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export function toast(input: ToastInput): { id: string; dismiss: () => void } {
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const next: Toast = {
    id,
    variant: "default",
    duration: DEFAULT_DURATION,
    ...input,
  };
  toasts = [...toasts, next];
  emit();
  return { id, dismiss: () => dismissToast(id) };
}

export function useToast() {
  const [current, setCurrent] = React.useState<Toast[]>(toasts);

  React.useEffect(() => subscribe(setCurrent), []);

  return {
    toasts: current,
    toast,
    dismiss: dismissToast,
  };
}
