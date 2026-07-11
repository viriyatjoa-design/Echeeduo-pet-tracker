"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAppUser } from "@/lib/auth";
import {
  uploadAttachment,
  softDeleteAttachment,
} from "@/lib/storage";
import type { UUID } from "@/lib/types";

/** Map a file's mime/name to a storage extension. */
function extFor(file: File): string {
  const fromType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
  };
  if (file.type && fromType[file.type]) return fromType[file.type];
  const dot = file.name.lastIndexOf(".");
  if (dot >= 0 && dot < file.name.length - 1) {
    return file.name.slice(dot + 1).toLowerCase();
  }
  return "jpg";
}

/**
 * Server Action: upload one photo from a multipart FormData.
 * Expected fields: entityType, entityId, caption?, revalidate?, file.
 */
export async function uploadAttachmentAction(formData: FormData): Promise<void> {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  const entityType = String(formData.get("entityType") ?? "").trim();
  const entityId = String(formData.get("entityId") ?? "").trim();
  const caption = formData.get("caption");
  const revalidate = formData.get("revalidate");
  const file = formData.get("file") as File | null;

  if (!entityType || !entityId) throw new Error("Missing entityType or entityId");
  if (!file || typeof (file as File).arrayBuffer !== "function") {
    throw new Error("No file provided");
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  await uploadAttachment(
    {
      entityType,
      entityId: entityId as UUID,
      bytes,
      ext: extFor(file),
      contentType: file.type || "image/jpeg",
      caption: typeof caption === "string" && caption.trim() ? caption.trim() : null,
    },
    me.id,
  );

  if (typeof revalidate === "string" && revalidate) {
    revalidatePath(revalidate);
  }
}

/** Server Action: soft-delete an attachment and optionally revalidate a path. */
export async function deleteAttachmentAction(
  id: UUID,
  revalidatePathArg?: string,
): Promise<void> {
  const me = await getCurrentAppUser();
  if (!me) throw new Error("Unauthorized");

  await softDeleteAttachment(id);

  if (revalidatePathArg) revalidatePath(revalidatePathArg);
}
