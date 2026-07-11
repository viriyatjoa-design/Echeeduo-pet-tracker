import Link from "next/link";
import { Package, ChevronRight } from "lucide-react";
import { requireAppUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLookupsByCategory } from "@/lib/lookups";
import type { Cat, Food, MealTemplate, MealTemplateItem } from "@/lib/types";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { FoodsSection } from "@/components/catalog/foods-section";
import { TemplatesSection } from "@/components/catalog/templates-section";

const t = {
  title: "Catalog",
  subtitle: "Foods and meal templates for the whole household.",
  foods: "Foods",
  templates: "Meal templates",
  inventory: "Inventory",
} as const;

export default async function CatalogPage() {
  await requireAppUser();

  const database = db();

  const [
    foodsRes,
    catsRes,
    templatesRes,
    itemsRes,
    foodTypes,
    foodUnits,
  ] = await Promise.all([
    database
      .from("food_catalog")
      .select("*")
      .eq("is_active", true)
      .order("name"),
    database.from("cats").select("*").eq("is_active", true).order("name"),
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
    getLookupsByCategory("food_type"),
    getLookupsByCategory("food_unit"),
  ]);

  const foods = (foodsRes.data ?? []) as Food[];
  const cats = (catsRes.data ?? []) as Cat[];
  const templates = (templatesRes.data ?? []) as MealTemplate[];
  const items = (itemsRes.data ?? []) as MealTemplateItem[];

  // Group items under their template for O(1) lookup in the section.
  const itemsByTemplate = new Map<string, MealTemplateItem[]>();
  for (const item of items) {
    const list = itemsByTemplate.get(item.template_id);
    if (list) list.push(item);
    else itemsByTemplate.set(item.template_id, [item]);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t.title}
        </h1>
        <p className="text-sm text-muted-foreground">{t.subtitle}</p>
      </div>

      <Link
        href="/inventory"
        className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-accent"
      >
        <span className="flex items-center gap-2">
          <Package className="h-4 w-4 text-muted-foreground" />
          {t.inventory}
        </span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </Link>

      <Tabs defaultValue="foods">
        <TabsList className="w-full">
          <TabsTrigger value="foods">{t.foods}</TabsTrigger>
          <TabsTrigger value="templates">{t.templates}</TabsTrigger>
        </TabsList>

        <TabsContent value="foods">
          <FoodsSection
            foods={foods}
            foodTypes={foodTypes}
            foodUnits={foodUnits}
          />
        </TabsContent>

        <TabsContent value="templates">
          <TemplatesSection
            templates={templates}
            itemsByTemplate={itemsByTemplate}
            cats={cats}
            foods={foods}
            foodUnits={foodUnits}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
