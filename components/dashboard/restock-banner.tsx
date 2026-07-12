import Link from "next/link";
import { ShoppingCart, ChevronRight } from "lucide-react";
import { getRestockWarnings } from "@/lib/restock";

const t = {
  title: "Restock soon",
} as const;

/**
 * Dashboard shopping nudge (owner-approved): care shortfalls ("short 1 tube
 * for Flea treatment"), low stock, expiring meds. Server Component; renders
 * nothing when there's nothing to buy — zero noise on good days.
 */
export async function RestockBanner() {
  const warnings = await getRestockWarnings();
  if (warnings.length === 0) return null;

  return (
    <Link
      href="/inventory"
      className="block rounded-2xl border p-3.5"
      // The color tokens are plain hsl() strings — Tailwind alpha modifiers
      // (bg-warning/10) silently no-op on them, so alpha goes inline.
      style={{
        backgroundColor: "hsl(var(--warning) / 0.12)",
        borderColor: "hsl(var(--warning) / 0.4)",
      }}
    >
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-4 w-4 shrink-0 text-warning-strong" />
        <span className="text-sm font-semibold text-foreground">{t.title}</span>
        <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {warnings.map((w) => (
          <li key={w.itemId} className="text-sm text-muted-foreground">
            {w.text}
          </li>
        ))}
      </ul>
    </Link>
  );
}

export default RestockBanner;
