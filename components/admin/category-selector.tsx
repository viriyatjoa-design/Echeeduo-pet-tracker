"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { slugify, humanizeCategory } from "@/components/admin/lookups-util";

const t = {
  pickList: "Pick a list",
  newList: "Or start a new list",
  newPlaceholder: "e.g. Inventory type",
  create: "Create",
} as const;

export function CategorySelector({
  categories,
  selected,
  onSelect,
}: {
  categories: string[];
  selected: string | null;
  onSelect: (category: string) => void;
}) {
  const [draft, setDraft] = React.useState("");

  function createList() {
    const slug = slugify(draft);
    if (!slug) return;
    onSelect(slug); // selecting a not-yet-existing category shows an empty add form
    setDraft("");
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{t.pickList}</p>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const active = cat === selected;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onSelect(cat)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "border-transparent bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-card text-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {humanizeCategory(cat)}
              </button>
            );
          })}
          {categories.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No lists yet — create your first one below.
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{t.newList}</p>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            createList();
          }}
        >
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t.newPlaceholder}
          />
          <Button type="submit" variant="outline" disabled={!draft.trim()}>
            <Plus /> {t.create}
          </Button>
        </form>
      </div>
    </div>
  );
}
