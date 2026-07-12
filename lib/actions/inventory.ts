"use server";

import { db } from "@/lib/db";
import { getCurrentAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { getAllLookups } from "@/lib/lookups";
import {
  getItemMovements,
  type StockMovementView,
} from "@/lib/inventory-queries";

/**
 * Inventory mutations (SPEC §11). Stock is a cached `quantity` on the item plus
 * an append-only `stock_movements` ledger. PostgREST gives us no transactions,
 * so every stock change is two statements: insert the MOVEMENT first (the
 * ledger is the record), then update the cached quantity — and if the update
 * fails, best-effort soft-delete the movement (same pattern as lib/storage.ts).
 *
 * The app may run before migration 003 exists in the DB — table-missing errors
 * ('PGRST205' / '42P01') surface as a friendly setup message, never a raw 500.
 */

// Slice-local copy (BUILD_BRIEF: don't edit lib/strings.ts).
const t = {
  notSetUp: "Inventory isn't set up yet — run migration 003 (see SETUP.md).",
  needs006: "Run migration 006_care_consume.sql first (see SETUP.md).",
  noneSealed: "No packs left in stock — log a purchase first.",
  openedNote: "Opened a pack",
  unauthorized: "Unauthorized",
  nameRequired: "Please give the item a name.",
  typeRequired: "Please pick an item type.",
  unitRequired: "Please pick a unit.",
  itemNotFound: "Item not found.",
  qtyNotNegative: "Quantity can't be negative.",
  qtyPositive: "Amount must be greater than 0.",
  costNotNegative: "Cost can't be negative.",
  reorderPositive: "Reorder alert must be at least 1 day.",
  deltaNonZero: "Adjustment amount can't be zero.",
  belowZero: "That would take stock below zero — check the amount.",
  openingStock: "Opening stock",
  genericFail: "Something went wrong — please try again.",
} as const;

// ── Small helpers ─────────────────────────────────────────────────────────────

function clean(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return s.length ? s : null;
}

/** numeric(10,1) — keep deltas/quantities to one decimal like the column. */
function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function numOrNull(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Whole IDR (bigint column) — round, reject negatives. */
function idrOrNull(v: number | null | undefined): number | null {
  const n = numOrNull(v);
  if (n == null) return null;
  const idr = Math.round(n);
  if (idr < 0) throw new Error(t.costNotNegative);
  return idr;
}

function isTableMissing(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  return /could not find the table|does not exist/i.test(error.message ?? "");
}

/** Throw a friendly error for a Supabase failure (setup message if 003 missing). */
function fail(
  error: { code?: string; message?: string } | null | undefined,
): never {
  if (isTableMissing(error)) throw new Error(t.notSetUp);
  throw new Error(error?.message ?? t.genericFail);
}

/**
 * Result type for the mutating actions (SPEC §11). Next.js strips thrown Error
 * messages from Server Actions in production, so these actions RETURN their
 * outcome instead of throwing — mirror lib/actions/ai.ts.
 */
export type ActionResult = { ok: true } | { ok: false; error: string };

/** Map a Supabase failure to the friendly string (setup message if 003 missing). */
function failMsg(
  error: { code?: string; message?: string } | null | undefined,
): string {
  if (isTableMissing(error)) return t.notSetUp;
  return error?.message ?? t.genericFail;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : t.genericFail;
}

async function requireMe() {
  const me = await getCurrentAppUser();
  if (!me) throw new Error(t.unauthorized);
  return me;
}

/** Resolve a stock_reason lookup id by code — never hardcode uuids. */
async function stockReasonId(
  code: "purchase" | "adjustment" | "expired" | "opened",
): Promise<string> {
  const all = await getAllLookups();
  const row = all.find(
    (l) => l.category === "stock_reason" && l.code === code,
  );
  if (!row) {
    // 'opened' is seeded by 006; the rest by 003.
    throw new Error(code === "opened" ? t.needs006 : t.notSetUp);
  }
  return row.id;
}

function revalidate() {
  revalidatePath("/inventory");
  revalidatePath("/catalog");
}

// ── Items ─────────────────────────────────────────────────────────────────────

export async function createItem(input: {
  name: string;
  item_type_id: string;
  unit_id: string;
  food_id?: string | null;
  quantity?: number | null;
  cost_per_unit?: number | null;
  reorder_days?: number | null;
  expiry?: string | null;
  notes?: string | null;
}): Promise<ActionResult> {
  try {
    const me = await requireMe();

    const name = clean(input.name);
    if (!name) return { ok: false, error: t.nameRequired };
    if (!input.item_type_id) return { ok: false, error: t.typeRequired };
    if (!input.unit_id) return { ok: false, error: t.unitRequired };

    const rawQty = numOrNull(input.quantity) ?? 0;
    if (rawQty < 0) return { ok: false, error: t.qtyNotNegative };
    const quantity = round1(rawQty);

    const cost = idrOrNull(input.cost_per_unit);
    const reorderRaw = numOrNull(input.reorder_days);
    const reorder = reorderRaw == null ? null : Math.round(reorderRaw);
    if (reorder != null && reorder < 1) {
      return { ok: false, error: t.reorderPositive };
    }

    const database = db();
    // Resolve the ledger reason BEFORE creating the item so a lookup failure
    // can't leave an item without its opening movement. Opening stock is an
    // 'adjustment', not a 'purchase' — seeding a half-used bag must not count
    // toward this month's spending (getMonthlySpend counts purchases only).
    const openingReasonId =
      quantity > 0 ? await stockReasonId("adjustment") : null;
    if (quantity > 0 && !openingReasonId) {
      return { ok: false, error: t.notSetUp };
    }
    const { data: item, error } = await database
      .from("inventory_items")
      .insert({
        name,
        item_type_id: input.item_type_id,
        unit_id: input.unit_id,
        food_id: clean(input.food_id),
        quantity,
        cost_per_unit: cost,
        reorder_days: reorder,
        expiry: clean(input.expiry),
        notes: clean(input.notes),
        created_by: me.id,
      })
      .select("id")
      .single();
    if (error || !item) return { ok: false, error: failMsg(error) };

    // Opening stock enters through the ledger too, so history stays consistent.
    if (quantity > 0) {
      const { error: moveErr } = await database.from("stock_movements").insert({
        item_id: item.id,
        delta: quantity,
        reason_id: openingReasonId,
        unit_cost: null,
        notes: t.openingStock,
        created_by: me.id,
      });
      if (moveErr) {
        // Best-effort rollback: hide the half-created item rather than leave an
        // item whose quantity has no ledger entry.
        await database
          .from("inventory_items")
          .update({ is_active: false })
          .eq("id", item.id);
        return { ok: false, error: failMsg(moveErr) };
      }
    }

    revalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

/**
 * Partial update — only keys present in `input` are written (undefined = leave
 * as-is, null = clear). NOTE: editing `quantity` here is a direct correction
 * and writes NO movement — prefer purchaseStock/adjustStock for stock changes.
 */
export async function updateItem(
  id: string,
  input: {
    name?: string;
    item_type_id?: string;
    unit_id?: string;
    food_id?: string | null;
    quantity?: number | null;
    cost_per_unit?: number | null;
    reorder_days?: number | null;
    expiry?: string | null;
    notes?: string | null;
  },
): Promise<ActionResult> {
  try {
    await requireMe();
    if (!id) return { ok: false, error: t.itemNotFound };

    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) {
      const name = clean(input.name);
      if (!name) return { ok: false, error: t.nameRequired };
      patch.name = name;
    }
    if (input.item_type_id !== undefined) {
      if (!input.item_type_id) return { ok: false, error: t.typeRequired };
      patch.item_type_id = input.item_type_id;
    }
    if (input.unit_id !== undefined) {
      if (!input.unit_id) return { ok: false, error: t.unitRequired };
      patch.unit_id = input.unit_id;
    }
    if (input.food_id !== undefined) patch.food_id = clean(input.food_id);
    if (input.quantity !== undefined) {
      const q = numOrNull(input.quantity);
      if (q == null || q < 0) return { ok: false, error: t.qtyNotNegative };
      patch.quantity = round1(q);
    }
    if (input.cost_per_unit !== undefined) {
      patch.cost_per_unit = idrOrNull(input.cost_per_unit);
    }
    if (input.reorder_days !== undefined) {
      const raw = numOrNull(input.reorder_days);
      const reorder = raw == null ? null : Math.round(raw);
      if (reorder != null && reorder < 1) {
        return { ok: false, error: t.reorderPositive };
      }
      patch.reorder_days = reorder;
    }
    if (input.expiry !== undefined) patch.expiry = clean(input.expiry);
    if (input.notes !== undefined) patch.notes = clean(input.notes);
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await db()
      .from("inventory_items")
      .update(patch)
      .eq("id", id);
    if (error) return { ok: false, error: failMsg(error) };

    revalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

/** Soft show/hide (SPEC: never hard-delete). */
export async function setItemActive(id: string, active: boolean): Promise<void> {
  await requireMe();
  if (!id) throw new Error(t.itemNotFound);

  const { error } = await db()
    .from("inventory_items")
    .update({ is_active: active })
    .eq("id", id);
  if (error) fail(error);

  revalidate();
}

// ── Stock movements ───────────────────────────────────────────────────────────

/**
 * Record a purchase: +qty movement with a unit-cost snapshot (provided cost, or
 * the item's latest known cost), then bump the cached quantity. A provided
 * unit_cost also becomes the item's new latest cost_per_unit.
 */
export async function purchaseStock(input: {
  item_id: string;
  qty: number;
  unit_cost?: number | null;
  notes?: string | null;
}): Promise<ActionResult> {
  try {
    const me = await requireMe();

    const qty = round1(Number(input.qty));
    if (!Number.isFinite(qty) || qty <= 0) {
      return { ok: false, error: t.qtyPositive };
    }
    const unitCost = idrOrNull(input.unit_cost);

    const database = db();
    const { data: item, error: itemErr } = await database
      .from("inventory_items")
      .select("id, quantity, cost_per_unit")
      .eq("id", input.item_id)
      .maybeSingle();
    if (itemErr) return { ok: false, error: failMsg(itemErr) };
    if (!item) return { ok: false, error: t.itemNotFound };

    const snapshot =
      unitCost ?? (item.cost_per_unit == null ? null : Math.round(Number(item.cost_per_unit)));

    // Ledger first, cache second (see module comment).
    const { data: movement, error: moveErr } = await database
      .from("stock_movements")
      .insert({
        item_id: item.id,
        delta: qty,
        reason_id: await stockReasonId("purchase"),
        unit_cost: snapshot,
        notes: clean(input.notes),
        created_by: me.id,
      })
      .select("id")
      .single();
    if (moveErr || !movement) return { ok: false, error: failMsg(moveErr) };

    const patch: Record<string, unknown> = {
      quantity: round1(Number(item.quantity) + qty),
    };
    if (unitCost != null) patch.cost_per_unit = unitCost;

    const { error: updErr } = await database
      .from("inventory_items")
      .update(patch)
      .eq("id", item.id);
    if (updErr) {
      // Best-effort rollback: soft-delete the orphaned movement.
      await database
        .from("stock_movements")
        .update({ is_active: false })
        .eq("id", movement.id);
      return { ok: false, error: failMsg(updErr) };
    }

    revalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

/**
 * Manual correction or expired/discarded stock. `delta` may be negative
 * (usually is); rejected with a friendly error if it would take stock below 0.
 */
export async function adjustStock(input: {
  item_id: string;
  delta: number;
  reason: "adjustment" | "expired";
  notes?: string | null;
}): Promise<ActionResult> {
  try {
    const me = await requireMe();

    const delta = round1(Number(input.delta));
    if (!Number.isFinite(delta) || delta === 0) {
      return { ok: false, error: t.deltaNonZero };
    }
    // Server actions are network-callable — don't trust the TS type at runtime.
    if (input.reason !== "adjustment" && input.reason !== "expired") {
      return { ok: false, error: t.genericFail };
    }

    const database = db();
    const { data: item, error: itemErr } = await database
      .from("inventory_items")
      .select("id, quantity")
      .eq("id", input.item_id)
      .maybeSingle();
    if (itemErr) return { ok: false, error: failMsg(itemErr) };
    if (!item) return { ok: false, error: t.itemNotFound };

    const newQty = round1(Number(item.quantity) + delta);
    if (newQty < 0) return { ok: false, error: t.belowZero };

    // Ledger first, cache second (see module comment).
    const { data: movement, error: moveErr } = await database
      .from("stock_movements")
      .insert({
        item_id: item.id,
        delta,
        reason_id: await stockReasonId(input.reason),
        notes: clean(input.notes),
        created_by: me.id,
      })
      .select("id")
      .single();
    if (moveErr || !movement) return { ok: false, error: failMsg(moveErr) };

    const { error: updErr } = await database
      .from("inventory_items")
      .update({ quantity: newQty })
      .eq("id", item.id);
    if (updErr) {
      // Best-effort rollback: soft-delete the orphaned movement.
      await database
        .from("stock_movements")
        .update({ is_active: false })
        .eq("id", movement.id);
      return { ok: false, error: failMsg(updErr) };
    }

    revalidate();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errMsg(err) };
  }
}

/**
 * "Opened a pack" (owner-approved Option A): stock counts UNOPENED packs;
 * opening one is the consumption event (−1, reason 'opened'). Days-left then
 * derives from opening cadence — no per-scoop/per-pad logging ever.
 */
export async function openOnePack(itemId: string): Promise<void> {
  const me = await requireMe();
  if (!itemId) throw new Error(t.itemNotFound);

  const database = db();
  const { data: item, error: itemErr } = await database
    .from("inventory_items")
    .select("id, quantity")
    .eq("id", itemId)
    .maybeSingle();
  if (itemErr) fail(itemErr);
  if (!item) throw new Error(t.itemNotFound);

  const qty = Number(item.quantity);
  if (qty < 1) throw new Error(t.noneSealed);

  // Ledger first, cache second (see module comment).
  const { data: movement, error: moveErr } = await database
    .from("stock_movements")
    .insert({
      item_id: item.id,
      delta: -1,
      reason_id: await stockReasonId("opened"),
      notes: t.openedNote,
      created_by: me.id,
    })
    .select("id")
    .single();
  if (moveErr || !movement) fail(moveErr);

  const { error: updErr } = await database
    .from("inventory_items")
    .update({ quantity: round1(qty - 1) })
    .eq("id", item.id);
  if (updErr) {
    await database
      .from("stock_movements")
      .update({ is_active: false })
      .eq("id", movement.id);
    fail(updErr);
  }

  revalidate();
  revalidatePath("/"); // restock banner on the dashboard
}

/**
 * Read action so the History dialog can fetch on open instead of the page
 * prefetching every item's movements (avoids N+1 on /inventory).
 */
export async function getItemMovementsAction(
  itemId: string,
  limit = 30,
): Promise<StockMovementView[]> {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");
  return getItemMovements(itemId, limit);
}
