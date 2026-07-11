"use server";

import { db } from "@/lib/db";
import { getCurrentAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Lookup } from "@/lib/types";

// The lookups table is the app's extensibility backbone (SPEC §2.2): adding a
// care type / food type / whole new category is one row here, zero code elsewhere.
// Note: `lookups` has no `created_by` column (SPEC §5), so we don't set one.

const SLUG_RE = /^[a-z0-9_]+$/;

/** lowercase, a-z0-9_ only — same rule the client uses to preview codes. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function requireSlug(value: string, field: "category" | "code"): string {
  const slug = slugify(value);
  if (!slug || !SLUG_RE.test(slug)) {
    throw new Error(
      `The ${field} needs to be letters, numbers, or underscores (e.g. "nail_trim").`,
    );
  }
  return slug;
}

async function requireMember() {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");
  return me;
}

function refresh() {
  revalidatePath("/admin/lists");
  revalidatePath("/");
}

/** Postgres unique_violation on unique(category, code). */
function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === "23505";
}

/**
 * Add a row to a category. If `category` is brand new, this creates the whole
 * list (its first row). sort_order = current max within the category + 1.
 * Blank `code` is derived from the label.
 */
export async function createLookup(input: {
  category: string;
  code: string;
  label: string;
}): Promise<void> {
  await requireMember();

  const category = requireSlug(input.category, "category");
  const label = input.label.trim();
  if (!label) throw new Error("Please give this entry a label.");
  const code = requireSlug(input.code.trim() || label, "code");

  const admin = db();

  // Next sort_order = max in this category + 1 (append to the end).
  const { data: last } = await admin
    .from("lookups")
    .select("sort_order")
    .eq("category", category)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sortOrder = ((last?.sort_order as number | undefined) ?? 0) + 1;

  const { error } = await admin
    .from("lookups")
    .insert({ category, code, label, sort_order: sortOrder });

  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error(`"${code}" already exists in this list.`);
    }
    throw new Error(error.message);
  }

  refresh();
}

/** Rename a row (label) and optionally change its code. */
export async function updateLookup(input: {
  id: string;
  label: string;
  code?: string;
}): Promise<void> {
  await requireMember();

  const label = input.label.trim();
  if (!label) throw new Error("Please give this entry a label.");

  const patch: { label: string; code?: string } = { label };
  if (input.code !== undefined) {
    patch.code = requireSlug(input.code.trim() || label, "code");
  }

  const { error } = await db()
    .from("lookups")
    .update(patch)
    .eq("id", input.id);

  if (error) {
    if (isUniqueViolation(error)) {
      throw new Error(`"${patch.code}" already exists in this list.`);
    }
    throw new Error(error.message);
  }

  refresh();
}

/** Soft toggle: deactivate hides a row from app dropdowns; reactivate restores it. */
export async function setLookupActive(
  id: string,
  active: boolean,
): Promise<void> {
  await requireMember();

  const { error } = await db()
    .from("lookups")
    .update({ is_active: active })
    .eq("id", id);

  if (error) throw new Error(error.message);

  refresh();
}

/** Move a row up/down within its category by swapping sort_order with its neighbor. */
export async function moveLookup(
  id: string,
  direction: "up" | "down",
): Promise<void> {
  await requireMember();

  const admin = db();

  const { data: row, error: rowErr } = await admin
    .from("lookups")
    .select("id, category, sort_order")
    .eq("id", id)
    .maybeSingle();
  if (rowErr) throw new Error(rowErr.message);
  if (!row) throw new Error("That entry no longer exists.");

  // All siblings in display order (includes inactive — they're shown and reorderable).
  const { data: siblings, error: sibErr } = await admin
    .from("lookups")
    .select("id, sort_order")
    .eq("category", row.category)
    .order("sort_order", { ascending: true })
    .order("id", { ascending: true });
  if (sibErr) throw new Error(sibErr.message);

  const ordered = (siblings ?? []) as Pick<Lookup, "id" | "sort_order">[];
  const index = ordered.findIndex((s) => s.id === id);
  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || neighborIndex < 0 || neighborIndex >= ordered.length) {
    return; // already at the edge — nothing to do
  }

  const current = ordered[index];
  const neighbor = ordered[neighborIndex];

  // Swap their sort_order values.
  const { error: e1 } = await admin
    .from("lookups")
    .update({ sort_order: neighbor.sort_order })
    .eq("id", current.id);
  if (e1) throw new Error(e1.message);

  const { error: e2 } = await admin
    .from("lookups")
    .update({ sort_order: current.sort_order })
    .eq("id", neighbor.id);
  if (e2) throw new Error(e2.message);

  refresh();
}
