"use client";

import { CartesianGrid, LabelList, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

export interface MrrPoint {
  weekStart: string;
  mrr?: number;
  projection?: number;
}

// One solid series + a dashed reference line (validated at Checkpoint P; identity never color-only:
// dash pattern, direct labels, legend and a table view).
const config = {
  mrr: { label: "MRR", color: "var(--chart-1)" },
  projection: { label: "7% a week", color: "var(--chart-2)" },
} satisfies ChartConfig;

const money = (v: number) => `$${Math.round(v).toLocaleString("en-US")}`;
const weekLabel = (d: string) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(`${d}T12:00:00Z`),
  );

export function MrrChart({ data }: { data: MrrPoint[] }) {
  const lastActual = [...data].reverse().find((d) => d.mrr !== undefined);
  const lastProjection = [...data].reverse().find((d) => d.projection !== undefined);
  return (
    <div className="flex flex-col gap-2">
      <ChartContainer
        config={config}
        className="aspect-auto h-44 w-full"
        // Start no wider than the narrowest column (320px screen minus gutters) so it never overflows before measuring.
        initialDimension={{ width: 280, height: 176 }}
        role="img"
        aria-label="MRR by week with a 7% weekly growth projection"
      >
        <LineChart data={data} margin={{ top: 16, right: 76, bottom: 0, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="weekStart"
            tickFormatter={weekLabel}
            tickLine={false}
            axisLine={false}
            minTickGap={32}
          />
          <YAxis tickFormatter={money} tickLine={false} axisLine={false} width={56} />
          <ChartTooltip
            content={<ChartTooltipContent labelFormatter={(v) => `Week of ${weekLabel(String(v))}`} />}
          />
          <Line
            dataKey="mrr"
            type="linear"
            stroke="var(--color-mrr)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="mrr"
              content={(p) =>
                p.index === data.indexOf(lastActual!) ? (
                  <text
                    x={Number(p.x) - 6}
                    y={Number(p.y) - 8}
                    textAnchor="end"
                    className="fill-foreground text-caption font-medium"
                  >{`MRR ${money(Number(p.value))}`}</text>
                ) : null
              }
            />
          </Line>
          <Line
            dataKey="projection"
            type="linear"
            stroke="var(--color-projection)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
            isAnimationActive={false}
          >
            <LabelList
              dataKey="projection"
              content={(p) =>
                p.index === data.indexOf(lastProjection!) ? (
                  <text
                    x={Number(p.x) + 6}
                    y={Number(p.y) + 4}
                    className="fill-foreground text-caption font-medium"
                  >
                    7% a week
                  </text>
                ) : null
              }
            />
          </Line>
        </LineChart>
      </ChartContainer>
      <div className="text-caption text-muted-foreground flex flex-wrap items-center gap-4">
        <span className="flex items-center gap-1.5">
          <svg width="18" height="4" aria-hidden="true">
            <line x1="0" x2="18" y1="2" y2="2" stroke="var(--chart-1)" strokeWidth="2" />
          </svg>
          MRR
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="18" height="4" aria-hidden="true">
            <line
              x1="0"
              x2="18"
              y1="2"
              y2="2"
              stroke="var(--chart-2)"
              strokeWidth="2"
              strokeDasharray="4 3"
            />
          </svg>
          7% weekly growth projection
        </span>
      </div>
      <details className="text-small">
        <summary className="text-link cursor-pointer underline underline-offset-2">View as table</summary>
        <table className="mt-2 w-full">
          <caption className="sr-only">MRR and projection by week</caption>
          <thead>
            <tr className="text-muted-foreground">
              <th className="text-left font-medium">Week of</th>
              <th className="text-right font-medium">MRR</th>
              <th className="text-right font-medium">Projection</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.weekStart}>
                <td>{weekLabel(d.weekStart)}</td>
                <td className="num text-right">{d.mrr === undefined ? "" : money(d.mrr)}</td>
                <td className="num text-right">{d.projection === undefined ? "" : money(d.projection)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
