"use client";

import * as React from "react";
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
import { formatDateTime } from "@/lib/time";
import { actionErrorMessage } from "@/lib/action-error";

const t = {
  title: "AI health analysis",
  analysis: "Health analysis",
  vet: "Vet summary",
  thinking: "Thinking…",
  copy: "Copy",
  copied: "Copied to clipboard",
  copyFailed: "Couldn't copy — select the text instead.",
  generatedAt: "Generated",
  kindLabel: { analysis: "Health analysis", vet: "Vet summary" } as const,
  setupNote: "Add MOONSHOT_API_KEY in Vercel to enable (see SETUP.md).",
  genericError: "Something went wrong. Try again.",
} as const;

type Kind = "analysis" | "vet";

export type StoredBrief = { text: string; at: string } | null;

/**
 * Deep per-cat AI analysis (cat profile → Health tab). Results are STORED
 * (ai_briefs) — the last analysis/summary shows instantly on every visit; the
 * buttons regenerate (slow: this deliberately uses the thinking model over
 * the full 30-day history — the quick daily read lives on the dashboard as
 * the Morning report).
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
  const { toast } = useToast();
  const [pending, setPending] = React.useState<Kind | null>(null);
  // What's displayed: freshest run this visit, else the newest stored text.
  const initial: { kind: Kind; text: string; at: string } | null =
    storedAnalysis && storedVet
      ? storedAnalysis.at >= storedVet.at
        ? { kind: "analysis", ...storedAnalysis }
        : { kind: "vet", ...storedVet }
      : storedAnalysis
        ? { kind: "analysis", ...storedAnalysis }
        : storedVet
          ? { kind: "vet", ...storedVet }
          : null;
  const [result, setResult] = React.useState(initial);

  async function run(kind: Kind) {
    setPending(kind);
    try {
      // Actions return result objects (never throw for expected failures) so
      // the real error message survives production's server-error masking.
      const res =
        kind === "analysis"
          ? await generateHealthBrief(catId)
          : await generateVetSummary(catId);
      if (res.ok) {
        setResult({ kind, text: res.text, at: new Date().toISOString() });
      } else {
        toast({ title: res.error, variant: "destructive" });
      }
    } catch (err) {
      toast({
        title: actionErrorMessage(err, t.genericError),
        variant: "destructive",
      });
    } finally {
      setPending(null);
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
          saved here. Not a vet — patterns only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!aiReady || pending !== null}
            onClick={() => run("analysis")}
          >
            {pending === "analysis" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {pending === "analysis" ? t.thinking : t.analysis}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!aiReady || pending !== null}
            onClick={() => run("vet")}
          >
            {pending === "vet" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Stethoscope className="h-4 w-4" />
            )}
            {pending === "vet" ? t.thinking : t.vet}
          </Button>
        </div>

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
