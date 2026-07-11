import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { Lookup } from "@/lib/types";

/**
 * All active lookups, fetched once per request (SPEC §8.2). Every dropdown/category
 * in the app reads from here — adding a care/food/symptom type = one row, zero code.
 */
export const getAllLookups = cache(async (): Promise<Lookup[]> => {
  const { data, error } = await db()
    .from("lookups")
    .select("id, category, code, label, sort_order, is_active")
    .eq("is_active", true)
    .order("category")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as Lookup[];
});

export const getLookupsByCategory = cache(
  async (category: string): Promise<Lookup[]> => {
    const all = await getAllLookups();
    return all.filter((l) => l.category === category);
  },
);

/**
 * id → Lookup map for rendering labels on EXISTING records. Includes inactive
 * rows on purpose: deactivating a lookup hides it from dropdowns (which use
 * the active-only helpers above) but must not erase labels from history.
 */
export const getLookupMap = cache(async (): Promise<Map<string, Lookup>> => {
  const { data, error } = await db()
    .from("lookups")
    .select("id, category, code, label, sort_order, is_active");
  if (error) throw error;
  return new Map(((data ?? []) as Lookup[]).map((l) => [l.id, l]));
});

/** Distinct categories present (for the /admin/lists category picker). */
export const getLookupCategories = cache(async (): Promise<string[]> => {
  const { data, error } = await db()
    .from("lookups")
    .select("category")
    .order("category");
  if (error) throw error;
  return Array.from(new Set((data ?? []).map((r) => r.category as string)));
});
