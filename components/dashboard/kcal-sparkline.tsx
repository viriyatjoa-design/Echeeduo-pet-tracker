"use client";

import type { CSSProperties } from "react";
import type { KcalPoint } from "@/lib/feeding-queries";

/**
 * A quiet 7-day kcal sparkline (SPEC §7) — inline SVG so the client bundle stays
 * tiny (no recharts on the dashboard). Accent-tinted line over a soft area fill;
 * the final day gets a dot. Flat baseline when there's no data.
 */
const VIEW_W = 100;
const VIEW_H = 28;
const PAD = 2;

export function KcalSparkline({
  points,
  accentIndex,
}: {
  points: KcalPoint[];
  accentIndex: number;
}) {
  const accent = `hsl(var(--cat-${accentIndex}))`;
  const values = points.map((p) => p.kcal);
  const max = Math.max(1, ...values);
  const n = points.length;

  const coords = points.map((p, i) => {
    const x = n <= 1 ? VIEW_W / 2 : PAD + (i * (VIEW_W - 2 * PAD)) / (n - 1);
    const y = VIEW_H - PAD - (p.kcal / max) * (VIEW_H - 2 * PAD);
    return [x, y] as const;
  });

  const line = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const area =
    coords.length > 0
      ? `${PAD},${VIEW_H - PAD} ${line} ${VIEW_W - PAD},${VIEW_H - PAD}`
      : "";
  const last = coords[coords.length - 1];

  const fillStyle: CSSProperties = { fill: accent, opacity: 0.12 };
  const strokeStyle: CSSProperties = { stroke: accent };

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className="h-8 w-full"
      aria-hidden
    >
      {area && <polygon points={area} style={fillStyle} />}
      <polyline
        points={line}
        fill="none"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={strokeStyle}
        vectorEffect="non-scaling-stroke"
      />
      {last && (
        <circle cx={last[0]} cy={last[1]} r={1.8} style={{ fill: accent }} />
      )}
    </svg>
  );
}

export default KcalSparkline;
