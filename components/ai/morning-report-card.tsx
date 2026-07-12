"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sunrise, ChevronDown, RefreshCw, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { refreshMorningReport } from "@/lib/actions/ai";
import { useAIJob, startAIJob, endAIJob } from "@/lib/ai-jobs";
import { actionErrorMessage } from "@/lib/action-error";
import { formatDateTime, formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";

const t = {
  title: "Morning report",
  empty:
    "Your first report will be ready tomorrow morning (~4:30) — or generate one now.",
  generate: "Generate now",
  refresh: "Refresh",
  working: "Writing the report…",
  updated: "Morning report updated",
  failed: "Couldn't generate the report",
  generatedAt: "Generated",
} as const;

export type MorningReportCardProps = {
  brief: { content: string; created_at: string } | null;
};

/**
 * Collapsed household AI digest at the top of the dashboard (owner-approved
 * design: ONE report for all cats, not one card per cat). Written nightly by
 * the cron; the refresh button is the fallback when the night run failed or
 * the family wants it re-read mid-day. Renders only when AI is configured
 * (the dashboard only mounts it then).
 */
export function MorningReportCard({ brief }: MorningReportCardProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [expanded, setExpanded] = React.useState(false);
  // App-wide job state: the spinner survives navigating away and back.
  const pending = useAIJob("morning-report");

  const firstLine =
    brief?.content.split("\n").find((l) => l.trim() !== "") ?? "";

  async function refresh() {
    startAIJob("morning-report");
    try {
      const res = await refreshMorningReport();
      if (res.ok) {
        toast({ title: t.updated, variant: "success" });
        setExpanded(true);
        router.refresh();
      } else {
        toast({ title: t.failed, description: res.error, variant: "destructive" });
      }
    } catch (err) {
      // Invocation itself failed (e.g. stale PWA after a deploy).
      toast({
        title: t.failed,
        description: actionErrorMessage(err, "") || undefined,
        variant: "destructive",
      });
    } finally {
      endAIJob("morning-report");
    }
  }

  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <button
          type="button"
          className="flex w-full items-center gap-2 text-left"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          disabled={!brief}
        >
          <Sunrise className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">
            {t.title}
          </span>
          {brief && (
            <span className="text-xs text-muted-foreground">
              · {formatDate(brief.created_at)}
            </span>
          )}
          {brief && (
            <ChevronDown
              className={cn(
                "ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                expanded && "rotate-180",
              )}
            />
          )}
        </button>

        {brief ? (
          expanded ? (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">
                {brief.content}
              </p>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {t.generatedAt} {formatDateTime(brief.created_at)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={refresh}
                >
                  {pending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  {pending ? t.working : t.refresh}
                </Button>
              </div>
            </div>
          ) : (
            <p className="line-clamp-1 text-sm text-muted-foreground">
              {firstLine}
            </p>
          )
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{t.empty}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={refresh}
            >
              {pending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Sunrise className="h-3.5 w-3.5" />
              )}
              {pending ? t.working : t.generate}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default MorningReportCard;
