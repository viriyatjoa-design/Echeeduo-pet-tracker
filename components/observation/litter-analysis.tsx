"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, RefreshCw, Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/components/attachments/image-compress";
import { uploadAttachmentAction } from "@/lib/actions/attachments";
import { analyzeLitterPhoto } from "@/lib/actions/ai";
import { formatDateTime } from "@/lib/time";
import { actionErrorMessage } from "@/lib/action-error";

const t = {
  aiRead: "AI read",
  analyze: "Analyze photo",
  refresh: "Refresh",
  updatePhoto: "Update photo",
  addPhoto: "Add photo",
  analyzing: "Reading the photo…",
  uploaded: "Photo added — analyzing…",
  uploadedNoAI: "Photo added",
  ready: "Analysis updated",
  uploadError: "Couldn't upload the photo",
  analysisFailed: "Analysis failed",
} as const;

export type LitterAnalysisProps = {
  litterId: string;
  analysis: string | null;
  analyzedAt: string | null;
  hasPhoto: boolean;
  aiReady: boolean;
};

/**
 * The AI stool/urine observation block on a litter entry (owner-requested):
 * shows the stored analysis, re-runs it on demand, and lets the photo be
 * replaced (new photo re-triggers the analysis automatically). Renders nothing
 * when there's no photo, no analysis, and no AI key — zero noise on plain rows.
 */
export function LitterAnalysis({
  litterId,
  analysis,
  analyzedAt,
  hasPhoto,
  aiReady,
}: LitterAnalysisProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [analyzing, setAnalyzing] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const busy = analyzing || uploading;
  const canAnalyze = aiReady && hasPhoto;
  // Plain text-only rows (no photo, no analysis, or AI not set up): show
  // nothing, or just the small "Add photo" control when AI is ready.
  if (!analysis && !canAnalyze && !aiReady) return null;

  async function runAnalysis() {
    setAnalyzing(true);
    try {
      const res = await analyzeLitterPhoto(litterId);
      if (res.ok) {
        toast({ title: t.ready, variant: "success" });
        router.refresh();
      } else {
        toast({
          title: t.analysisFailed,
          description: res.error,
          variant: "destructive",
        });
      }
    } catch (err) {
      // Invocation itself failed (e.g. stale PWA after a deploy).
      toast({
        title: t.analysisFailed,
        description: actionErrorMessage(err, "") || undefined,
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  }

  async function onPhotoPicked(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setUploading(true);
    try {
      const compressed = await compressImage(picked);
      const fd = new FormData();
      fd.set("entityType", "litter_log");
      fd.set("entityId", litterId);
      fd.set("file", compressed);
      await uploadAttachmentAction(fd);
    } catch (err) {
      toast({
        title: t.uploadError,
        description: actionErrorMessage(err, "") || undefined,
        variant: "destructive",
      });
      setUploading(false);
      return;
    }
    setUploading(false);
    if (aiReady) {
      toast({ title: t.uploaded, variant: "success" });
      router.refresh();
      await runAnalysis();
    } else {
      toast({ title: t.uploadedNoAI, variant: "success" });
      router.refresh();
    }
  }

  return (
    <div className="space-y-2">
      {analysis && (
        <div className="rounded-xl bg-muted/60 p-3">
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            {t.aiRead}
            {analyzedAt && <span>· {formatDateTime(analyzedAt)}</span>}
          </div>
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">
            {analysis}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {canAnalyze && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={runAnalysis}
          >
            {analyzing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : analysis ? (
              <RefreshCw className="h-3.5 w-3.5" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {analyzing ? t.analyzing : analysis ? t.refresh : t.analyze}
          </Button>
        )}
        {aiReady && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
            {hasPhoto ? t.updatePhoto : t.addPhoto}
          </Button>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPhotoPicked}
      />
    </div>
  );
}

export default LitterAnalysis;
