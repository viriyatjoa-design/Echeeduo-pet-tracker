import "server-only";

import { cache } from "react";
import { db } from "@/lib/db";
import { getAllLookups, getLookupMap } from "@/lib/lookups";
import { todayInTz, addDaysToDate, daysBetween } from "@/lib/time";
import type { InventoryItem, StockMovement } from "@/lib/types";

/**
 * Read helpers for Milestone 2 inventory (SPEC §11). All derivations happen ON
 * READ (days-left, low-stock, expiring-soon, monthly spend) — the DB stores only
 * items + a movements ledger.
 *
 * GRACEFUL DEGRADATION: the app may be deployed before migration 003 has been
 * run. When the inventory tables don't exist, PostgREST fails with 'PGRST205'
 * (schema cache) or Postgres '42P01' (undefined_table). Every read here detects
 * that and returns an empty result instead of throwing, so pages render an
 * "inventory not set up yet" state rather than a 500.
 */

/** Trailing window (days) for average daily consumption (SPEC §11). */
const TRAILING_DAYS = 14;
/** An expiry within this many days counts as "expiring soon". */
const EXPIRY_SOON_DAYS = 14;

// ── Table-missing detection ──────────────────────────────────────────────────

function isTableMissing(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  return /could not find the table|does not exist/i.test(error.message ?? "");
}

/**
 * UTC instant of Jakarta midnight for a 'YYYY-MM-DD'. Asia/Jakarta is a fixed
 * UTC+7 with no DST, so the literal offset is always correct.
 */
function jakartaStartOfDayUtc(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00+07:00`).toISOString();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Resolve a stock_reason lookup id by code — never hardcode uuids. */
async function stockReasonId(code: string): Promise<string | null> {
  const all = await getAllLookups();
  return (
    all.find((l) => l.category === "stock_reason" && l.code === code)?.id ?? null
  );
}

// ── Readiness probe ──────────────────────────────────────────────────────────

/**
 * True once migration 003 has been run (inventory tables exist). Cached per
 * request; layouts/pages share one probe.
 */
export const isInventoryReady = cache(async (): Promise<boolean> => {
  const { error } = await db().from("inventory_items").select("id").limit(1);
  return !isTableMissing(error);
});

// ── Items with derived stock intel ───────────────────────────────────────────

export type InventoryItemView = InventoryItem & {
  typeLabel: string;
  unitLabel: string;
  unitCode: string;
  foodName: string | null;
  /** Units consumed per day, trailing 14 d avg (2 dp); null if no usage yet. */
  avgDailyUse: number | null;
  /** quantity ÷ avgDailyUse, rounded down; null if no usage yet. */
  daysLeft: number | null;
  /** reorder_days set AND daysLeft known AND daysLeft <= reorder_days. */
  low: boolean;
  /** expiry set and within 14 days (already-expired counts too). */
  expiringSoon: boolean;
};

/**
 * Active items (A→Z) with labels + derived stock intel, in one items query,
 * one trailing-14-day consumption query, one food_catalog query, plus the
 * request-cached lookup map. Returns [] when inventory isn't set up yet.
 */
export const getInventoryItems = cache(
  async (): Promise<InventoryItemView[]> => {
    const database = db();

    const itemsRes = await database
      .from("inventory_items")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (itemsRes.error) {
      if (isTableMissing(itemsRes.error)) return [];
      throw new Error(itemsRes.error.message);
    }
    const items = (itemsRes.data ?? []) as InventoryItem[];
    if (items.length === 0) return [];

    const today = todayInTz();
    // Window = the last (TRAILING_DAYS - 1) full Jakarta days + today so far
    // ≈ TRAILING_DAYS days; -TRAILING_DAYS would span ~15 days but divide by 14.
    const windowStart = jakartaStartOfDayUtc(
      addDaysToDate(today, -(TRAILING_DAYS - 1)),
    );
    const consumptionId = await stockReasonId("consumption");
    const foodIds = Array.from(
      new Set(items.map((i) => i.food_id).filter((id): id is string => !!id)),
    );

    const [lookupMap, consumption, foods] = await Promise.all([
      getLookupMap(),
      fetchConsumptionRows(consumptionId, windowStart),
      fetchFoodNames(foodIds),
    ]);

    // Units consumed per item over the window (consumption deltas are negative).
    const consumedByItem = new Map<string, number>();
    for (const m of consumption) {
      consumedByItem.set(
        m.item_id,
        (consumedByItem.get(m.item_id) ?? 0) + -Number(m.delta),
      );
    }

    return items.map((raw) => {
      const item: InventoryItem = {
        ...raw,
        quantity: Number(raw.quantity),
        cost_per_unit:
          raw.cost_per_unit == null ? null : Number(raw.cost_per_unit),
        reorder_days:
          raw.reorder_days == null ? null : Number(raw.reorder_days),
      };
      const type = lookupMap.get(item.item_type_id);
      const unit = lookupMap.get(item.unit_id);

      const consumed = consumedByItem.get(item.id) ?? 0;
      const avg = consumed > 0 ? consumed / TRAILING_DAYS : null;
      const daysLeft = avg != null ? Math.floor(item.quantity / avg) : null;
      const low =
        item.reorder_days != null &&
        daysLeft != null &&
        daysLeft <= item.reorder_days;
      const expiringSoon =
        item.expiry != null && daysBetween(today, item.expiry) <= EXPIRY_SOON_DAYS;

      return {
        ...item,
        typeLabel: type?.label ?? "—",
        unitLabel: unit?.label ?? "—",
        unitCode: unit?.code ?? "",
        foodName: item.food_id ? (foods.get(item.food_id) ?? null) : null,
        avgDailyUse: avg == null ? null : round2(avg),
        daysLeft,
        low,
        expiringSoon,
      };
    });
  },
);

async function fetchConsumptionRows(
  consumptionId: string | null,
  windowStart: string,
): Promise<{ item_id: string; delta: number }[]> {
  if (!consumptionId) return []; // lookups not seeded → no ledger yet
  const { data, error } = await db()
    .from("stock_movements")
    .select("item_id, delta")
    .eq("reason_id", consumptionId)
    .eq("is_active", true)
    .lt("delta", 0)
    .gte("moved_at", windowStart);
  if (error) {
    if (isTableMissing(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []) as { item_id: string; delta: number }[];
}

async function fetchFoodNames(foodIds: string[]): Promise<Map<string, string>> {
  if (foodIds.length === 0) return new Map();
  const { data, error } = await db()
    .from("food_catalog")
    .select("id, name")
    .in("id", foodIds);
  if (error) throw new Error(error.message);
  return new Map(
    (data ?? []).map((f) => [f.id as string, f.name as string]),
  );
}

// ── Monthly spend (SPEC §11: purchases by category, whole IDR) ───────────────

export type MonthlySpend = {
  /** 'YYYY-MM' — the current Jakarta month. */
  month: string;
  /** Whole IDR spent this month. */
  total: number;
  /** Per inventory_type label, largest first. Only types with spend appear. */
  byType: { label: string; idr: number }[];
};

/**
 * Purchases in the current Jakarta calendar month. Spend per movement =
 * round(delta × (movement unit_cost snapshot ?? item's latest cost ?? 0)).
 * Empty result when inventory isn't set up yet.
 */
export const getMonthlySpend = cache(async (): Promise<MonthlySpend> => {
  const month = todayInTz().slice(0, 7);
  const empty: MonthlySpend = { month, total: 0, byType: [] };

  const purchaseId = await stockReasonId("purchase");
  if (!purchaseId) return empty; // migration 003 seeds this lookup

  const monthStart = `${month}-01`;
  // Day 1 + 32 days always lands in the next month.
  const nextMonthStart = `${addDaysToDate(monthStart, 32).slice(0, 7)}-01`;

  const { data, error } = await db()
    .from("stock_movements")
    .select("item_id, delta, unit_cost")
    .eq("reason_id", purchaseId)
    .eq("is_active", true)
    .gt("delta", 0)
    .gte("moved_at", jakartaStartOfDayUtc(monthStart))
    .lt("moved_at", jakartaStartOfDayUtc(nextMonthStart));
  if (error) {
    if (isTableMissing(error)) return empty;
    throw new Error(error.message);
  }
  const purchases = data ?? [];
  if (purchases.length === 0) return empty;

  const itemIds = Array.from(new Set(purchases.map((p) => p.item_id as string)));
  const [lookupMap, itemsRes] = await Promise.all([
    getLookupMap(),
    db()
      .from("inventory_items")
      .select("id, item_type_id, cost_per_unit")
      .in("id", itemIds),
  ]);
  if (itemsRes.error) throw new Error(itemsRes.error.message);
  const itemMap = new Map(
    (itemsRes.data ?? []).map((i) => [
      i.id as string,
      i as { id: string; item_type_id: string; cost_per_unit: number | null },
    ]),
  );

  let total = 0;
  const byLabel = new Map<string, number>();
  for (const p of purchases) {
    const item = itemMap.get(p.item_id as string);
    // bigint arrives as number/string depending on driver — Number() both ways.
    const unitCost = Number(p.unit_cost ?? item?.cost_per_unit ?? 0);
    const idr = Math.round(Number(p.delta) * unitCost);
    if (idr === 0) continue;
    total += idr;
    const label =
      (item && lookupMap.get(item.item_type_id)?.label) ?? "Other";
    byLabel.set(label, (byLabel.get(label) ?? 0) + idr);
  }

  return {
    month,
    total,
    byType: Array.from(byLabel, ([label, idr]) => ({ label, idr })).sort(
      (a, b) => b.idr - a.idr,
    ),
  };
});

// ── Movement history for one item ────────────────────────────────────────────

export type StockMovementView = StockMovement & {
  reasonLabel: string;
  reasonCode: string;
  /** Display name of whoever recorded the movement. */
  by: string;
};

/**
 * Recent active movements for an item (newest first) with reason labels and
 * mover names (one batched app_users query). [] when not set up yet.
 */
export async function getItemMovements(
  itemId: string,
  limit = 30,
): Promise<StockMovementView[]> {
  const database = db();
  const { data, error } = await database
    .from("stock_movements")
    .select("*")
    .eq("item_id", itemId)
    .eq("is_active", true)
    .order("moved_at", { ascending: false })
    .limit(limit);
  if (error) {
    if (isTableMissing(error)) return [];
    throw new Error(error.message);
  }
  const rows = (data ?? []) as StockMovement[];
  if (rows.length === 0) return [];

  const userIds = Array.from(new Set(rows.map((r) => r.created_by)));
  const [lookupMap, usersRes] = await Promise.all([
    getLookupMap(),
    database.from("app_users").select("id, display_name").in("id", userIds),
  ]);
  const userMap = new Map(
    (usersRes.data ?? []).map((u) => [
      u.id as string,
      u.display_name as string,
    ]),
  );

  return rows.map((r) => {
    const reason = lookupMap.get(r.reason_id);
    return {
      ...r,
      delta: Number(r.delta),
      unit_cost: r.unit_cost == null ? null : Number(r.unit_cost),
      reasonLabel: reason?.label ?? "—",
      reasonCode: reason?.code ?? "",
      by: userMap.get(r.created_by) ?? "—",
    };
  });
}

// ── Low-stock count (dashboard badge) ────────────────────────────────────────

/** Number of items whose days-left has hit their reorder threshold. */
export const getLowStockCount = cache(async (): Promise<number> => {
  const items = await getInventoryItems();
  return items.filter((i) => i.low).length;
});
