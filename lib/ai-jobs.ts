"use client";

import * as React from "react";

/**
 * App-wide in-flight AI job tracker (owner-reported: the loading state died
 * on navigation, making it look like the analysis was lost — it wasn't; the
 * server action keeps running and saves its result). Component state unmounts
 * with the page; this module doesn't. Components subscribe by job key, so the
 * spinner survives navigating away and back while the AI works.
 *
 * Keys: "morning-report", `health:{catId}:analysis`, `health:{catId}:vet`,
 * `litter:{litterLogId}`.
 */

const running = new Set<string>();
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function startAIJob(key: string) {
  running.add(key);
  emit();
}

export function endAIJob(key: string) {
  running.delete(key);
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** True while the given AI job runs — across mounts/unmounts/navigation. */
export function useAIJob(key: string): boolean {
  return React.useSyncExternalStore(
    subscribe,
    () => running.has(key),
    () => false,
  );
}
