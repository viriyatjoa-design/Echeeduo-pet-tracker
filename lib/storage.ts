import "server-only";
import { db } from "@/lib/db";
import type { Attachment, UUID } from "@/lib/types";

/**
 * Shared photo/attachment layer (SPEC §5 attachments table, §7 photo upload).
 * SERVER ONLY. Uses the service-role `db()` client's storage API against the
 * private `attachments` bucket. Object keys (== storage_path) are:
 *   attachments/{entityType}/{entityId}/{uuid}.{ext}
 * Signed URLs are short-lived — always resolve them at render time, never store.
 */

const BUCKET = "attachments";

export type UploadAttachmentInput = {
  entityType: string;
  entityId: UUID;
  bytes: Buffer | Uint8Array | ArrayBuffer;
  ext: string;
  contentType: string;
  caption?: string | null;
};

/** An attachment row plus a freshly-signed, short-lived URL for rendering. */
export type AttachmentWithUrl = Attachment & { url: string | null };

/**
 * Upload bytes to storage, then insert an `attachments` row pointing at it.
 * Returns the created row.
 */
export async function uploadAttachment(
  input: UploadAttachmentInput,
  createdBy: UUID,
): Promise<Attachment> {
  const { entityType, entityId, bytes, ext, contentType, caption } = input;
  const cleanExt = ext.replace(/^\.+/, "").toLowerCase();
  const path = `${BUCKET}/${entityType}/${entityId}/${crypto.randomUUID()}.${cleanExt}`;

  const client = db();

  const { error: uploadError } = await client.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType });
  if (uploadError) throw new Error(uploadError.message);

  const { data: row, error: insertError } = await client
    .from("attachments")
    .insert({
      entity_type: entityType,
      entity_id: entityId,
      storage_path: path,
      caption: caption ?? null,
      created_by: createdBy,
    })
    .select("*")
    .single();

  if (insertError) {
    // Best-effort cleanup so we don't leak an orphaned object.
    await client.storage.from(BUCKET).remove([path]);
    throw new Error(insertError.message);
  }

  return row as Attachment;
}

/**
 * Active attachment rows for an entity, each with a fresh signed `url`
 * (1 hour). URLs are resolved here at read time — never persisted.
 */
export async function listAttachments(
  entityType: string,
  entityId: UUID,
): Promise<AttachmentWithUrl[]> {
  const client = db();
  const { data, error } = await client
    .from("attachments")
    .select("*")
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Attachment[];
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      url: await getSignedUrl(row.storage_path),
    })),
  );
}

/**
 * Which of these entities have at least one active attachment — one batched
 * query, so list pages can show/hide photo controls without a query per row.
 */
export async function entityIdsWithAttachments(
  entityType: string,
  entityIds: UUID[],
): Promise<Set<UUID>> {
  if (entityIds.length === 0) return new Set();
  const { data, error } = await db()
    .from("attachments")
    .select("entity_id")
    .eq("entity_type", entityType)
    .eq("is_active", true)
    .in("entity_id", entityIds);
  if (error) throw new Error(error.message);
  return new Set(((data ?? []) as { entity_id: UUID }[]).map((r) => r.entity_id));
}

/** Create a short-lived signed URL for a storage object key. */
export async function getSignedUrl(
  path: string,
  expires = 3600,
): Promise<string | null> {
  const { data, error } = await db()
    .storage.from(BUCKET)
    .createSignedUrl(path, expires);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Soft-delete an attachment row (SPEC: never hard-delete). */
export async function softDeleteAttachment(id: UUID): Promise<void> {
  const { error } = await db()
    .from("attachments")
    .update({ is_active: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
