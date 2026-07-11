"use server";

import { db } from "@/lib/db";
import { getCurrentAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { UUID } from "@/lib/types";

/**
 * Shape of the create/edit cat form (SPEC §7). Mirrors the editable columns of
 * the `cats` table; `photo_path` is handled separately by the attachments
 * uploader (Phase C), and `is_active` is toggled via {@link setCatActive}.
 */
export type CatInput = {
  name: string;
  sex: "male" | "female" | null;
  birth_date: string | null;
  breed: string;
  neutered: boolean;
  microchip_no: string | null;
  weight_target_grams: number | null;
  bcs_target_min: number;
  bcs_target_max: number;
  daily_kcal_override: number | null;
  accent_index: number;
  notes: string | null;
};

function normalize(input: CatInput) {
  const name = input.name.trim();
  if (!name) throw new Error("A name is required.");
  return {
    name,
    sex: input.sex,
    birth_date: input.birth_date || null,
    breed: input.breed.trim() || "British Shorthair",
    neutered: input.neutered,
    microchip_no: input.microchip_no?.trim() || null,
    weight_target_grams: input.weight_target_grams ?? null,
    bcs_target_min: input.bcs_target_min,
    bcs_target_max: input.bcs_target_max,
    daily_kcal_override: input.daily_kcal_override ?? null,
    accent_index: input.accent_index,
    notes: input.notes?.trim() || null,
  };
}

function revalidateAll() {
  // "/" as layout covers the dashboard, /settings and any /cats/[id] route.
  revalidatePath("/", "layout");
}

export async function createCat(input: CatInput) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  const { error } = await db().from("cats").insert(normalize(input));
  if (error) throw new Error(error.message);

  revalidateAll();
}

export async function updateCat(id: UUID, input: CatInput) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  const { error } = await db()
    .from("cats")
    .update(normalize(input))
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidateAll();
}

export async function setCatActive(id: UUID, active: boolean) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  const { error } = await db()
    .from("cats")
    .update({ is_active: active })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidateAll();
}
