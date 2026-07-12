import Link from "next/link";
import { ChevronLeft, Stethoscope } from "lucide-react";
import { requireAppUser } from "@/lib/auth";
import { CARE_GUIDE } from "@/lib/cat-care-facts";
import { Card, CardContent } from "@/components/ui/card";

// Per-request auth (requireAppUser reads the session cookie), so this route
// must render dynamically. Do NOT force-static — that baked the build-time
// "no session → redirect to /login" into the page for everyone.
export const dynamic = "force-dynamic";

const t = {
  back: "Settings",
  title: "Care guide",
  subtitle: "British Shorthair reference — the numbers behind the app.",
  atAGlance: "At a glance",
  watchFor: "Worth mentioning to your vet",
  disclaimer:
    "Reference figures distilled from veterinary sources (WSAVA, AAHA/AAFP, breed studies, and tropical-region guidance for Jakarta). General guidance, not a diagnosis — anything under “worth mentioning” means see your vet.",
} as const;

export default async function CareGuidePage() {
  await requireAppUser();

  return (
    <div className="space-y-4">
      <Link
        href="/settings"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        {t.back}
      </Link>

      <div>
        <h1 className="text-xl font-bold tracking-tight text-foreground">
          {t.title}
        </h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <nav className="flex flex-wrap gap-2">
        {CARE_GUIDE.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full bg-secondary px-3 py-1 text-xs font-semibold text-secondary-foreground"
          >
            {s.title}
          </a>
        ))}
      </nav>

      <div className="space-y-4">
        {CARE_GUIDE.map((s) => (
          <Card key={s.id} id={s.id} className="scroll-mt-20">
            <CardContent className="space-y-3 p-4">
              <div>
                <h2 className="text-base font-bold text-foreground">{s.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{s.blurb}</p>
              </div>

              <dl className="space-y-1.5">
                {s.items.map((it) => (
                  <div
                    key={it.label}
                    className="flex flex-col gap-0.5 border-t border-border pt-1.5 first:border-t-0 first:pt-0 sm:flex-row sm:justify-between sm:gap-3"
                  >
                    <dt className="text-sm font-medium text-foreground">
                      {it.label}
                    </dt>
                    <dd className="text-sm tabular-nums text-muted-foreground sm:text-right">
                      {it.value}
                    </dd>
                  </div>
                ))}
              </dl>

              <div
                className="rounded-xl p-3"
                style={{ backgroundColor: "hsl(var(--warning) / 0.1)" }}
              >
                <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-warning-strong">
                  <Stethoscope className="h-3.5 w-3.5" />
                  {t.watchFor}
                </p>
                <ul className="space-y-1">
                  {s.redFlags.map((r) => (
                    <li key={r} className="text-sm text-foreground">
                      {"•"} {r}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <p className="px-1 pb-2 text-xs text-muted-foreground">{t.disclaimer}</p>
    </div>
  );
}
