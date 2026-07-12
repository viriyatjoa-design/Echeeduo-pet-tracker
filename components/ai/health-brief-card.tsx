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
import { formatTime } from "@/lib/time";

const t = {
  title: "AI health brief",
  brief: "Health brief",
  vet: "Vet summary",
  thinking: "Thinking…",
  copy: "Copy",
  copied: "Copied to clipboard",
  copyFailed: "Couldn't copy — select the text instead.",
  generatedAt: "Generated at",
  setupNote: "Add MOONSHOT_API_KEY in Vercel to enable (see SETUP.md).",
  genericError: "Something went wrong. Try again.",
} as const;

type Kind = "brief" | "vet";

export function HealthBriefCard({
  catId,
  catName,
  aiReady,
}: {
  catId: string;
  catName: string;
  aiReady: boolean;
}) {
  const { toast } = useToast();
  const [pending, setPending] = React.useState<Kind | null>(null);
  const [result, setResult] = React.useState<{
    text: string;
    at: string;
  } | null>(null);

  async function run(kind: Kind) {
    setPending(kind);
    try {
      const { text } =
        kind === "brief"
          ? await generateHealthBrief(catId)
          : await generateVetSummary(catId);
      setResult({ text, at: new Date().toISOString() });
    } catch (err) {
      toast({
        title: err instanceof Error ? err.message : t.genericError,
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
          Reads {catName}&apos;s last 30 days and writes a summary. Not a vet —
          patterns only.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={!aiReady || pending !== null}
            onClick={() => run("brief")}
          >
            {pending === "brief" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {pending === "brief" ? t.thinking : t.brief}
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
                {t.generatedAt} {formatTime(result.at)}
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
