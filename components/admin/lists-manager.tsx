"use client";

import * as React from "react";
import type { Lookup } from "@/lib/types";
import { humanizeCategory } from "@/components/admin/lookups-util";
import { CategorySelector } from "@/components/admin/category-selector";
import { AddRowForm } from "@/components/admin/add-row-form";
import { LookupRow } from "@/components/admin/lookup-row";

const t = {
  entriesIn: (name: string) => `Entries in ${name}`,
  emptyList: "This list is empty. Add its first entry below to create it.",
  addFirst: "Add the first entry",
} as const;

export function ListsManager({
  categories,
  lookups,
}: {
  categories: string[];
  lookups: Lookup[];
}) {
  const [selected, setSelected] = React.useState<string | null>(
    categories[0] ?? null,
  );

  // Rows for the selected category, in display order (includes inactive rows so
  // they can be reactivated). Server already orders by sort_order.
  const rows = React.useMemo(
    () =>
      selected
        ? lookups.filter((l) => l.category === selected)
        : ([] as Lookup[]),
    [lookups, selected],
  );

  return (
    <div className="space-y-6">
      <CategorySelector
        categories={categories}
        selected={selected}
        onSelect={setSelected}
      />

      {selected && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {t.entriesIn(humanizeCategory(selected))}
          </h2>

          {rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border bg-background p-3 text-sm text-muted-foreground">
              {t.emptyList}
            </p>
          ) : (
            <div className="space-y-2">
              {rows.map((lookup, i) => (
                <LookupRow
                  key={lookup.id}
                  lookup={lookup}
                  isFirst={i === 0}
                  isLast={i === rows.length - 1}
                />
              ))}
            </div>
          )}

          {/* key resets the form's fields when switching categories */}
          <AddRowForm key={selected} category={selected} />
        </section>
      )}
    </div>
  );
}
