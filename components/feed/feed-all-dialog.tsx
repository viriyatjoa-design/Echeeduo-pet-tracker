"use client";

import * as React from "react";
import { UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { strings } from "@/lib/strings";
import { FeedAllForm, type FeedAllData } from "./feed-all-form";

/**
 * "Feed all" (apply a meal template) in a dialog — same flow as the
 * /log/feed-all page, for the dashboard "Feed all" button (Phase C). Pass a
 * custom `trigger` (rendered `asChild`) or use the default button.
 */
export function FeedAllDialog({
  trigger,
  ...data
}: FeedAllData & { trigger?: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" variant="secondary">
            <UtensilsCrossed className="h-4 w-4" />
            {strings.today.feedAll}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{strings.today.feedAll}</DialogTitle>
        </DialogHeader>
        <FeedAllForm {...data} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
