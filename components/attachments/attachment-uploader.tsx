"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { compressImage } from "./image-compress";
import { uploadAttachmentAction } from "@/lib/actions/attachments";
import { actionErrorMessage } from "@/lib/action-error";

const t = {
  addPhoto: "Add photo",
  uploading: "Uploading…",
  success: "Photo added",
  error: "Couldn't upload photo",
} as const;

export type AttachmentUploaderProps = {
  entityType: string;
  entityId: string;
  revalidate?: string;
  label?: string;
  className?: string;
};

export function AttachmentUploader({
  entityType,
  entityId,
  revalidate,
  label,
  className,
}: AttachmentUploaderProps) {
  const router = useRouter();
  const { toast } = useToast();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [busy, setBusy] = React.useState(false);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    // Reset immediately so picking the same file again re-fires change.
    e.target.value = "";
    if (!file) return;

    setBusy(true);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.set("entityType", entityType);
      fd.set("entityId", entityId);
      if (revalidate) fd.set("revalidate", revalidate);
      fd.set("file", compressed);

      await uploadAttachmentAction(fd);
      toast({ title: t.success, variant: "success" });
      router.refresh();
    } catch (err) {
      toast({
        title: t.error,
        description: actionErrorMessage(err, "") || undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={cn("inline-flex", className)}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onPick}
        disabled={busy}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <ImagePlus className="mr-2 h-4 w-4" />
        )}
        {busy ? t.uploading : label ?? t.addPhoto}
      </Button>
    </div>
  );
}

export default AttachmentUploader;
