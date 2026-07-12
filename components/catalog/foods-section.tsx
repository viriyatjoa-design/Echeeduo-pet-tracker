import type { Food, Lookup } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { round1 } from "@/lib/kcal";
import { FoodForm } from "./food-form";
import { ActionButton } from "./action-button";
import { setFoodActive } from "@/lib/actions/foods";

const t = {
  heading: "Foods",
  empty: "No foods yet. Add one to start logging feeds.",
  per100: "kcal / 100 g",
  gramsOnly: "Grams only",
  deactivate: "Deactivate",
  confirmDeactivate: "Deactivate this food? It stays on past feeds but won't be selectable.",
} as const;

export function FoodsSection({
  foods,
  foodTypes,
  foodUnits,
  aiReady = false,
}: {
  foods: Food[];
  foodTypes: Lookup[];
  foodUnits: Lookup[];
  aiReady?: boolean;
}) {
  const typeLabel = new Map(foodTypes.map((l) => [l.id, l.label]));
  const unitLabel = new Map(foodUnits.map((l) => [l.id, l.label]));

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <FoodForm
          foodTypes={foodTypes}
          foodUnits={foodUnits}
          aiReady={aiReady}
        />
      </div>

      {foods.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {t.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {foods.map((food) => {
            const unitInfo =
              food.unit_id && food.unit_grams
                ? `${round1(food.unit_grams)} g ${unitLabel.get(food.unit_id) ?? "unit"}`
                : t.gramsOnly;
            return (
              <li key={food.id}>
                <Card>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-foreground">
                          {food.name}
                        </p>
                        {food.brand && (
                          <p className="truncate text-sm text-muted-foreground">
                            {food.brand}
                          </p>
                        )}
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {typeLabel.get(food.food_type_id) ?? "—"}
                      </Badge>
                    </div>

                    {/* Meta + actions share one row (space audit). */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                        {round1(food.kcal_per_100g)} {t.per100} · {unitInfo}
                        {food.default_serving_grams != null &&
                          ` · serving ${food.default_serving_grams} g`}
                      </div>
                      <div className="flex shrink-0 items-center">
                        <FoodForm
                          foodTypes={foodTypes}
                          foodUnits={foodUnits}
                          food={food}
                          aiReady={aiReady}
                        />
                        <ActionButton
                          variant="ghost"
                          size="sm"
                          className="text-destructive hover:text-destructive"
                          action={setFoodActive.bind(null, food.id, false)}
                          confirmText={t.confirmDeactivate}
                          successText="Food deactivated"
                        >
                          {t.deactivate}
                        </ActionButton>
                      </div>
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
