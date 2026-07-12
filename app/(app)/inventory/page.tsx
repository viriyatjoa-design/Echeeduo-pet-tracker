import { requireAppUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Lookup } from "@/lib/types";
import { getLookupsByCategory } from "@/lib/lookups";
import {
  isInventoryReady,
  getInventoryItems,
  getMonthlySpend,
  type InventoryItemView,
} from "@/lib/inventory-queries";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { ItemForm, type FoodOption } from "@/components/inventory/item-form";
import { PurchaseDialog } from "@/components/inventory/purchase-dialog";
import { AdjustDialog } from "@/components/inventory/adjust-dialog";
import { ActionMenu } from "@/components/inventory/action-menu";
import { OpenOneButton } from "@/components/inventory/open-one-button";
import { formatIdr, formatQty } from "@/components/inventory/format";

const t = {
  title: "Inventory",
  subtitle: "Stock, purchases and monthly spend.",
  stock: "Stock",
  spending: "Spending",
  items: "Items",
  emptyStock: "No items yet. Add one to start tracking stock.",
  autoTracks: "auto-tracks",
  low: "Low",
  expiresSoon: "Expires soon",
  runsOut: "Runs out today",
  daysLeft: (n: number) => `~${n} ${n === 1 ? "day" : "days"} left`,
  spentThisMonth: "Spent this month",
  emptySpend: "No purchases logged this month.",
  setupTitle: "Inventory isn't set up yet",
  setupBody:
    "Run supabase/migrations/003_inventory.sql in the Supabase SQL Editor (see SETUP.md), then refresh.",
} as const;

/** 'YYYY-MM' → "July 2026". */
function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(`${month}-01T00:00:00Z`));
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">
        {t.title}
      </h1>
      <p className="text-sm text-muted-foreground">{t.subtitle}</p>
    </div>
  );
}

export default async function InventoryPage() {
  await requireAppUser();

  // Graceful pre-migration state: friendly setup card, no other queries.
  if (!(await isInventoryReady())) {
    return (
      <div className="space-y-4">
        <Header />
        <Card>
          <CardHeader>
            <CardTitle>{t.setupTitle}</CardTitle>
            <CardDescription>{t.setupBody}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const [items, spend, types, units, foodsRes] = await Promise.all([
    getInventoryItems(),
    getMonthlySpend(),
    getLookupsByCategory("inventory_type"),
    getLookupsByCategory("stock_unit"),
    db()
      .from("food_catalog")
      .select("id, name, brand")
      .eq("is_active", true)
      .order("name"),
  ]);
  const foods = (foodsRes.data ?? []) as FoodOption[];

  return (
    <div className="space-y-4">
      <Header />

      <Tabs defaultValue="stock">
        <TabsList className="w-full">
          <TabsTrigger value="stock">{t.stock}</TabsTrigger>
          <TabsTrigger value="spending">{t.spending}</TabsTrigger>
        </TabsList>

        <TabsContent value="stock">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                {t.items}
              </h2>
              <ItemForm types={types} units={units} foods={foods} />
            </div>

            {items.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
                {t.emptyStock}
              </p>
            ) : (
              <ul className="space-y-3">
                {items.map((item) => (
                  <li key={item.id}>
                    <ItemCard
                      item={item}
                      types={types}
                      units={units}
                      foods={foods}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </TabsContent>

        <TabsContent value="spending">
          <Card>
            <CardHeader>
              <CardDescription>{monthLabel(spend.month)}</CardDescription>
              <CardTitle className="text-3xl tabular-nums">
                {formatIdr(spend.total)}
              </CardTitle>
              <CardDescription>{t.spentThisMonth}</CardDescription>
            </CardHeader>
            <CardContent>
              {spend.byType.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">
                  {t.emptySpend}
                </p>
              ) : (
                <div className="space-y-1">
                  {spend.byType.map((row, i) => (
                    <div key={row.label}>
                      {i > 0 && <Separator className="my-1" />}
                      <div className="flex items-center justify-between py-2 text-sm">
                        <span className="text-foreground">{row.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {formatIdr(row.idr)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ItemCard({
  item,
  types,
  units,
  foods,
}: {
  item: InventoryItemView;
  types: Lookup[];
  units: Lookup[];
  foods: FoodOption[];
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{item.name}</p>
            {item.foodName && (
              <p className="truncate text-xs text-muted-foreground">
                {t.autoTracks} {item.foodName}
              </p>
            )}
          </div>
          <Badge variant="secondary" className="shrink-0">
            {item.typeLabel}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-semibold tabular-nums text-foreground">
            {formatQty(item.quantity)} {item.unitCode}
          </span>
          {item.daysLeft != null &&
            (item.daysLeft === 0 ? (
              <span className="font-medium text-destructive">{t.runsOut}</span>
            ) : (
              <span className="text-muted-foreground">
                {t.daysLeft(item.daysLeft)}
              </span>
            ))}
          {item.low && <Badge variant="warning">{t.low}</Badge>}
          {item.expiringSoon && (
            <Badge variant="warning">{t.expiresSoon}</Badge>
          )}
        </div>

        <div className="flex items-center justify-end gap-1 pt-1">
          {/* Bulk items (litter/other, not food-linked): "Opened one" IS the
              consumption — stock counts sealed packs (owner-approved). */}
          {!item.food_id &&
            (item.typeCode === "litter" || item.typeCode === "other") && (
              <OpenOneButton itemId={item.id} quantity={item.quantity} />
            )}
          <PurchaseDialog item={item} />
          <AdjustDialog item={item} />
          <ActionMenu
            item={item}
            types={types}
            units={units}
            foods={foods}
          />
        </div>
      </CardContent>
    </Card>
  );
}
