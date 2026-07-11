import "server-only";
import { db } from "@/lib/db";

/**
 * Feeding → inventory consumption hook (SPEC §11, app-level — not a trigger).
 * Saving a feeding whose food is linked to an active inventory item inserts a
 * -grams 'consumption' stock movement and decrements the item's quantity.
 *
 * BEST-EFFORT BY DESIGN: the live app may not have migration 003 applied yet
 * (missing tables → PostgREST 'PGRST205' / Postgres '42P01'). Any failure here
 * — missing table, missing lookup, network, anything — is swallowed with a
 * console.warn. This function NEVER throws; feeding must always succeed.
 */
export async function consumeForFeedings(
  rows: { food_id: string; grams: number; feeding_log_id?: string | null }[],
  createdBy: string,
): Promise<void> {
  try {
    if (!rows || rows.length === 0) return;

    const database = db();
    const foodIds = Array.from(new Set(rows.map((r) => r.food_id)));

    // One query: active inventory items linked to any fed food. Foods without
    // a stocked item simply match nothing and are skipped.
    const { data: items, error: itemsErr } = await database
      .from("inventory_items")
      .select("id, food_id, quantity")
      .in("food_id", foodIds)
      .eq("is_active", true);
    if (itemsErr) throw new Error(itemsErr.message);
    if (!items || items.length === 0) return;

    // One query: resolve the 'consumption' stock_reason lookup id (never hardcoded).
    const { data: reason, error: reasonErr } = await database
      .from("lookups")
      .select("id")
      .eq("category", "stock_reason")
      .eq("code", "consumption")
      .maybeSingle();
    if (reasonErr) throw new Error(reasonErr.message);
    if (!reason) throw new Error("stock_reason/consumption lookup not found");

    const itemsByFood = new Map<string, { id: string; quantity: number }[]>();
    for (const item of items) {
      const list = itemsByFood.get(item.food_id as string) ?? [];
      list.push({ id: item.id as string, quantity: Number(item.quantity) });
      itemsByFood.set(item.food_id as string, list);
    }

    // Build all movements + tally per-item consumed grams in one pass.
    const movements: Record<string, unknown>[] = [];
    const consumedByItem = new Map<string, number>();
    for (const row of rows) {
      const grams = Number(row.grams);
      if (!Number.isFinite(grams) || grams <= 0) continue;
      for (const item of itemsByFood.get(row.food_id) ?? []) {
        movements.push({
          item_id: item.id,
          delta: -grams,
          reason_id: reason.id,
          ref_entity_type: "feeding_log",
          ref_entity_id: row.feeding_log_id ?? null,
          created_by: createdBy,
        });
        consumedByItem.set(item.id, (consumedByItem.get(item.id) ?? 0) + grams);
      }
    }
    if (movements.length === 0) return;

    // One bulk insert for all movements.
    const { error: moveErr } = await database
      .from("stock_movements")
      .insert(movements);
    if (moveErr) throw new Error(moveErr.message);

    // Decrement each affected item's quantity (floored at 0).
    const quantityByItem = new Map(
      items.map((i) => [i.id as string, Number(i.quantity)]),
    );
    for (const [itemId, consumed] of consumedByItem) {
      const current = quantityByItem.get(itemId) ?? 0;
      const next = Math.max(0, current - consumed);
      const { error: updErr } = await database
        .from("inventory_items")
        .update({ quantity: next })
        .eq("id", itemId);
      if (updErr) throw new Error(updErr.message);
    }
  } catch (err) {
    // Consumption is best-effort: never let inventory break a feeding.
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[inventory] consumption skipped:", message);
  }
}
