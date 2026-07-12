"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Stethoscope, Loader2, Copy } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { generateHealthBrief, generateVetSummary } from "@/lib/actions/ai";
import { useAIJob, startAIJob, endAIJob } from "@/lib/ai-jobs";
import { actionErrorMessage } from "@/lib/action-error";
import { formatDateTime } from "@/lib/time";

const t = {
  title: "AI health analysis",
  analysis: "Health analysis",
  vet: "Vet summary",
  thinking: "Thinking…",
  thinkingNote:
    "This takes a minute — you can leave this page, the result is saved here.",
  copy: "Copy",
  copied: "Copied to clipboard",
  copyFailed: "Couldn't copy — select the text instead.",
  generatedAt: "Generated",
  kindLabel: { analysis: "Health analysis", vet: "Vet summary" } as const,
  ready: (kind: string) => `${kind} ready`,
  setupNote: "Add MOONSHOT_API_KEY in Vercel to enable (see SETUP.md).",
  genericError: "Something went wrong. Try again.",
} as const;

type Kind = "analysis" | "vet";

export type StoredBrief = { text: string; at: string } | null;

/**
 * Deep per-cat AI analysis (cat profile → Health tab). Results are STORED
 * (ai_briefs) and the in-flight spinner lives in the app-wide job store, so
 * navigating away and back mid-generation keeps both the loading state and,
 * once done, the result. The quick daily read lives on the dashboard as the
 * Morning report.
 */
export function HealthBriefCard({
  catId,
  catName,
  aiReady,
  storedAnalysis = null,
  storedVet = null,
}: {
  catId: string;
  catName: string;
  aiReady: boolean;
  storedAnalysis?: StoredBrief;
  storedVet?: StoredBrief;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const analysisRunning = useAIJob(`health:${catId}:analysis`);
  const vetRunning = useAIJob(`health:${catId}:vet`);
  const busy = analysisRunning || vetRunning;
  // Result generated during THIS visit (freshest wins vs stored props below).
  const [local, setLocal] = React.useState<{
    kind: Kind;
    text: string;
    at: string;
  } | null>(null);

  // Display the newest of: this visit's result, stored analysis, stored vet.
  // Stored props update via router.refresh() after a background run finishes.
  const candidates = [
    local,
    storedAnalysis && { kind: "analysis" as const, ...storedAnalysis },
    storedVet && { kind: "vet" as const, ...storedVet },
  ].filter(Boolean) as { kind: Kind; text: string; at: string }[];
  // Parse timestamps: DB rows use "+00:00" offsets, local uses "Z" — plain
  // string comparison across the two formats is unreliable.
  const result =
    candidates.length > 0
      ? candidates.reduce((a, b) =>
          new Date(a.at).getTime() >= new Date(b.at).getTime() ? a : b,
        )
      : null;

  async function run(kind: Kind) {
    const jobKey = `health:${catId}:${kind}`;
    startAIJob(jobKey);
    try {
      // Actions return result objects (never throw for expected failures) so
      // the real error message survives production's server-error masking.
      const res =
        kind === "analysis"
          ? await generateHealthBrief(catId)
          : await generateVetSummary(catId);
      if (res.ok) {
        setLocal({ kind, text: res.text, at: new Date().toISOString() });
        toast({ title: t.ready(t.kindLabel[kind]), variant: "success" });
        router.refresh();
      } else {
        toast({ title: res.error, variant: "destructive" });
      }
    } catch (err) {
      toast({
        title: actionErrorMessage(err, t.genericError),
        variant: "destructive",
      });
    } finally {
      endAIJob(jobKey);
    }
  }

  async function copy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result.text);
      toast({ title: t.copied, variant: "success" });
    } catch {
      toast({ title: t.copyFailed, variant: "destructive" });
    }
  }

  return (
    <Card className="rounded-2xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t.title}</CardTitle>
        <CardDescription>
          Reads {catName}&apos;s last 30 days in depth — the latest result is
          saved here. Practical pointers, not a vet diagnosis.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!aiReady || busy}
            onClick={() => run("analysis")}
          >
            {analysisRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {analysisRunning ? t.thinking : t.analysis}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!aiReady || busy}
            onClick={() => run("vet")}
          >
            {vetRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Stethoscope className="h-4 w-4" />
            )}
            {vetRunning ? t.thinking : t.vet}
          </Button>
        </div>

        {busy && (
          <p className="text-sm text-muted-foreground">{t.thinkingNote}</p>
        )}

        {!aiReady && (
          <p className="text-sm text-muted-foreground">{t.setupNote}</p>
        )}

        {result && (
          <div className="space-y-2">
            <div className="whitespace-pre-wrap break-words rounded-xl border border-border bg-background p-3 text-sm text-foreground">
              {result.text}
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">
                {t.kindLabel[result.kind]} · {t.generatedAt}{" "}
                {formatDateTime(result.at)}
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={copy}>
                <Copy className="h-4 w-4" />
                {t.copy}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
