import type { Cat, Food, Lookup, MealTemplate, MealTemplateItem } from "@/lib/types";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { gramsFromPortion, portionLabel, round1 } from "@/lib/kcal";
import { TemplateForm } from "./template-form";
import { TemplateItemForm } from "./template-item-form";
import { ActionButton } from "./action-button";
import {
  setTemplateActive,
  removeTemplateItem,
} from "@/lib/actions/meal-templates";

const t = {
  heading: "Meal templates",
  empty: "No templates yet. Create one (e.g. Morning) then add each cat's food.",
  noItems: "No cats added yet.",
  deactivate: "Deactivate",
  remove: "Remove",
  confirmDeactivate: "Deactivate this template?",
  confirmRemove: "Remove this item from the template?",
} as const;

/** Human-readable amount for a template item, e.g. "½ Can · 42.5 g" or "40 g". */
function itemAmount(
  item: MealTemplateItem,
  food: Food | undefined,
  unitLabelFor: (id: string | null) => string,
): string {
  if (item.qty != null && food?.unit_id && food.unit_grams) {
    const grams = gramsFromPortion(item.qty, food.unit_grams);
    return portionLabel(item.qty, unitLabelFor(food.unit_id), grams);
  }
  if (item.grams != null) return `${round1(item.grams)} g`;
  return "—";
}

export function TemplatesSection({
  templates,
  itemsByTemplate,
  cats,
  foods,
  foodUnits,
}: {
  templates: MealTemplate[];
  itemsByTemplate: Map<string, MealTemplateItem[]>;
  cats: Cat[];
  foods: Food[];
  foodUnits: Lookup[];
}) {
  const catById = new Map(cats.map((c) => [c.id, c]));
  const foodById = new Map(foods.map((f) => [f.id, f]));
  const unitLabel = new Map(foodUnits.map((l) => [l.id, l.label]));
  const unitLabelFor = (id: string | null) =>
    (id && unitLabel.get(id)) || "unit";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">{t.heading}</h2>
        <TemplateForm />
      </div>

      {templates.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {t.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {templates.map((tpl) => {
            const items = itemsByTemplate.get(tpl.id) ?? [];
            const usedCatIds = items.map((i) => i.cat_id);
            return (
              <li key={tpl.id}>
                <Card>
                  <CardHeader className="flex-row items-center justify-between gap-2 space-y-0 p-4">
                    <p className="font-semibold text-foreground">{tpl.name}</p>
                    <div className="flex items-center gap-1">
                      <TemplateForm template={tpl} />
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        action={setTemplateActive.bind(null, tpl.id, false)}
                        confirmText={t.confirmDeactivate}
                        successText="Template deactivated"
                      >
                        {t.deactivate}
                      </ActionButton>
                    </div>
                  </CardHeader>
                  <Separator />
                  <CardContent className="space-y-2 p-4">
                    {items.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {t.noItems}
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {items.map((item) => {
                          const cat = catById.get(item.cat_id);
                          const food = foodById.get(item.food_id);
                          return (
                            <li
                              key={item.id}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="min-w-0 text-sm text-foreground">
                                <span className="font-medium">
                                  {cat?.name ?? "Cat"}:
                                </span>{" "}
                                {itemAmount(item, food, unitLabelFor)}{" "}
                                {food?.name ?? "—"}
                              </span>
                              <span className="flex shrink-0 items-center gap-1">
                                <TemplateItemForm
                                  templateId={tpl.id}
                                  cats={cats}
                                  foods={foods}
                                  item={item}
                                />
                                <ActionButton
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  action={removeTemplateItem.bind(null, item.id)}
                                  confirmText={t.confirmRemove}
                                  successText="Item removed"
                                >
                                  {t.remove}
                                </ActionButton>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    )}

                    <div className="pt-1">
                      <TemplateItemForm
                        templateId={tpl.id}
                        cats={cats}
                        foods={foods}
                        usedCatIds={usedCatIds}
                      />
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
