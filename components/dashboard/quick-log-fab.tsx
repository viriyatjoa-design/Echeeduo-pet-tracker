"use client";

import * as React from "react";
import {
  Plus,
  X,
  Utensils,
  Droplet,
  Trash2,
  Stethoscope,
  Scale,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FeedDialog } from "@/components/feed/feed-dialog";
import { WaterQuickAdd } from "@/components/observation/water-quick-add";
import { LitterForm } from "@/components/observation/litter-form";
import { SymptomForm } from "@/components/observation/symptom-form";
import { WeightForm } from "@/components/weight/weight-form";
import type { FeedData } from "@/components/feed/quick-feed";
import type { Cat, Lookup } from "@/lib/types";

const t = {
  open: "Quick log",
  feed: "Feed",
  water: "Water",
  litter: "Litter",
  symptom: "Symptom",
  weight: "Weight",
  waterTitle: "Log water",
  weightTitle: "Log weight",
  weightPick: "Which cat?",
} as const;

export type QuickLogFabProps = {
  cats: Cat[];
  feedData: FeedData;
  stoolConsistencies: Lookup[];
  symptomTypes: Lookup[];
};

/** A menu row inside the FAB popover. */
function Row({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      <span className="grid h-8 w-8 place-items-center rounded-full bg-muted text-foreground">
        {icon}
      </span>
      {label}
    </button>
  );
}

/**
 * Floating quick-log menu (SPEC §7): Feed · Water · Litter · Symptom · Weight.
 * Fixed above the bottom nav, aligned to the app's max-w-md column. Each item
 * closes the menu and opens the matching controlled dialog — all dialogs live
 * OUTSIDE the menu so closing it never unmounts an open dialog.
 */
export function QuickLogFab({
  cats,
  feedData,
  stoolConsistencies,
  symptomTypes,
}: QuickLogFabProps) {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [feedOpen, setFeedOpen] = React.useState(false);
  const [waterOpen, setWaterOpen] = React.useState(false);
  const [litterOpen, setLitterOpen] = React.useState(false);
  const [symptomOpen, setSymptomOpen] = React.useState(false);
  const [weightExpanded, setWeightExpanded] = React.useState(false);
  const [weightCatId, setWeightCatId] = React.useState<string | null>(null);

  const singleCat = cats.length === 1 ? cats[0] : null;

  function close() {
    setMenuOpen(false);
    setWeightExpanded(false);
  }

  return (
    <>
      {/* Fixed layer constrained to the app column so the FAB tracks the card edge */}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-40">
        <div className="mx-auto flex max-w-md flex-col items-end px-4">
          {menuOpen && (
            <>
              {/* Backdrop to dismiss */}
              <button
                type="button"
                aria-label="Close menu"
                onClick={close}
                className="pointer-events-auto fixed inset-0 -z-10 bg-black/20"
              />
              <div className="pointer-events-auto mb-3 w-52 rounded-2xl border border-border bg-popover p-1.5 shadow-lg">
                <Row
                  icon={<Utensils className="h-4 w-4" />}
                  label={t.feed}
                  onClick={() => {
                    close();
                    setFeedOpen(true);
                  }}
                />

                <Row
                  icon={<Droplet className="h-4 w-4" />}
                  label={t.water}
                  onClick={() => {
                    close();
                    setWaterOpen(true);
                  }}
                />
                <Row
                  icon={<Trash2 className="h-4 w-4" />}
                  label={t.litter}
                  onClick={() => {
                    close();
                    setLitterOpen(true);
                  }}
                />
                <Row
                  icon={<Stethoscope className="h-4 w-4" />}
                  label={t.symptom}
                  onClick={() => {
                    close();
                    setSymptomOpen(true);
                  }}
                />

                {/* Weight: needs a specific cat — single cat opens directly,
                    otherwise expand an inline per-cat picker (no nested dialog).
                    Each cat row closes the menu and opens that cat's controlled
                    WeightForm (rendered outside the menu, below). */}
                {singleCat ? (
                  <Row
                    icon={<Scale className="h-4 w-4" />}
                    label={t.weight}
                    onClick={() => {
                      close();
                      setWeightCatId(singleCat.id);
                    }}
                  />
                ) : (
                  <>
                    <Row
                      icon={<Scale className="h-4 w-4" />}
                      label={t.weight}
                      onClick={() => setWeightExpanded((v) => !v)}
                    />
                    {weightExpanded && (
                      <div className="mb-1 ml-11 space-y-0.5">
                        {cats.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              close();
                              setWeightCatId(c.id);
                            }}
                            className="block w-full rounded-lg px-3 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          >
                            {c.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          <button
            type="button"
            aria-label={t.open}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              "pointer-events-auto grid h-14 w-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95",
              menuOpen && "rotate-90",
            )}
          >
            {menuOpen ? <X className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Controlled dialogs — outside the collapsible menu so closing it
          never unmounts them mid-flight. */}
      <FeedDialog {...feedData} open={feedOpen} onOpenChange={setFeedOpen} />

      {cats.map((c) => (
        <WeightForm
          key={c.id}
          catId={c.id}
          catName={c.name}
          open={weightCatId === c.id}
          onOpenChange={(o) => setWeightCatId(o ? c.id : null)}
        />
      ))}

      <Dialog open={waterOpen} onOpenChange={setWaterOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.waterTitle}</DialogTitle>
          </DialogHeader>
          <WaterQuickAdd cats={cats} />
        </DialogContent>
      </Dialog>

      <LitterForm
        cats={cats}
        stoolConsistencies={stoolConsistencies}
        open={litterOpen}
        onOpenChange={setLitterOpen}
      />
      <SymptomForm
        cats={cats}
        symptomTypes={symptomTypes}
        open={symptomOpen}
        onOpenChange={setSymptomOpen}
      />
    </>
  );
}

export default QuickLogFab;
