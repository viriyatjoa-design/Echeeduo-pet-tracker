import { getCatHealth } from "@/lib/observation-queries";
import { entityIdsWithAttachments } from "@/lib/storage";
import { isAIReady } from "@/lib/ai";
import { formatDateTime } from "@/lib/time";
import { strings } from "@/lib/strings";
import type { Cat } from "@/lib/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AttachmentGallery } from "@/components/attachments/attachment-gallery";
import { LitterAnalysis } from "@/components/observation/litter-analysis";
import { WaterChart } from "@/components/observation/water-chart";
import { WaterQuickAdd } from "@/components/observation/water-quick-add";

const t = {
  water: "Water",
  waterDesc: "Intake over the last 14 days.",
  noWater: "No water logged in the last 14 days.",
  symptoms: "Symptoms",
  noSymptoms: "No symptoms logged. That's good news.",
  litter: "Litter",
  litterDesc: "Entries attributed to this cat.",
  noLitter: "No attributed litter entries yet.",
  urine: "Urine",
  stool: "Stool",
  sev: ["Mild", "Moderate", "Severe"] as const,
} as const;

/**
 * Cat-profile health section (SPEC §7): a 14-day water chart, plus a per-cat
 * timeline of symptoms and ATTRIBUTED litter entries (newest first) with photos.
 * Server Component — mount as `<HealthSection cat={cat} />` from `/cats/[id]`.
 */
export async function HealthSection({ cat }: { cat: Cat }) {
  const health = await getCatHealth(cat.id);
  const totalWater = health.water.reduce((sum, d) => sum + d.ml, 0);
  const aiReady = isAIReady();
  const litterWithPhoto = await entityIdsWithAttachments(
    "litter_log",
    health.litter.map((l) => l.id),
  );

  return (
    <div className="space-y-4">
      {/* Water chart + quick add */}
      <Card>
        <CardHeader>
          <CardTitle>{t.water}</CardTitle>
          <CardDescription>{t.waterDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {totalWater > 0 ? (
            <WaterChart data={health.water} accentIndex={cat.accent_index} />
          ) : (
            <p className="text-sm text-muted-foreground">{t.noWater}</p>
          )}
          <WaterQuickAdd cats={[cat]} />
        </CardContent>
      </Card>

      {/* Symptom timeline */}
      <Card>
        <CardHeader>
          <CardTitle>{t.symptoms}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {health.symptoms.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noSymptoms}</p>
          ) : (
            <ul className="space-y-3">
              {health.symptoms.map((s) => (
                <li
                  key={s.id}
                  className="space-y-2 rounded-xl border border-border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground">
                        {s.symptom_label}
                      </span>
                      {s.severity != null && (
                        <Badge
                          variant={
                            s.severity >= 3
                              ? "destructive"
                              : s.severity === 2
                                ? "warning"
                                : "secondary"
                          }
                        >
                          {s.severity} · {t.sev[s.severity - 1]}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(s.at)}
                    </span>
                  </div>
                  {s.notes && (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {s.notes}
                    </p>
                  )}
                  <AttachmentGallery
                    entityType="symptom_log"
                    entityId={s.id}
                    deletable={false}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Attributed litter timeline */}
      <Card>
        <CardHeader>
          <CardTitle>{t.litter}</CardTitle>
          <CardDescription>{t.litterDesc}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {health.litter.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t.noLitter}</p>
          ) : (
            <ul className="space-y-3">
              {health.litter.map((l) => (
                <li
                  key={l.id}
                  className="space-y-2 rounded-xl border border-border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                      {l.urine && <Badge variant="outline">{t.urine}</Badge>}
                      {l.stool && (
                        <Badge variant="outline">
                          {t.stool}
                          {l.stool_consistency_label
                            ? ` · ${l.stool_consistency_label}`
                            : ""}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(l.at)}
                    </span>
                  </div>
                  {l.notes && (
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {l.notes}
                    </p>
                  )}
                  <AttachmentGallery
                    entityType="litter_log"
                    entityId={l.id}
                    // Litter photos are replaceable (upload new + remove old).
                    deletable
                    revalidate={`/cats/${cat.id}`}
                  />
                  <LitterAnalysis
                    litterId={l.id}
                    analysis={l.ai_analysis}
                    analyzedAt={l.ai_analyzed_at}
                    hasPhoto={litterWithPhoto.has(l.id)}
                    aiReady={aiReady}
                  />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default HealthSection;
