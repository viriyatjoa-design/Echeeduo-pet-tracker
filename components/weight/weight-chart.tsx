"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";

export type WeightPoint = { date: string; kg: number };

const t = {
  target: "target",
  kg: "kg",
} as const;

/** 'YYYY-MM-DD' → "Jul" (month tick). UTC so the label matches the stored date. */
function monthTick(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    month: "short",
  }).format(new Date(date + "T00:00:00Z"));
}

/** 'YYYY-MM-DD' → "9 Jul 2026" (tooltip heading). */
function fullDate(date: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date + "T00:00:00Z"));
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: WeightPoint }>;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-1.5 text-xs text-popover-foreground shadow-md">
      <div className="font-medium">{fullDate(p.date)}</div>
      <div className="text-muted-foreground">
        {p.kg.toFixed(2)} {t.kg}
      </div>
    </div>
  );
}

/**
 * Responsive weight line chart (SPEC §7): last 12 months, x = date, y = kg,
 * with an optional horizontal reference line at the target weight. Colours come
 * from theme tokens + the cat's accent CSS var (`--cat-{n}`) so both themes work.
 */
export function WeightChart({
  data,
  targetKg,
  accentIndex,
}: {
  data: WeightPoint[];
  targetKg?: number | null;
  accentIndex: number;
}) {
  const accent = `hsl(var(--cat-${accentIndex}))`;
  const muted = "hsl(var(--muted-foreground))";
  const border = "hsl(var(--border))";

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -8 }}>
          <CartesianGrid stroke={border} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={monthTick}
            tick={{ fill: muted, fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: border }}
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: muted, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={40}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => v.toFixed(1)}
          />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: border }} />
          {targetKg != null && (
            <ReferenceLine
              y={targetKg}
              stroke={muted}
              strokeDasharray="5 4"
              label={{
                value: `${t.target} ${targetKg.toFixed(2)}`,
                position: "insideTopRight",
                fill: muted,
                fontSize: 10,
              }}
            />
          )}
          <Line
            type="monotone"
            dataKey="kg"
            stroke={accent}
            strokeWidth={2.5}
            dot={{ r: 3, fill: accent, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
