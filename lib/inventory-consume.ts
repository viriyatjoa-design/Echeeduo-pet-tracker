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

    // One query: active inventory items linked to any fed food, oldest first.
    // Foods without a stocked item simply match nothing and are skipped.
    const { data: items, error: itemsErr } = await database
      .from("inventory_items")
      .select("id, food_id, unit_id, quantity, created_at")
      .in("food_id", foodIds)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (itemsErr) throw new Error(itemsErr.message);
    if (!items || items.length === 0) return;

    // One query: the 'consumption' reason + the 'g' unit ids (never hardcoded).
    const { data: lookupRows, error: lookupErr } = await database
      .from("lookups")
      .select("id, category, code")
      .in("category", ["stock_reason", "stock_unit"]);
    if (lookupErr) throw new Error(lookupErr.message);
    const reasonId = (lookupRows ?? []).find(
      (l) => l.category === "stock_reason" && l.code === "consumption",
    )?.id;
    const gramsUnitId = (lookupRows ?? []).find(
      (l) => l.category === "stock_unit" && l.code === "g",
    )?.id;
    if (!reasonId) throw new Error("stock_reason/consumption lookup not found");
    if (!gramsUnitId) throw new Error("stock_unit/g lookup not found");

    // Feeding amounts are grams, so only gram-unit items can be auto-consumed
    // (subtracting 42.5 "pieces" from a pouch box would wipe real stock).
    // If several gram items link the same food, consume from the OLDEST one —
    // the already-opened bag — never from all of them (that would double-count).
    const itemByFood = new Map<string, { id: string; quantity: number }>();
    for (const item of items) {
      if (item.unit_id !== gramsUnitId) continue;
      if (!itemByFood.has(item.food_id as string)) {
        itemByFood.set(item.food_id as string, {
          id: item.id as string,
          quantity: Number(item.quantity),
        });
      }
    }
    if (itemByFood.size === 0) return;

    // Build all movements + tally per-item consumed grams in one pass.
    const movements: Record<string, unknown>[] = [];
    const consumedByItem = new Map<string, number>();
    for (const row of rows) {
      const grams = Number(row.grams);
      if (!Number.isFinite(grams) || grams <= 0) continue;
      const item = itemByFood.get(row.food_id);
      if (!item) continue;
      movements.push({
        item_id: item.id,
        delta: -grams,
        reason_id: reasonId,
        ref_entity_type: "feeding_log",
        ref_entity_id: row.feeding_log_id ?? null,
        created_by: createdBy,
      });
      consumedByItem.set(item.id, (consumedByItem.get(item.id) ?? 0) + grams);
    }
    if (movements.length === 0) return;

    // One bulk insert for all movements; keep the ids to enable per-item rollback.
    const { data: inserted, error: moveErr } = await database
      .from("stock_movements")
      .insert(movements)
      .select("id, item_id");
    if (moveErr) throw new Error(moveErr.message);

    const movementIdsByItem = new Map<string, string[]>();
    for (const m of (inserted ?? []) as { id: string; item_id: string }[]) {
      const list = movementIdsByItem.get(m.item_id) ?? [];
      list.push(m.id);
      movementIdsByItem.set(m.item_id, list);
    }

    // Decrement each affected item's quantity (floored at 0). If an item's
    // update fails, void THAT item's just-inserted movements so its ledger and
    // cached quantity stay consistent — and keep going for the other items
    // (don't throw, or one failure aborts the rest and abandons their movements).
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
      if (updErr) {
        const ids = movementIdsByItem.get(itemId) ?? [];
        if (ids.length) {
          await database
            .from("stock_movements")
            .update({ is_active: false })
            .in("id", ids);
        }
      }
    }
  } catch (err) {
    // Consumption is best-effort: never let inventory break a feeding.
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[inventory] consumption skipped:", message);
  }
}
