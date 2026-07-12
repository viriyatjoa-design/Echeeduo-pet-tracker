"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CalendarCheck,
  Home,
  NotebookPen,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { strings } from "@/lib/strings";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const items: NavItem[] = [
  { href: "/", label: strings.nav.today, icon: Home },
  { href: "/care", label: strings.nav.care, icon: CalendarCheck },
  { href: "/journal", label: strings.nav.journal, icon: NotebookPen },
  { href: "/catalog", label: strings.nav.catalog, icon: BookOpen },
  { href: "/settings", label: strings.nav.settings, icon: Settings },
];

// Sub-routes highlight their owning tab so "where am I" survives in
// standalone PWA mode (no URL bar).
const TAB_PREFIXES: Record<string, string[]> = {
  "/": ["/cats", "/log"],
  "/catalog": ["/inventory"],
  "/settings": ["/admin"],
};

function isActive(pathname: string, href: string) {
  if (pathname === href) return true;
  if (href !== "/" && pathname.startsWith(href + "/")) return true;
  return (TAB_PREFIXES[href] ?? []).some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 px-1 py-1.5 text-[11px] font-semibold transition-colors",
                  active
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {/* Active tab sits in a blue-milk pill (soft-wellness). */}
                <span
                  className={cn(
                    "flex h-7 w-14 items-center justify-center rounded-full transition-colors",
                    active && "bg-secondary text-primary",
                  )}
                >
                  <Icon
                    className={cn("h-5 w-5", active && "stroke-[2.25]")}
                    aria-hidden
                  />
                </span>
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
