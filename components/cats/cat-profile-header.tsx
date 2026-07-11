import type { Cat } from "@/lib/types";
import { todayInTz, daysBetween } from "@/lib/time";
import { gramsToKg } from "@/lib/weight";
import { CatAvatar } from "@/components/cats/cat-avatar";
import { CatForm } from "@/components/cats/cat-form";
import { Badge } from "@/components/ui/badge";

const t = {
  neutered: "Neutered",
  intact: "Intact",
  male: "Male",
  female: "Female",
  weightTarget: "Target",
  kg: "kg",
  bcs: "BCS",
  kcalAuto: "kcal auto",
  kcalDay: "kcal/day",
  chip: "Chip",
} as const;

/** Human age from a 'YYYY-MM-DD' birth date, e.g. "2 yr 3 mo" / "5 mo". */
function ageLabel(birthDate: string): string | null {
  const days = daysBetween(birthDate, todayInTz());
  if (days < 0) return null;
  const years = Math.floor(days / 365);
  const months = Math.floor((days % 365) / 30);
  if (years >= 1) return months > 0 ? `${years} yr ${months} mo` : `${years} yr`;
  if (months >= 1) return `${months} mo`;
  return "< 1 mo";
}

/**
 * Presentational profile header for a cat (used by the Phase C `/cats/[id]`
 * page). Server-safe; renders the client {@link CatForm} for its Edit button.
 */
export function CatProfileHeader({
  cat,
  photoUrl,
}: {
  cat: Cat;
  photoUrl?: string;
}) {
  const sex = cat.sex === "male" ? t.male : cat.sex === "female" ? t.female : null;
  const age = cat.birth_date ? ageLabel(cat.birth_date) : null;
  const meta = [cat.breed, sex, age].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        <div
          className="rounded-full p-0.5"
          style={{ boxShadow: `0 0 0 2px hsl(var(--cat-${cat.accent_index}) / 0.5)` }}
        >
          <CatAvatar cat={cat} url={photoUrl} size={72} />
        </div>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">
            {cat.name}
          </h1>
          {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
          <div className="mt-1">
            <Badge variant={cat.neutered ? "secondary" : "outline"}>
              {cat.neutered ? t.neutered : t.intact}
            </Badge>
          </div>
        </div>

        <CatForm cat={cat} />
      </div>

      <div className="flex flex-wrap gap-2">
        {cat.weight_target_grams != null && (
          <Badge variant="outline">
            {t.weightTarget} {gramsToKg(cat.weight_target_grams)} {t.kg}
          </Badge>
        )}
        <Badge variant="outline">
          {t.bcs} {cat.bcs_target_min}–{cat.bcs_target_max}
        </Badge>
        <Badge variant="outline">
          {cat.daily_kcal_override != null
            ? `${cat.daily_kcal_override} ${t.kcalDay}`
            : t.kcalAuto}
        </Badge>
        {cat.microchip_no && (
          <Badge variant="outline">
            {t.chip} {cat.microchip_no}
          </Badge>
        )}
      </div>

      {cat.notes && (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {cat.notes}
        </p>
      )}
    </div>
  );
}
