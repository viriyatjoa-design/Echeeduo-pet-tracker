import type { CSSProperties } from "react";

/**
 * The feeding-station bowls (owner-picked visualization): a matched pair of
 * ceramic bowls that fill up as a cat eats and drinks through the day. The
 * FOOD bowl fills with a kibble mound in the cat's own coat colour and heaps
 * over the rim (with an amber treat) when they go past target; the WATER bowl
 * fills blue with a gentle wavy waterline. Both are pure/presentational SVG so
 * they render identically on the server and the client (no random, no time —
 * speck positions are a fixed table) and can be used as dialog triggers.
 *
 * Geometry is shared (viewBox 128×108). Every gradient/clip id is namespaced by
 * the required `id` prop so many bowls coexist on one page without collisions.
 */

const VB_W = 128;
const VB_H = 108;

// Ceramic silhouette.
const CX = 64;
const RIM_Y = 36;
const RIM_RX = 50;
const RIM_RY = 12;
const BOT_Y = 92;
const BODY_RX = 40;

// Inner cavity (fills are clipped to this so they never spill past the ceramic).
const IN_RIM_Y = 40;
const IN_RIM_RX = 43;
const IN_BOT_Y = 86;

/** Surface y for a 0..1 fill (bottom → rim). Clamped. */
function surfaceY(frac: number): number {
  const f = Math.min(Math.max(frac, 0), 1);
  return IN_BOT_Y - f * (IN_BOT_Y - IN_RIM_Y);
}

/** Fixed kibble specks (x, depth 0..1, radius, light?) — deterministic scatter. */
const SPECKS: ReadonlyArray<[number, number, number, 0 | 1]> = [
  [0.14, 0.12, 1.7, 1], [0.32, 0.28, 2.2, 0], [0.52, 0.1, 1.5, 1],
  [0.68, 0.24, 2.4, 0], [0.84, 0.14, 1.8, 1], [0.22, 0.46, 2.1, 0],
  [0.44, 0.4, 1.6, 1], [0.6, 0.5, 2.3, 0], [0.78, 0.44, 1.9, 1],
  [0.16, 0.7, 2.0, 0], [0.38, 0.66, 1.7, 1], [0.56, 0.74, 2.2, 0],
  [0.72, 0.68, 1.6, 1], [0.88, 0.62, 2.0, 0], [0.3, 0.86, 1.8, 1],
  [0.5, 0.9, 2.1, 0], [0.66, 0.84, 1.7, 1], [0.26, 0.2, 1.5, 0],
  [0.46, 0.58, 1.9, 1], [0.62, 0.32, 1.6, 0],
];

function speckDots(top: number, bottom: number, xlo: number, xhi: number) {
  const band = Math.max(bottom - top, 2);
  return SPECKS.map(([sx, sd, r, light], i) => {
    const x = xlo + sx * (xhi - xlo);
    const y = top + sd * band;
    if (y > bottom) return null;
    return (
      <circle
        key={i}
        cx={x.toFixed(1)}
        cy={y.toFixed(1)}
        r={r}
        fill={light ? "hsl(0 0% 100% / .16)" : "hsl(var(--bowl-accent) / .55)"}
      />
    );
  });
}

/** Shared ceramic body + rim + cavity clip. */
function Ceramic({ id }: { id: string }) {
  return (
    <>
      <ellipse cx={CX} cy={BOT_Y - 2} rx={26} ry={7} fill="hsl(var(--bowl-shadow-base) / .12)" />
      <path
        d={`M ${CX - RIM_RX},${RIM_Y} C ${CX - RIM_RX},${BOT_Y - 14} ${CX - BODY_RX + 4},${BOT_Y} ${CX},${BOT_Y} C ${CX + BODY_RX - 4},${BOT_Y} ${CX + RIM_RX},${BOT_Y - 14} ${CX + RIM_RX},${RIM_Y} Z`}
        fill={`url(#ceramic-${id})`}
        stroke="hsl(var(--border))"
        strokeWidth={1.5}
      />
      <ellipse
        cx={CX}
        cy={RIM_Y}
        rx={RIM_RX}
        ry={RIM_RY}
        fill={`url(#ceramic-${id})`}
        stroke="hsl(var(--border))"
        strokeWidth={1.5}
      />
      <ellipse
        cx={CX}
        cy={IN_RIM_Y}
        rx={IN_RIM_RX}
        ry={9}
        fill="hsl(var(--muted))"
        stroke="hsl(var(--border) / .6)"
        strokeWidth={1}
      />
    </>
  );
}

/** Thin rim overlay drawn on top of the fill so the waterline tucks under it. */
function RimEdge() {
  return (
    <ellipse
      cx={CX}
      cy={IN_RIM_Y}
      rx={IN_RIM_RX}
      ry={9}
      fill="none"
      stroke="hsl(var(--border) / .5)"
      strokeWidth={1}
    />
  );
}

function CavityClip({ id }: { id: string }) {
  return (
    <clipPath id={`cav-${id}`}>
      <path
        d={`M ${CX - IN_RIM_RX},${IN_RIM_Y} C ${CX - IN_RIM_RX},${IN_BOT_Y - 12} ${CX - IN_RIM_RX + 18},${IN_BOT_Y} ${CX},${IN_BOT_Y} C ${CX + IN_RIM_RX - 18},${IN_BOT_Y} ${CX + IN_RIM_RX},${IN_BOT_Y - 12} ${CX + IN_RIM_RX},${IN_RIM_Y} A ${IN_RIM_RX} 9 0 0 1 ${CX - IN_RIM_RX},${IN_RIM_Y} Z`}
      />
    </clipPath>
  );
}

function svgStyle(w: number): CSSProperties {
  return { width: w, height: (w * VB_H) / VB_W, display: "block" };
}

/**
 * Food bowl. `fraction` = today's kcal ÷ target (0 when no target). Past 1.0 the
 * kibble heaps above the rim and an amber treat appears — `treat` forces the
 * treat marker even at/under target (a snack was logged).
 */
export function FoodBowl({
  id,
  accentIndex,
  fraction,
  treat = false,
  width = 96,
  className,
  title,
}: {
  id: string;
  accentIndex: number;
  fraction: number;
  treat?: boolean;
  width?: number;
  className?: string;
  title?: string;
}) {
  const capped = Math.min(fraction, 1);
  const over = fraction > 1;
  const showTreat = over || treat;

  const y = surfaceY(capped);
  const x0 = CX - IN_RIM_RX - 4;
  const x1 = CX + IN_RIM_RX + 4;

  // Bumpy kibble surface: a run of little arcs across the fill line.
  const bumps = 7;
  const step = (x1 - x0) / bumps;
  let top = `M ${x0},${y + 2} `;
  for (let i = 0; i < bumps; i++) {
    const bx = x0 + step * (i + 1);
    top += `Q ${bx - step / 2},${y - 3.4} ${bx},${y + 1} `;
  }
  top += `L ${x1},${IN_BOT_Y + 4} L ${x0},${IN_BOT_Y + 4} Z`;

  // Heaped dome above the rim when over target.
  const overAmt = Math.min(Math.max(fraction - 1, 0), 0.6);
  const domeH = 6 + overAmt * 26;
  const heapRx = IN_RIM_RX - 4;
  const domeTopY = IN_RIM_Y - domeH;

  const style = {
    "--bowl-accent": `var(--cat-${accentIndex})`,
  } as CSSProperties;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={{ ...svgStyle(width), ...style }}
      className={className}
      role="img"
      aria-label={title ?? "Food bowl"}
    >
      <defs>
        <linearGradient id={`ceramic-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(var(--card))" />
          <stop offset="1" stopColor="hsl(var(--muted))" />
        </linearGradient>
        <linearGradient id={`food-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(var(--bowl-accent))" />
          <stop offset="1" stopColor="hsl(var(--bowl-accent) / .82)" />
        </linearGradient>
        <CavityClip id={id} />
      </defs>

      <Ceramic id={id} />

      {capped > 0.001 && (
        <g clipPath={`url(#cav-${id})`}>
          <path d={top} fill={`url(#food-${id})`} />
          {speckDots(y + 3, IN_BOT_Y, CX - IN_RIM_RX + 4, CX + IN_RIM_RX - 4)}
        </g>
      )}

      {over && (
        <g>
          <path
            d={`M ${CX - heapRx},${IN_RIM_Y + 1} C ${CX - heapRx * 0.7},${domeTopY} ${CX + heapRx * 0.7},${domeTopY} ${CX + heapRx},${IN_RIM_Y + 1} Q ${CX},${IN_RIM_Y + 6} ${CX - heapRx},${IN_RIM_Y + 1} Z`}
            fill={`url(#food-${id})`}
            stroke="hsl(var(--bowl-accent) / .5)"
            strokeWidth={0.5}
          />
          {speckDots(domeTopY + 4, IN_RIM_Y, CX - heapRx + 6, CX + heapRx - 6)}
        </g>
      )}

      <RimEdge />

      {showTreat && (
        <g transform={`translate(${CX + 2}, ${over ? domeTopY + 3 : IN_RIM_Y - 2})`}>
          <ellipse cx={0} cy={0} rx={5.4} ry={4.2} fill="hsl(var(--warning))" stroke="hsl(var(--warning-strong))" strokeWidth={1} />
          <ellipse cx={-1.6} cy={-1.4} rx={1.7} ry={1.2} fill="hsl(45 90% 88%)" opacity={0.8} />
        </g>
      )}
    </svg>
  );
}

/** Water bowl. `fraction` = today's ml ÷ daily goal (0 when no goal/weight). */
export function WaterBowl({
  id,
  fraction,
  width = 96,
  className,
  title,
}: {
  id: string;
  fraction: number;
  width?: number;
  className?: string;
  title?: string;
}) {
  const f = Math.min(fraction, 1);
  const y = surfaceY(f);
  const x0 = CX - IN_RIM_RX - 4;
  const x1 = CX + IN_RIM_RX + 4;
  const amp = 2.6;
  const hw = IN_RIM_RX;

  const wave = `M ${x0},${y} C ${CX - hw * 0.5},${y - amp} ${CX - hw * 0.5},${y + amp} ${CX},${y} C ${CX + hw * 0.5},${y - amp} ${CX + hw * 0.5},${y + amp} ${x1},${y} L ${x1},${IN_BOT_Y + 4} L ${x0},${IN_BOT_Y + 4} Z`;
  const line = `M ${x0},${y} C ${CX - hw * 0.5},${y - amp} ${CX - hw * 0.5},${y + amp} ${CX},${y} C ${CX + hw * 0.5},${y - amp} ${CX + hw * 0.5},${y + amp} ${x1},${y}`;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      style={svgStyle(width)}
      className={className}
      role="img"
      aria-label={title ?? "Water bowl"}
    >
      <defs>
        <linearGradient id={`ceramic-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(var(--card))" />
          <stop offset="1" stopColor="hsl(var(--muted))" />
        </linearGradient>
        <linearGradient id={`water-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="hsl(var(--water-lite))" />
          <stop offset="1" stopColor="hsl(var(--water))" />
        </linearGradient>
        <CavityClip id={id} />
      </defs>

      <Ceramic id={id} />

      {f > 0.001 && (
        <g clipPath={`url(#cav-${id})`}>
          <path d={wave} fill={`url(#water-${id})`} />
          <path
            d={line}
            fill="none"
            stroke="hsl(var(--water-lite))"
            strokeWidth={2}
            strokeLinecap="round"
            opacity={0.85}
          />
        </g>
      )}

      <RimEdge />
    </svg>
  );
}
