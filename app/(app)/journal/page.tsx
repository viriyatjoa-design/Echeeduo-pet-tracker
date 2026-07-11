import { requireAppUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getJournalEntries, type JournalEntry } from "@/lib/observation-queries";
import { getLookupsByCategory } from "@/lib/lookups";
import { formatDateTime } from "@/lib/time";
import { strings } from "@/lib/strings";
import type { Cat } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AttachmentGallery } from "@/components/attachments/attachment-gallery";
import {
  JournalList,
  type JournalRowVM,
} from "@/components/observation/journal-list";
import { LitterForm } from "@/components/observation/litter-form";
import { SymptomForm } from "@/components/observation/symptom-form";

const t = {
  title: "Journal",
  subtitle: "The household's litter, water, and symptom log — newest first.",
  household: "Household",
  water: "Water",
  litter: "Litter",
  symptom: "Symptom",
  urine: "Urine",
  stool: "Stool",
  ml: "ml",
  sev: ["Mild", "Moderate", "Severe"] as const,
} as const;

export default async function JournalPage() {
  await requireAppUser();

  const database = db();
  const [entries, catsRes, stoolConsistencies, symptomTypes] =
    await Promise.all([
      getJournalEntries({}),
      database.from("cats").select("*").eq("is_active", true).order("name"),
      getLookupsByCategory("stool_consistency"),
      getLookupsByCategory("symptom_type"),
    ]);

  const cats = (catsRes.data ?? []) as Cat[];
  const catById = new Map(cats.map((c) => [c.id, c]));

  const rows: JournalRowVM[] = entries.map((e) => ({
    id: `${e.kind}-${e.id}`,
    catId: e.cat_id,
    node: <JournalRow entry={e} cat={e.cat_id ? catById.get(e.cat_id) : undefined} />,
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t.title}
          </h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <LitterForm cats={cats} stoolConsistencies={stoolConsistencies} />
        <SymptomForm cats={cats} symptomTypes={symptomTypes} />
      </div>

      <JournalList cats={cats} rows={rows} />
    </div>
  );
}

/** One journal row (Server Component so its photo gallery can sign URLs). */
async function JournalRow({
  entry,
  cat,
}: {
  entry: JournalEntry;
  cat?: Cat;
}) {
  const who = cat ? cat.name : t.household;

  const typeLabel =
    entry.kind === "water"
      ? t.water
      : entry.kind === "litter"
        ? t.litter
        : t.symptom;

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{typeLabel}</Badge>
            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
              {cat && (
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: `hsl(var(--cat-${cat.accent_index}))` }}
                  aria-hidden
                />
              )}
              {who}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDateTime(entry.at)}
          </span>
        </div>

        <JournalDetails entry={entry} />

        {(entry.kind === "litter" || entry.kind === "symptom") && (
          <AttachmentGallery
            entityType={entry.kind === "litter" ? "litter_log" : "symptom_log"}
            entityId={entry.id}
            deletable={false}
          />
        )}

        <p className="text-xs text-muted-foreground">
          {strings.common.by} {entry.by}
        </p>
      </CardContent>
    </Card>
  );
}

function JournalDetails({ entry }: { entry: JournalEntry }) {
  if (entry.kind === "water") {
    return (
      <p className="text-sm text-foreground">
        {entry.ml} {t.ml}
      </p>
    );
  }

  if (entry.kind === "litter") {
    return (
      <div className="space-y-1">
        <div className="flex flex-wrap gap-1.5">
          {entry.urine && <Badge variant="outline">{t.urine}</Badge>}
          {entry.stool && (
            <Badge variant="outline">
              {t.stool}
              {entry.stool_consistency_label
                ? ` · ${entry.stool_consistency_label}`
                : ""}
            </Badge>
          )}
        </div>
        {entry.notes && (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {entry.notes}
          </p>
        )}
      </div>
    );
  }

  // symptom
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-medium text-foreground">
          {entry.symptom_label}
        </span>
        {entry.severity != null && (
          <Badge
            variant={
              entry.severity >= 3
                ? "destructive"
                : entry.severity === 2
                  ? "warning"
                  : "secondary"
            }
          >
            {entry.severity} · {t.sev[entry.severity - 1]}
          </Badge>
        )}
      </div>
      {entry.notes && (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {entry.notes}
        </p>
      )}
    </div>
  );
}
