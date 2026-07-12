import * as React from "react";
import { listAttachments } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { AttachmentDeleteButton } from "./attachment-delete-button";

const t = {
  noPhotos: "No photos",
} as const;

export type AttachmentGalleryProps = {
  entityType: string;
  entityId: string;
  revalidate?: string;
  /** Show the per-photo delete control (default true). */
  deletable?: boolean;
  className?: string;
  /** Render a subtle "No photos" line instead of nothing when empty. */
  showEmpty?: boolean;
};

/**
 * Server Component thumbnail grid for an entity's photos. Signed URLs are
 * resolved here at render time (they expire), never persisted.
 */
export async function AttachmentGallery({
  entityType,
  entityId,
  revalidate,
  deletable = true,
  className,
  showEmpty = false,
}: AttachmentGalleryProps) {
  const items = await listAttachments(entityType, entityId);

  if (items.length === 0) {
    if (!showEmpty) return null;
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        {t.noPhotos}
      </p>
    );
  }

  return (
    <div
      className={cn(
        "grid grid-cols-4 gap-1.5 sm:grid-cols-5",
        className,
      )}
    >
      {items.map((a) => (
        <figure
          key={a.id}
          className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
        >
          {a.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={a.url}
              alt={a.caption ?? "Photo"}
              loading="lazy"
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-xs text-muted-foreground">
              —
            </div>
          )}
          {deletable && (
            <AttachmentDeleteButton id={a.id} revalidate={revalidate} />
          )}
          {a.caption && (
            <figcaption className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-2 py-1 text-[11px] text-white">
              {a.caption}
            </figcaption>
          )}
        </figure>
      ))}
    </div>
  );
}

export default AttachmentGallery;
