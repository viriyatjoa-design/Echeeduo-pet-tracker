// Time helpers. Store UTC (timestamptz); display Asia/Jakarta (SPEC §2.9). Native Intl only.

// Fixed app timezone (SPEC §2.9). Hardcoded — not read from env — because this
// module is bundled into client components too, where non-NEXT_PUBLIC env vars
// are undefined; an env read would silently make server and client disagree.
export const APP_TZ = "Asia/Jakarta";

/** 'YYYY-MM-DD' for "today" in the app timezone. */
export function todayInTz(tz: string = APP_TZ): string {
  // en-CA yields ISO-style YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** 'YYYY-MM-DD' N days from today (in app tz), positive = future. */
export function addDaysToDate(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Whole days b - a (both 'YYYY-MM-DD'). */
export function daysBetween(a: string, b: string): number {
  const da = Date.parse(a + "T00:00:00Z");
  const dbb = Date.parse(b + "T00:00:00Z");
  return Math.round((dbb - da) / 86_400_000);
}

export function formatTime(iso: string, tz: string = APP_TZ): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

export function formatDate(iso: string, tz: string = APP_TZ): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatDateTime(iso: string, tz: string = APP_TZ): string {
  return `${formatDate(iso, tz)} · ${formatTime(iso, tz)}`;
}

/** Human 'Today' / 'Tomorrow' / 'Yesterday' / date for a 'YYYY-MM-DD' due date. */
export function relativeDay(dateStr: string, tz: string = APP_TZ): string {
  const today = todayInTz(tz);
  const diff = daysBetween(today, dateStr);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(dateStr + "T00:00:00Z"));
}
