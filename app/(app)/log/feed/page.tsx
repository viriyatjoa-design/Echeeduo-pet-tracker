import { requireAppUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLookupsByCategory } from "@/lib/lookups";
import {
  getMRUFoodIds,
  getRecentFoodsForCat,
} from "@/lib/feeding-queries";
import { strings } from "@/lib/strings";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { QuickFeed } from "@/components/feed/quick-feed";
import type { Cat, Food } from "@/lib/types";

const t = {
  subtitle: "Log a feed in a few taps.",
} as const;

export default async function FeedPage() {
  await requireAppUser();

  const database = db();
  const [catsRes, foodsRes, foodUnits, mruFoodIds] = await Promise.all([
    database.from("cats").select("*").eq("is_active", true).order("name"),
    database
      .from("food_catalog")
      .select("*")
      .eq("is_active", true)
      .order("name"),
    getLookupsByCategory("food_unit"),
    getMRUFoodIds(8),
  ]);

  const cats = (catsRes.data ?? []) as Cat[];
  const foods = (foodsRes.data ?? []) as Food[];

  // Per-cat recent foods so the list reorders to what each cat usually eats.
  const recentEntries = await Promise.all(
    cats.map(
      async (c) => [c.id, await getRecentFoodsForCat(c.id, 8)] as const,
    ),
  );
  const recentByCat = Object.fromEntries(recentEntries);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {strings.feed.title}
        </h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{strings.today.quickLog}</CardTitle>
        </CardHeader>
        <CardContent>
          <QuickFeed
            cats={cats}
            foods={foods}
            foodUnits={foodUnits}
            mruFoodIds={mruFoodIds}
            recentByCat={recentByCat}
          />
        </CardContent>
      </Card>
    </div>
  );
}
