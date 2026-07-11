import * as React from "react";
import { getCareEventsByCat, getCareTypeLabels } from "@/lib/care-queries";
import { isOverdue } from "@/lib/care";
import { relativeDay, formatDate } from "@/lib/time";
import { Badge } from "@/components/ui/badge";
import { AttachmentGallery } from "@/components/attachments/attachment-gallery";
import { AttachmentUploader } from "@/components/attachments/attachment-uploader";
import type { UUID } from "@/lib/types";

const t = {
  title: "Care timeline",
  empty: "No care events for this cat yet.",
  done: "Done",
  overdue: "Overdue",
  open: "Open",
  anytime: "Anytime",
} as const;

/** HH:MM from a 'HH:MM:SS' / 'HH:MM' time string. */
function shortTime(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}

/**
 * Server Component: one cat's full care history (open + done), newest first.
 * Each event carries an attachment gallery + uploader for vet notes /
 * prescription photos (entityType "care_event").
 */
export async function CatCareTimeline({ catId }: { catId: UUID }) {
  const [events, typeLabels] = await Promise.all([
    getCareEventsByCat(catId),
    getCareTypeLabels(),
  ]);

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground">{t.title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t.empty}</p>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-semibold text-foreground">{t.title}</h2>
      <ul className="space-y-3">
        {events.map((e) => {
          const done = e.done_at != null;
          const late = isOverdue(e);
          const time = shortTime(e.due_time);
          return (
            <li
              key={e.id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {typeLabels.get(e.event_type_id) ?? "Care"}
                  </p>
                  <p className="truncate font-medium text-foreground">
                    {e.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {done
                      ? `${t.done} · ${formatDate(e.done_at!)}`
                      : e.due_date
                        ? `${relativeDay(e.due_date)}${time ? ` · ${time}` : ""}`
                        : t.anytime}
                  </p>
                </div>
                <Badge
                  variant={done ? "success" : late ? "destructive" : "secondary"}
                >
                  {done ? t.done : late ? t.overdue : t.open}
                </Badge>
              </div>

              {e.vet_name && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {e.vet_name}
                </p>
              )}
              {e.notes && (
                <p className="mt-1 text-sm text-foreground">{e.notes}</p>
              )}

              <div className="mt-3 space-y-2">
                <AttachmentGallery
                  entityType="care_event"
                  entityId={e.id}
                  revalidate={`/cats/${catId}`}
                />
                <AttachmentUploader
                  entityType="care_event"
                  entityId={e.id}
                  revalidate={`/cats/${catId}`}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default CatCareTimeline;
