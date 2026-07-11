import { requireAppUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLookupsByCategory } from "@/lib/lookups";
import { strings } from "@/lib/strings";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FeedAllForm } from "@/components/feed/feed-all-form";
import type { Cat, Food, MealTemplate, MealTemplateItem } from "@/lib/types";

const t = {
  subtitle: "Apply a meal template to every cat at once.",
} as const;

export default async function FeedAllPage() {
  await requireAppUser();

  const database = db();
  const [templatesRes, itemsRes, catsRes, foodsRes, foodUnits] =
    await Promise.all([
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
      database.from("cats").select("*").eq("is_active", true).order("name"),
      database
        .from("food_catalog")
        .select("*")
        .eq("is_active", true)
        .order("name"),
      getLookupsByCategory("food_unit"),
    ]);

  const templates = (templatesRes.data ?? []) as MealTemplate[];
  const items = (itemsRes.data ?? []) as MealTemplateItem[];
  const cats = (catsRes.data ?? []) as Cat[];
  const foods = (foodsRes.data ?? []) as Food[];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {strings.today.feedAll}
        </h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{strings.today.feedAll}</CardTitle>
        </CardHeader>
        <CardContent>
          <FeedAllForm
            templates={templates}
            items={items}
            cats={cats}
            foods={foods}
            foodUnits={foodUnits}
          />
        </CardContent>
      </Card>
    </div>
  );
}
