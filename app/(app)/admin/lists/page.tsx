import { requireAppUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLookupCategories } from "@/lib/lookups";
import type { Lookup } from "@/lib/types";
import { ListsManager } from "@/components/admin/lists-manager";

const t = {
  title: "Lists",
  subtitle:
    "Every dropdown in the app reads from here. Add a category or entry — no code, no redeploy.",
} as const;

/**
 * /admin/lists — the generic lookups manager (SPEC §7). Proves the "add anything
 * = one row, zero code" principle (SPEC §2.2). We read rows directly (including
 * inactive ones, so they can be reactivated) — getAllLookups() filters to active
 * only, so it isn't used for this admin view.
 */
export default async function AdminListsPage() {
  await requireAppUser();

  const categories = await getLookupCategories();

  const { data, error } = await db()
    .from("lookups")
    .select("id, category, code, label, sort_order, is_active")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;

  const lookups = (data ?? []) as Lookup[];

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t.title}
        </h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </header>

      <ListsManager categories={categories} lookups={lookups} />
    </div>
  );
}
