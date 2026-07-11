import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import type { AppUser } from "@/lib/types";

/**
 * Resolves the signed-in Supabase user to an ACTIVE app_users row (SPEC §4).
 * - No Supabase session → null.
 * - Session but email not an active member → null (caller sends them to /not-a-member).
 * - First login: fills auth_sub + display_name on the member row.
 * Cached per-request so layouts/pages share one lookup.
 */
export const getCurrentAppUser = cache(async (): Promise<AppUser | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const email = user?.email?.toLowerCase();
  if (!user || !email) return null;

  const admin = db();
  const { data: member } = await admin
    .from("app_users")
    .select("id, auth_sub, email, display_name, is_active")
    .eq("email", email)
    .eq("is_active", true)
    .maybeSingle();

  if (!member) return null;

  // First successful login for this member: attach the auth id + a display name.
  if (!member.auth_sub) {
    const displayName =
      member.display_name ||
      (user.user_metadata?.full_name as string | undefined) ||
      user.user_metadata?.name ||
      email.split("@")[0];
    await admin
      .from("app_users")
      .update({ auth_sub: user.id, display_name: displayName })
      .eq("id", member.id);
    member.display_name = displayName;
  }

  return {
    id: member.id,
    email: member.email,
    display_name: member.display_name,
  };
});

/** Server-side guard: returns the member or redirects. Use in the (app) layout. */
export async function requireAppUser(): Promise<AppUser> {
  const member = await getCurrentAppUser();
  if (!member) {
    // Signed in but not a member → dedicated page; not signed in → middleware already redirected.
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    redirect(user ? "/not-a-member" : "/login");
  }
  return member;
}
