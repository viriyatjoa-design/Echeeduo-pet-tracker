"use client";

import * as React from "react";
import { Utensils } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { strings } from "@/lib/strings";
import { QuickFeed, type FeedData } from "./quick-feed";

/**
 * Quick-feed in a dialog — the same flow the /log/feed page renders, so the
 * dashboard FAB (Phase C) can mount it without a route change. Pass a custom
 * `trigger` (rendered `asChild`) to wire it to a FAB menu item; otherwise a
 * default button is shown.
 */
export function FeedDialog({
  trigger,
  initialCatId,
  ...data
}: FeedData & {
  trigger?: React.ReactNode;
  initialCatId?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button">
            <Utensils className="h-4 w-4" />
            {strings.feed.title}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{strings.feed.title}</DialogTitle>
        </DialogHeader>
        <QuickFeed
          {...data}
          initialCatId={initialCatId}
          onDone={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
