/**
 * Friendly message for a failed Server Action *invocation*. After every
 * deploy, a PWA still open in the background runs the previous bundle, whose
 * server-action IDs no longer exist — Next.js then throws
 * 'Server Action "<hash>" was not found on the server'. Translate that to the
 * one instruction that actually fixes it. Client-safe, no imports.
 */
export function actionErrorMessage(err: unknown, fallback: string): string {
  const msg = err instanceof Error ? err.message : "";
  if (/was not found on the server|failed to find.*server action/i.test(msg)) {
    return "The app just updated — fully close it (swipe away) and reopen, then try again.";
  }
  return msg || fallback;
}
