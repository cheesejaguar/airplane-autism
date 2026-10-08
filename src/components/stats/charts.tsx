"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

type Day = { date: string; questions: number; accuracy: number | null; latency: number | null };

const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

export function ActivityChart({ data }: { data: Day[] }) {
  const config = { questions: { label: "Aircraft answered", color: "var(--info)" } } satisfies ChartConfig;
  return (
    <ChartContainer config={config} className="h-48 w-full">
      <BarChart data={data} margin={{ left: 0, right: 4, top: 8 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} strokeOpacity={0.4} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={fmtDay} minTickGap={28} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} width={28} allowDecimals={false} fontSize={11} />
        <ChartTooltip cursor={{ fillOpacity: 0.08 }} content={<ChartTooltipContent labelFormatter={(v) => fmtDay(String(v))} />} />
        <Bar dataKey="questions" fill="var(--color-questions)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

export function AccuracyTrend({ data }: { data: Day[] }) {
  const config = { accuracyPct: { label: "First-look accuracy", color: "var(--go)" } } satisfies ChartConfig;
  const rows = data.map((d) => ({ date: d.date, accuracyPct: d.accuracy === null ? null : Math.round(d.accuracy * 100) }));
  return (
    <ChartContainer config={config} className="h-48 w-full">
      <LineChart data={rows} margin={{ left: 0, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} strokeOpacity={0.4} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickFormatter={fmtDay} minTickGap={28} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} width={34} domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={11} />
        <ChartTooltip content={<ChartTooltipContent labelFormatter={(v) => fmtDay(String(v))} formatter={(v) => `${v}% first look`} />} />
        <Line dataKey="accuracyPct" stroke="var(--color-accuracyPct)" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls type="monotone" />
      </LineChart>
    </ChartContainer>
  );
}
