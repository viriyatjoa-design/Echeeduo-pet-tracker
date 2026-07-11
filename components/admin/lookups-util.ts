// Small pure helpers shared by the /admin/lists client pieces. No "use client"
// directive so it stays a plain module (safe to import from any client component).

/** Normalize free text into a stable machine code: lowercase, a-z0-9_ only. */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_") // runs of anything-else collapse to one "_"
    .replace(/^_+|_+$/g, ""); // trim leading/trailing underscores
}

/** 'care_event_type' → 'Care Event Type' for display in the category picker. */
export function humanizeCategory(category: string): string {
  return category
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
