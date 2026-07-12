"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { strings } from "@/lib/strings";
import type { Cat } from "@/lib/types";

const ALL = "__all__";

export type JournalRowVM = {
  id: string;
  /** null = unattributed household entry (litter). */
  catId: string | null;
  /** Server-rendered row (includes any photo gallery). */
  node: React.ReactNode;
};

/**
 * Client filter-by-cat control over the household journal. Rows are rendered on
 * the server (so photo signed-URLs resolve there) and handed in as `node`s; this
 * component only decides which to show. Null-cat litter appears under "All".
 */
export function JournalList({
  cats,
  rows,
}: {
  cats: Cat[];
  rows: JournalRowVM[];
}) {
  const [selected, setSelected] = React.useState<string>(ALL);

  const visible =
    selected === ALL
      ? rows
      : rows.filter((r) => r.catId === selected);

  return (
    <div className="space-y-4">
      {/* One scrollable line instead of a wrapping block (space audit). */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]">
        <FilterChip
          active={selected === ALL}
          onClick={() => setSelected(ALL)}
          label={strings.journal.allCats}
        />
        {cats.map((c) => (
          <FilterChip
            key={c.id}
            active={selected === c.id}
            onClick={() => setSelected(c.id)}
            label={c.name}
            accentIndex={c.accent_index}
          />
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {strings.journal.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {visible.map((r) => (
            <li key={r.id}>{r.node}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  accentIndex,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  accentIndex?: number;
}) {
  return (
    <Button
      type="button"
      size="pill"
      variant={active ? "default" : "outline"}
      onClick={onClick}
      className={cn("shrink-0", !active && "text-muted-foreground")}
    >
      {accentIndex != null && (
        <span
          className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: `hsl(var(--cat-${accentIndex}))` }}
          aria-hidden
        />
      )}
      {label}
    </Button>
  );
}

export default JournalList;
