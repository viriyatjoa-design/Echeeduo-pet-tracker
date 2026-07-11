"use server";

import { db } from "@/lib/db";
import { getCurrentAppUser } from "@/lib/auth";
import { getLookupsByCategory } from "@/lib/lookups";
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

export type CreateCareEventInput = {
  cat_id: string;
  event_type_id: string;
  title: string;
  due_date?: string | null;
  due_time?: string | null;
  interval_days?: number | string | null;
  vet_name?: string | null;
  notes?: string | null;
};

export async function createCareEvent(input: CreateCareEventInput) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  if (!input.cat_id) throw new Error("Please pick a cat.");
  if (!input.event_type_id) throw new Error("Please pick an event type.");
  const title = clean(input.title);
  if (!title) throw new Error("Title is required.");

  const row = {
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

  const { error } = await db().from("care_events").insert(row);
  if (error) throw new Error(error.message);

  revalidate();
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

  const { error } = await database
    .from("care_events")
    .update({ done_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);

  let next: string | null = null;
  if (e.interval_days != null) {
    next = nextDueDate(todayInTz(), e.interval_days);
    const { error: insErr } = await database.from("care_events").insert({
      cat_id: e.cat_id,
      event_type_id: e.event_type_id,
      title: e.title,
      due_date: next,
      interval_days: e.interval_days,
      vet_name: e.vet_name,
      created_by: me.id,
    });
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

  const rows = expandMedCourse(start, duration, times).map((dose) => ({
    cat_id: input.cat_id,
    event_type_id: medType.id,
    title: name,
    due_date: dose.due_date,
    due_time: dose.due_time,
    interval_days: null,
    created_by: me.id,
  }));

  const { error } = await db().from("care_events").insert(rows);
  if (error) throw new Error(error.message);

  revalidate();
}
