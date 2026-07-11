"use client";

import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { formatDate } from "@/lib/time";
import type { WaterDayPoint } from "@/lib/observation-queries";

/** Resolve an HSL-triplet CSS var (e.g. "16 85% 60%") to a usable color. */
function readVar(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return v ? `hsl(${v})` : fallback;
}

/** Compact x-axis label: day-of-month from a 'YYYY-MM-DD'. */
function dayTick(date: string): string {
  const d = date.slice(8, 10);
  return d.startsWith("0") ? d.slice(1) : d;
}

/**
 * Last ~14 days of water intake (ml/day) for one cat. Client-only (recharts).
 * Colors are read from the theme's CSS vars at mount so light/dark both work
 * and the bars use the cat's accent.
 */
export function WaterChart({
  data,
  accentIndex = 1,
}: {
  data: WaterDayPoint[];
  accentIndex?: number;
}) {
  const [colors, setColors] = React.useState({
    bar: "#94a3b8",
    axis: "#94a3b8",
    grid: "rgba(148,163,184,0.25)",
  });

  React.useEffect(() => {
    setColors({
      bar: readVar(`--cat-${accentIndex}`, "#94a3b8"),
      axis: readVar("--muted-foreground", "#94a3b8"),
      grid: readVar("--border", "rgba(148,163,184,0.25)"),
    });
  }, [accentIndex]);

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
        >
          <CartesianGrid
            vertical={false}
            stroke={colors.grid}
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="date"
            tickFormatter={dayTick}
            tick={{ fill: colors.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            interval={1}
          />
          <YAxis
            tick={{ fill: colors.axis, fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={36}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: colors.grid, opacity: 0.4 }}
            content={<ChartTooltip />}
          />
          <Bar dataKey="ml" fill={colors.bar} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md">
      <div className="font-medium">{formatDate(`${label}T00:00:00Z`)}</div>
      <div className="text-muted-foreground">{payload[0].value} ml</div>
    </div>
  );
}

export default WaterChart;
