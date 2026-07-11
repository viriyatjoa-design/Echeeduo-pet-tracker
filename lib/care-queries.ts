import "server-only";
import { db } from "@/lib/db";
import { getLookupMap } from "@/lib/lookups";
import type { CareEvent, Cat, UUID } from "@/lib/types";

/**
 * Read helpers for the care engine (SPEC §6.2). Server-only — these use the
 * service-role `db()` client. "Open" = done_at is null AND is_active.
 */

/** A care event joined with its cat (for the /care list + profile timeline). */
export type CareEventWithCat = CareEvent & { cat: Cat };

/** All OPEN care events across every active cat, cat row joined in. */
export async function getOpenCareEvents(): Promise<CareEventWithCat[]> {
  const { data, error } = await db()
    .from("care_events")
    .select("*, cat:cats(*)")
    .is("done_at", null)
    .eq("is_active", true)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as CareEventWithCat[];
}

/** Full care history (open + done) for one cat, newest first. */
export async function getCareEventsByCat(cat_id: UUID): Promise<CareEvent[]> {
  const { data, error } = await db()
    .from("care_events")
    .select("*")
    .eq("cat_id", cat_id)
    .eq("is_active", true)
    .order("due_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CareEvent[];
}

/**
 * Open care events grouped by cat, for the dashboard chips. Map value is the
 * cat's open events (the chip component buckets them into overdue/due-today).
 */
export async function getOpenCareByCat(): Promise<Map<UUID, CareEvent[]>> {
  const { data, error } = await db()
    .from("care_events")
    .select("*")
    .is("done_at", null)
    .eq("is_active", true)
    .order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw new Error(error.message);

  const map = new Map<UUID, CareEvent[]>();
  for (const row of (data ?? []) as CareEvent[]) {
    const list = map.get(row.cat_id);
    if (list) list.push(row);
    else map.set(row.cat_id, [row]);
  }
  return map;
}

/** lookup id → label for the 'care_event_type' category (for rendering rows). */
export async function getCareTypeLabels(): Promise<Map<UUID, string>> {
  // Rendering map — includes inactive types so deactivating a care type
  // never blanks labels on existing events.
  const all = await getLookupMap();
  return new Map(
    [...all.values()]
      .filter((l) => l.category === "care_event_type")
      .map((l) => [l.id, l.label]),
  );
}
