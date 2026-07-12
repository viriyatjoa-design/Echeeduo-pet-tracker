"use server";

import { db } from "@/lib/db";
import { getCurrentAppUser } from "@/lib/auth";
import { getLookupsByCategory, getAllLookups } from "@/lib/lookups";
import { nextDueDate, expandMedCourse } from "@/lib/care";
import { todayInTz } from "@/lib/time";
import { revalidatePath } from "next/cache";
import type { CareEvent } from "@/lib/types";

/**
 * Care engine mutations (SPEC §6.2). One engine for all scheduled care:
 * one-off events, recurring events (interval_days), and med courses (bulk doses).
 */

function clean(v: string | null | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}

/** Positive integer or null (for interval_days / duration). */
function posIntOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Revalidate every surface that shows care: dashboard, /care, cat profiles. */
function revalidate() {
  // "layout" scope covers "/", "/care" and the dynamic "/cats/[id]" routes.
  revalidatePath("/", "layout");
}

/**
 * Consume qty per dose: 0.5-steps ≥ 0.5 (owner: dewormer is 1 pill or half a
 * pill; flea is 1 tube). Returns null when no item is linked.
 */
function consumeQtyOrNull(
  itemId: string | null | undefined,
  qty: number | string | null | undefined,
): { itemId: string; qty: number } | null {
  const id = clean(itemId);
  if (!id) return null;
  const n = Math.round(Number(qty) * 2) / 2;
  if (!Number.isFinite(n) || n < 0.5) {
    throw new Error("Amount used must be at least 0.5.");
  }
  return { itemId: id, qty: n };
}

/**
 * Best-effort inventory consumption for a completed care event (migration 006).
 * Bookkeeping must NEVER block care: any failure here (item gone, inventory
 * not migrated, lookup missing) is swallowed — stock can be fixed via Adjust.
 */
async function consumeForCareEvent(
  eventId: string,
  itemId: string,
  qty: number,
  byUserId: string,
): Promise<void> {
  try {
    const database = db();
    const all = await getAllLookups();
    const reason = all.find(
      (l) => l.category === "stock_reason" && l.code === "consumption",
    );
    if (!reason) return;

    const { data: item } = await database
      .from("inventory_items")
      .select("id, quantity")
      .eq("id", itemId)
      .eq("is_active", true)
      .maybeSingle();
    if (!item) return;

    const { error: moveErr } = await database.from("stock_movements").insert({
      item_id: itemId,
      delta: -qty,
      reason_id: reason.id,
      ref_entity_type: "care_event",
      ref_entity_id: eventId,
      created_by: byUserId,
    });
    if (moveErr) return;

    // Cached quantity clamps at 0 — the ledger keeps the true delta.
    const newQty = Math.max(
      0,
      Math.round((Number(item.quantity) - qty) * 10) / 10,
    );
    await database
      .from("inventory_items")
      .update({ quantity: newQty })
      .eq("id", itemId);
  } catch {
    // Best-effort by design.
  }
}

export type CreateCareEventInput = {
  cat_id: string;
  event_type_id: string;
  title: string;
  due_date?: string | null;
  due_time?: string | null;
  interval_days?: number | string | null;
  vet_name?: string | null;
  notes?: string | null;
  consume_item_id?: string | null;
  consume_qty?: number | string | null;
};

export async function createCareEvent(input: CreateCareEventInput) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  if (!input.cat_id) throw new Error("Please pick a cat.");
  if (!input.event_type_id) throw new Error("Please pick an event type.");
  const title = clean(input.title);
  if (!title) throw new Error("Title is required.");

  const consume = consumeQtyOrNull(input.consume_item_id, input.consume_qty);

  const row: Record<string, unknown> = {
    cat_id: input.cat_id,
    event_type_id: input.event_type_id,
    title,
    due_date: clean(input.due_date),
    due_time: clean(input.due_time),
    interval_days: posIntOrNull(input.interval_days),
    vet_name: clean(input.vet_name),
    notes: clean(input.notes),
    created_by: me.id,
  };
  // Only send the 006 columns when actually linking — pre-migration, sending
  // them (even as null) would make PostgREST reject EVERY create.
  if (consume) {
    row.consume_item_id = consume.itemId;
    row.consume_qty = consume.qty;
  }

  const { error } = await db().from("care_events").insert(row);
  if (error) {
    // Migration 006 adds the consume columns — degrade to an unlinked event.
    if (consume && /consume_item_id|consume_qty|column/i.test(error.message)) {
      throw new Error(
        "Inventory link needs migration 006_care_consume.sql — run it in the Supabase SQL Editor, or save without the inventory link.",
      );
    }
    throw new Error(error.message);
  }

  revalidate();
}

/**
 * Remove an event from every view — soft delete (SPEC §2.6: never hard-delete).
 * Works on open AND completed events; use it to clean up mistakes (accidental
 * "Done", duplicate entries). The row stays in the DB with is_active = false.
 */
export async function removeCareEvent(id: string) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");
  if (!id) throw new Error("Missing event id.");

  const { error } = await db()
    .from("care_events")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidate();
}

export type LogPastCareEventInput = {
  cat_id: string;
  event_type_id: string;
  title: string;
  /** 'YYYY-MM-DD' — the day the care actually happened (in the past). */
  done_date: string;
  interval_days?: number | string | null;
  vet_name?: string | null;
  notes?: string | null;
  consume_item_id?: string | null;
  consume_qty?: number | string | null;
};

/**
 * Record care that ALREADY happened (e.g. historical vaccinations from the vet
 * booklet): inserts a completed event dated on the actual done date, and — if
 * an interval is given — schedules the next open occurrence at done + interval,
 * chaining from the historical date (not today).
 */
export async function logPastCareEvent(input: LogPastCareEventInput) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  if (!input.cat_id) throw new Error("Please pick a cat.");
  if (!input.event_type_id) throw new Error("Please pick an event type.");
  const title = clean(input.title);
  if (!title) throw new Error("Title is required.");
  const doneDate = clean(input.done_date);
  if (!doneDate || !/^\d{4}-\d{2}-\d{2}$/.test(doneDate)) {
    throw new Error("Please pick the date it was done.");
  }
  if (doneDate > todayInTz()) {
    throw new Error("That date is in the future — use a regular event instead.");
  }

  const interval = posIntOrNull(input.interval_days);
  const vetName = clean(input.vet_name);
  const consume = consumeQtyOrNull(input.consume_item_id, input.consume_qty);
  const database = db();

  // Completed historical record. done_at is stored at noon Jakarta on the done
  // date so it renders as that day regardless of timezone conversion.
  // NOTE: no stock is consumed for the historical record — that stock was used
  // before tracking started; the link only matters for FUTURE completions.
  const pastRow: Record<string, unknown> = {
    cat_id: input.cat_id,
    event_type_id: input.event_type_id,
    title,
    due_date: doneDate,
    done_at: `${doneDate}T12:00:00+07:00`,
    interval_days: interval,
    vet_name: vetName,
    notes: clean(input.notes),
    created_by: me.id,
  };
  if (consume) {
    pastRow.consume_item_id = consume.itemId;
    pastRow.consume_qty = consume.qty;
  }
  const { error } = await database.from("care_events").insert(pastRow);
  if (error) throw new Error(error.message);

  // Chain the next occurrence from the HISTORICAL date. May land in the past —
  // that's correct: it shows as overdue, which is true.
  let next: string | null = null;
  if (interval != null) {
    next = nextDueDate(doneDate, interval);
    const nextRow: Record<string, unknown> = {
      cat_id: input.cat_id,
      event_type_id: input.event_type_id,
      title,
      due_date: next,
      interval_days: interval,
      vet_name: vetName,
      created_by: me.id,
    };
    if (consume) {
      nextRow.consume_item_id = consume.itemId;
      nextRow.consume_qty = consume.qty;
    }
    const { error: insErr } = await database.from("care_events").insert(nextRow);
    if (insErr) throw new Error(insErr.message);
  }

  revalidate();
  return { nextDueDate: next };
}

/**
 * Complete an event: set done_at = now(). If it was recurring (interval_days
 * set), chain the next occurrence from the ACTUAL completion date (today in
 * Jakarta) + interval_days. Returns the next due date when one was created.
 */
export async function completeCareEvent(
  id: string,
): Promise<{ nextDueDate: string | null }> {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");
  if (!id) throw new Error("Missing event id.");

  const database = db();
  const { data: event, error: fetchErr } = await database
    .from("care_events")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr) throw new Error(fetchErr.message);
  const e = event as CareEvent;

  // Guard against double-completion (two phones tapping the same chip): only
  // transition rows that are still open, and only chain if WE closed it.
  const { data: closed, error } = await database
    .from("care_events")
    .update({ done_at: new Date().toISOString() })
    .eq("id", id)
    .is("done_at", null)
    .select("id");
  if (error) throw new Error(error.message);
  if (!closed || closed.length === 0) {
    // Someone else already completed it — no-op, don't fork the chain.
    revalidate();
    return { nextDueDate: null };
  }

  // Inventory hook (migration 006): the ✓ IS the consumption event — flea tube,
  // dewormer pill, etc. Best-effort; never blocks completing care.
  if (e.consume_item_id && e.consume_qty) {
    await consumeForCareEvent(e.id, e.consume_item_id, Number(e.consume_qty), me.id);
  }

  let next: string | null = null;
  if (e.interval_days != null) {
    next = nextDueDate(todayInTz(), e.interval_days);
    const nextRow: Record<string, unknown> = {
      cat_id: e.cat_id,
      event_type_id: e.event_type_id,
      title: e.title,
      due_date: next,
      interval_days: e.interval_days,
      vet_name: e.vet_name,
      created_by: me.id,
    };
    // The chain carries the inventory link so next month consumes too.
    // (undefined = column doesn't exist yet, pre-006 — don't send it.)
    if (e.consume_item_id) {
      nextRow.consume_item_id = e.consume_item_id;
      nextRow.consume_qty = e.consume_qty ?? null;
    }
    const { error: insErr } = await database.from("care_events").insert(nextRow);
    if (insErr) throw new Error(insErr.message);
  }

  revalidate();
  return { nextDueDate: next };
}

export async function rescheduleCareEvent(
  id: string,
  due_date: string,
  due_time?: string | null,
) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");
  if (!id) throw new Error("Missing event id.");

  const date = clean(due_date);
  if (!date) throw new Error("Pick a new due date.");

  const { error } = await db()
    .from("care_events")
    .update({ due_date: date, due_time: clean(due_time) })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidate();
}

export type CreateMedCourseInput = {
  cat_id: string;
  medicine_name: string;
  start_date: string;
  duration_days: number | string;
  times: string[]; // ['08:00','20:00']
  consume_item_id?: string | null;
  /** Amount used per dose (e.g. 0.5 pill). */
  consume_qty?: number | string | null;
};

/**
 * Med course (SPEC §6.2): bulk-insert one 'medicine'-type open event per dose
 * (duration_days × times). Each dose is a normal event to tick off.
 */
export async function createMedCourse(input: CreateMedCourseInput) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  if (!input.cat_id) throw new Error("Please pick a cat.");
  const name = clean(input.medicine_name);
  if (!name) throw new Error("Medicine name is required.");
  const start = clean(input.start_date);
  if (!start) throw new Error("Pick a start date.");

  const duration = posIntOrNull(input.duration_days);
  if (!duration) throw new Error("Duration must be at least 1 day.");

  const times = (input.times ?? []).map((t) => clean(t)).filter(Boolean) as string[];
  if (times.length === 0) throw new Error("Add at least one dose time.");

  // Resolve the 'medicine' lookup id (zero-code extensibility — read, don't hardcode).
  const careTypes = await getLookupsByCategory("care_event_type");
  const medType = careTypes.find((l) => l.code === "medicine");
  if (!medType) throw new Error("The 'medicine' care type is missing from lookups.");

  const consume = consumeQtyOrNull(input.consume_item_id, input.consume_qty);

  const rows = expandMedCourse(start, duration, times).map((dose) => {
    const row: Record<string, unknown> = {
      cat_id: input.cat_id,
      event_type_id: medType.id,
      title: name,
      due_date: dose.due_date,
      due_time: dose.due_time,
      interval_days: null,
      created_by: me.id,
    };
    // Each dose consumes on its own ✓ (pre-006: don't send the columns).
    if (consume) {
      row.consume_item_id = consume.itemId;
      row.consume_qty = consume.qty;
    }
    return row;
  });

  const { error } = await db().from("care_events").insert(rows);
  if (error) {
    if (consume && /consume_item_id|consume_qty|column/i.test(error.message)) {
      throw new Error(
        "Inventory link needs migration 006_care_consume.sql — run it in the Supabase SQL Editor, or save without the inventory link.",
      );
    }
    throw new Error(error.message);
  }

  revalidate();
}
