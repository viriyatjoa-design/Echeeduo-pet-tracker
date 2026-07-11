"use client";

/**
 * Client-side image compression (SPEC §7): downscale so max(w,h) ≤ maxPx and
 * re-encode as JPEG. If the source is already small enough AND already a JPEG,
 * it's returned untouched. Non-image files are returned unchanged.
 */
export async function compressImage(
  file: File,
  maxPx = 1600,
  quality = 0.82,
): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  let bitmap: ImageBitmap | HTMLImageElement;
  let width: number;
  let height: number;

  try {
    if (typeof createImageBitmap === "function") {
      bitmap = await createImageBitmap(file);
      width = bitmap.width;
      height = bitmap.height;
    } else {
      const img = await loadImage(file);
      bitmap = img;
      width = img.naturalWidth;
      height = img.naturalHeight;
    }
  } catch {
    // Decode failed (e.g. unsupported HEIC) — hand the original to the server.
    return file;
  }

  const largest = Math.max(width, height);
  const alreadySmall = largest <= maxPx;
  const alreadyJpeg = file.type === "image/jpeg";
  if (alreadySmall && alreadyJpeg) {
    if ("close" in bitmap) (bitmap as ImageBitmap).close();
    return file;
  }

  const scale = alreadySmall ? 1 : maxPx / largest;
  const targetW = Math.max(1, Math.round(width * scale));
  const targetH = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    if ("close" in bitmap) (bitmap as ImageBitmap).close();
    return file;
  }
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, targetW, targetH);
  if ("close" in bitmap) (bitmap as ImageBitmap).close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", quality),
  );
  if (!blob) return file;

  const baseName = file.name.replace(/\.[^.]+$/, "") || "photo";
  return new File([blob], `${baseName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}
