import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { requireAppUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isAIReady } from "@/lib/ai";
import { getLatestBrief } from "@/lib/briefs";
import { listAttachments } from "@/lib/storage";
import { strings } from "@/lib/strings";
import { getLookupsByCategory } from "@/lib/lookups";
import {
  getTodayKcalByCat,
  get7DayKcalSeriesByCat,
  empty7DayKcalSeries,
  getMRUFoodIds,
  getRecentFoodIdsByCat,
} from "@/lib/feeding-queries";
import { getWeightLogsByCat } from "@/lib/weight-queries";
import { getTodayWaterByCat } from "@/lib/observation-queries";
import { getOpenCareByCat, getCareTypeLabels } from "@/lib/care-queries";
import { dailyTarget, exceedsTreatLimit } from "@/lib/kcal";
import { weightTrend } from "@/lib/weight";
import { formatDate } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { FeedAllDialog } from "@/components/feed/feed-all-dialog";
import { CatCard } from "@/components/dashboard/cat-card";
import { MorningReportCard } from "@/components/ai/morning-report-card";
import { RestockBanner } from "@/components/dashboard/restock-banner";
import { QuickLogFab } from "@/components/dashboard/quick-log-fab";
import type { Cat, Food, MealTemplate, MealTemplateItem } from "@/lib/types";

const t = {
  greeting: (name: string) => `Hi, ${name}`,
  emptyTitle: "No cats yet",
  emptyBody: "Add your first cat in Settings to start tracking their day.",
  goToSettings: "Open Settings",
} as const;

export default async function TodayPage() {
  const member = await requireAppUser();
  const database = db();

  // Everything the dashboard + its dialogs need, in one fan-out.
  const [
    catsRes,
    foodsRes,
    foodUnits,
    mruFoodIds,
    todayKcal,
    seriesByCat,
    recentFoodsByCat,
    weightLogsByCat,
    waterByCat,
    openCareByCat,
    careTypeLabels,
    templatesRes,
    templateItemsRes,
    stoolConsistencies,
    symptomTypes,
  ] = await Promise.all([
    database
      .from("cats")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    database.from("food_catalog").select("*").eq("is_active", true).order("name"),
    getLookupsByCategory("food_unit"),
    getMRUFoodIds(8),
    getTodayKcalByCat(),
    get7DayKcalSeriesByCat(),
    getRecentFoodIdsByCat(8),
    getWeightLogsByCat(),
    getTodayWaterByCat(),
    getOpenCareByCat(),
    getCareTypeLabels(),
    database
      .from("meal_templates")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .order("name"),
    database
      .from("meal_template_items")
      .select("*")
      .eq("is_active", true)
      .order("created_at"),
    getLookupsByCategory("stool_consistency"),
    getLookupsByCategory("symptom_type"),
  ]);

  const cats = (catsRes.data ?? []) as Cat[];
  const foods = (foodsRes.data ?? []) as Food[];
  const aiReady = isAIReady();
  // Morning report + one signed avatar URL per cat, in parallel.
  const [morningBrief, avatarEntries] = await Promise.all([
    aiReady ? getLatestBrief("morning_report", null) : Promise.resolve(null),
    Promise.all(
      cats.map((c) =>
        listAttachments("cat", c.id).then(
          (items) => [c.id, items[0]?.url ?? undefined] as const,
        ),
      ),
    ),
  ]);
  const avatarByCat = new Map(avatarEntries);
  const templates = (templatesRes.data ?? []) as MealTemplate[];
  const templateItems = (templateItemsRes.data ?? []) as MealTemplateItem[];

  // Pure in-memory assembly from the batched maps above — no more queries.
  const emptySeries = empty7DayKcalSeries();
  // A rarely-fed cat can fall out of the shared recent-logs window — fall
  // back to the household MRU so its food list is never unordered/empty.
  const recentByCat = Object.fromEntries(
    cats.map((c) => {
      const own = recentFoodsByCat.get(c.id);
      return [c.id, own && own.length > 0 ? own : mruFoodIds];
    }),
  );

  const feedData = {
    cats,
    foods,
    foodUnits,
    mruFoodIds,
    recentByCat,
  };

  const header = (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {strings.today.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {formatDate(new Date().toISOString())} · {t.greeting(member.display_name)}
        </p>
      </div>
      {cats.length > 0 && (
        <FeedAllDialog
          templates={templates}
          items={templateItems}
          cats={cats}
          foods={foods}
          foodUnits={foodUnits}
          trigger={
            <Button type="button" size="sm" variant="secondary">
              <UtensilsCrossed className="h-4 w-4" />
              {strings.today.feedAll}
            </Button>
          }
        />
      )}
    </div>
  );

  if (cats.length === 0) {
    return (
      <div className="space-y-4">
        {header}
        <div className="rounded-2xl border border-dashed border-border px-4 py-12 text-center">
          <h2 className="text-base font-semibold text-foreground">
            {t.emptyTitle}
          </h2>
          <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
            {t.emptyBody}
          </p>
          <Button asChild className="mt-4">
            <Link href="/settings">{t.goToSettings}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {header}

      {aiReady && <MorningReportCard brief={morningBrief} />}

      <RestockBanner />

      <div className="space-y-4">
        {cats.map((cat) => {
          const totals = todayKcal.get(cat.id);
          const weightLogs = weightLogsByCat.get(cat.id) ?? [];
          const latestWeight = weightLogs[0] ?? null;
          const target = dailyTarget(cat, latestWeight?.weight_grams ?? null);
          const snackKcal = totals?.snackKcal ?? 0;

          return (
            <CatCard
              key={cat.id}
              cat={cat}
              photoUrl={avatarByCat.get(cat.id)}
              feedData={feedData}
              kcal={totals?.kcal ?? 0}
              target={target}
              treat={exceedsTreatLimit(snackKcal, target)}
              series={seriesByCat.get(cat.id) ?? emptySeries}
              lastFed={totals?.lastFed ?? null}
              latestWeight={latestWeight}
              trend={weightTrend(weightLogs)}
              waterMl={waterByCat.get(cat.id) ?? 0}
              careEvents={openCareByCat.get(cat.id) ?? []}
              careTypeLabels={careTypeLabels}
            />
          );
        })}
      </div>

      <QuickLogFab
        cats={cats}
        feedData={feedData}
        stoolConsistencies={stoolConsistencies}
        symptomTypes={symptomTypes}
        aiReady={aiReady}
      />
    </div>
  );
}
