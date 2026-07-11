"use server";

import { db } from "@/lib/db";
import { getCurrentAppUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { UUID } from "@/lib/types";

/**
 * Add a household member (SPEC §4). Inserts an `app_users` row with a
 * lowercased email and `auth_sub` = null, so the person can sign in later with
 * no redeploy — their first magic-link login attaches the auth id.
 */
export async function addMember(input: { email: string; display_name: string }) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  const email = input.email.trim().toLowerCase();
  const display_name = input.display_name.trim();
  if (!email || !email.includes("@")) throw new Error("Enter a valid email.");
  if (!display_name) throw new Error("Enter a display name.");

  // Friendly duplicate check (email is unique in the DB).
  const { data: existing } = await db()
    .from("app_users")
    .select("id, is_active")
    .eq("email", email)
    .maybeSingle();
  if (existing) {
    throw new Error(
      existing.is_active
        ? "That email is already a member."
        : "That email exists but is deactivated — reactivate them instead.",
    );
  }

  const { error } = await db()
    .from("app_users")
    .insert({ email, display_name, auth_sub: null });
  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}

export async function setMemberActive(id: UUID, active: boolean) {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  const { error } = await db()
    .from("app_users")
    .update({ is_active: active })
    .eq("id", id);
  if (error) throw new Error(error.message);

  revalidatePath("/", "layout");
}
