import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { getInventoryItems } from "@/lib/inventory-queries";
import { todayInTz, addDaysToDate, formatDate, relativeDay } from "@/lib/time";
import { formatQty } from "@/components/inventory/format";

/**
 * Restock warnings (owner-approved): cross what the CARE ENGINE knows about
 * the future (linked events due soon, migration 006) with what INVENTORY
 * knows about the present (stock on hand) — plus the existing low-stock and
 * expiry signals. Rendered on the dashboard and fed to the morning report.
 * SERVER ONLY; returns [] whenever inventory (003/006) isn't set up.
 */

/** How far ahead linked care events are counted against stock. */
const CARE_HORIZON_DAYS = 30;

export type RestockWarning = {
  itemId: string;
  /** One human line, e.g. "Fipronil: short 1 tube for Flea treatment (in 6 days)". */
  text: string;
};

export const getRestockWarnings = cache(
  async (): Promise<RestockWarning[]> => {
    const items = await getInventoryItems();
    if (items.length === 0) return [];
    const itemById = new Map(items.map((i) => [i.id, i]));

    const today = todayInTz();
    const warnings: RestockWarning[] = [];
    const warned = new Set<string>();

    // 1) Care shortfall: linked open events due within the horizon need more
    //    than what's on hand. Pre-006 the select fails on the missing columns —
    //    skip this signal, keep the others.
    const { data: careRows } = await db()
      .from("care_events")
      .select("consume_item_id, consume_qty, title, due_date")
      .eq("is_active", true)
      .is("done_at", null)
      .not("consume_item_id", "is", null)
      .not("due_date", "is", null)
      .lte("due_date", addDaysToDate(today, CARE_HORIZON_DAYS));

    if (careRows) {
      const neededByItem = new Map<
        string,
        { qty: number; first: { title: string; due: string } }
      >();
      for (const r of careRows as {
        consume_item_id: string;
        consume_qty: number | null;
        title: string;
        due_date: string;
      }[]) {
        const qty = Number(r.consume_qty ?? 0);
        if (qty <= 0) continue;
        const cur = neededByItem.get(r.consume_item_id);
        if (!cur) {
          neededByItem.set(r.consume_item_id, {
            qty,
            first: { title: r.title, due: r.due_date },
          });
        } else {
          cur.qty += qty;
          if (r.due_date < cur.first.due) {
            cur.first = { title: r.title, due: r.due_date };
          }
        }
      }
      for (const [itemId, need] of neededByItem) {
        const item = itemById.get(itemId);
        if (!item) continue;
        const shortBy = Math.round((need.qty - item.quantity) * 10) / 10;
        if (shortBy <= 0) continue;
        warnings.push({
          itemId,
          text: `${item.name}: short ${formatQty(shortBy)} ${item.unitCode} for ${need.first.title} (${relativeDay(need.first.due)})`,
        });
        warned.add(itemId);
      }
    }

    // 2) Running low (existing days-left vs reorder threshold, which now also
    //    covers opened-a-pack items since 'opened' counts as usage).
    for (const item of items) {
      if (warned.has(item.id) || !item.low) continue;
      warnings.push({
        itemId: item.id,
        text:
          item.daysLeft === 0
            ? `${item.name}: runs out today`
            : `${item.name}: ~${item.daysLeft} days left`,
      });
      warned.add(item.id);
    }

    // 3) Expiring soon (meds mostly).
    for (const item of items) {
      if (warned.has(item.id) || !item.expiringSoon || !item.expiry) continue;
      warnings.push({
        itemId: item.id,
        text: `${item.name}: expires ${formatDate(item.expiry)}`,
      });
      warned.add(item.id);
    }

    return warnings;
  },
);
