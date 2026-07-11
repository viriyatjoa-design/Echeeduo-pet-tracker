import type { CSSProperties } from "react";
import type { Cat } from "@/lib/types";
import { cn } from "@/lib/utils";

/** First 1–2 letters of a cat's name, uppercased (e.g. "Miso" → "MI"). */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Presentational avatar. With `url`, shows the photo; otherwise the cat's
 * initials on a circle tinted with the cat's accent. Photo upload / signed URL
 * is wired by the lead (Phase C) — this component only renders.
 */
export function CatAvatar({
  cat,
  url,
  size = 44,
}: {
  cat: Cat;
  url?: string;
  size?: number;
}) {
  const dimension: CSSProperties = { width: size, height: size };
  const accent = `hsl(var(--cat-${cat.accent_index}))`;

  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={cat.name}
        width={size}
        height={size}
        style={dimension}
        className="shrink-0 rounded-full object-cover"
      />
    );
  }

  return (
    <div
      aria-hidden
      style={{
        ...dimension,
        backgroundColor: `hsl(var(--cat-${cat.accent_index}) / 0.18)`,
        color: accent,
        fontSize: Math.round(size * 0.38),
      }}
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full font-semibold leading-none",
      )}
      title={cat.name}
    >
      {initials(cat.name)}
    </div>
  );
}
