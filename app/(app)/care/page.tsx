import { requireAppUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLookupsByCategory } from "@/lib/lookups";
import { getOpenCareEvents, getCareTypeLabels } from "@/lib/care-queries";
import { bucketCareEvents } from "@/lib/care";
import { relativeDay } from "@/lib/time";
import type { Cat } from "@/lib/types";
import type { CareEventWithCat } from "@/lib/care-queries";
import { CatAvatar } from "@/components/cats/cat-avatar";
import { CareEventForm } from "@/components/care/care-event-form";
import { MedCourseForm } from "@/components/care/med-course-form";
import { CompleteButton } from "@/components/care/complete-button";
import { RescheduleForm } from "@/components/care/reschedule-form";
import { strings } from "@/lib/strings";

const t = {
  subtitle: "What's due and overdue across all cats.",
} as const;

/** HH:MM from a 'HH:MM:SS' / 'HH:MM' time string. */
function shortTime(time: string | null): string | null {
  return time ? time.slice(0, 5) : null;
}

function CareRow({
  event,
  typeLabels,
  showDate = true,
}: {
  event: CareEventWithCat;
  typeLabels: Map<string, string>;
  /** false inside date-grouped sections (the group header already says it). */
  showDate?: boolean;
}) {
  const time = shortTime(event.due_time);
  const meta = [
    showDate && event.due_date ? relativeDay(event.due_date) : null,
    time,
  ]
    .filter(Boolean)
    .join(" · ");

  // Stacked layout: text gets the full card width (no one-letter titles on a
  // phone); actions sit on their own row with full-size tap targets.
  return (
    <li className="space-y-2 rounded-2xl border border-border bg-card p-3">
      <div className="flex items-center gap-3">
        <CatAvatar cat={event.cat} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] uppercase tracking-wide text-muted-foreground">
            {typeLabels.get(event.event_type_id) ?? "Care"}
            {event.cat?.name ? ` · ${event.cat.name}` : ""}
          </p>
          <p className="truncate font-medium text-foreground">{event.title}</p>
          {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1">
        <RescheduleForm
          id={event.id}
          dueDate={event.due_date}
          dueTime={event.due_time}
          iconOnly
        />
        <CompleteButton id={event.id} className="min-w-28" />
      </div>
    </li>
  );
}

export default async function CarePage() {
  await requireAppUser();

  const [events, typeLabels, careTypes, catsRes] = await Promise.all([
    getOpenCareEvents(),
    getCareTypeLabels(),
    getLookupsByCategory("care_event_type"),
    db().from("cats").select("*").eq("is_active", true).order("name"),
  ]);

  const cats = (catsRes.data ?? []) as Cat[];
  const { overdue, today, upcoming, anytime } = bucketCareEvents(events);

  // Group the (already date-sorted) upcoming events by due_date.
  const upcomingGroups: { date: string; events: CareEventWithCat[] }[] = [];
  for (const e of upcoming) {
    const key = e.due_date!;
    const last = upcomingGroups[upcomingGroups.length - 1];
    if (last && last.date === key) last.events.push(e);
    else upcomingGroups.push({ date: key, events: [e] });
  }

  const nothingOpen =
    overdue.length === 0 &&
    today.length === 0 &&
    upcoming.length === 0 &&
    anytime.length === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {strings.care.title}
          </h1>
          <p className="text-sm text-muted-foreground">{t.subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <CareEventForm cats={cats} careTypes={careTypes} />
        <MedCourseForm cats={cats} />
      </div>

      {nothingOpen && (
        <div className="rounded-2xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {strings.care.noneOpen}
        </div>
      )}

      {overdue.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-destructive">
            {strings.care.overdue}
          </h2>
          <ul className="space-y-2">
            {overdue.map((e) => (
              <CareRow key={e.id} event={e} typeLabels={typeLabels} />
            ))}
          </ul>
        </section>
      )}

      {today.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-warning-strong">
            {strings.care.dueToday}
          </h2>
          <ul className="space-y-2">
            {today.map((e) => (
              <CareRow
                key={e.id}
                event={e}
                typeLabels={typeLabels}
                showDate={false}
              />
            ))}
          </ul>
        </section>
      )}

      {anytime.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-foreground">Anytime</h2>
          <ul className="space-y-2">
            {anytime.map((e) => (
              <CareRow key={e.id} event={e} typeLabels={typeLabels} />
            ))}
          </ul>
        </section>
      )}

      {upcomingGroups.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {strings.care.upcoming}
          </h2>
          {upcomingGroups.map((group) => (
            <div key={group.date} className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {relativeDay(group.date)}
              </p>
              <ul className="space-y-2">
                {group.events.map((e) => (
                  <CareRow
                    key={e.id}
                    event={e}
                    typeLabels={typeLabels}
                    showDate={false}
                  />
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
