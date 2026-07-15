import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAiTimeseries } from "@/hooks/useAnalytics";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

function shortDay(day: string): string {
  // "2026-07-14" -> "07-14"
  return day.length >= 10 ? day.slice(5) : day;
}

const AXIS_TICK = { fontSize: 11, fill: "#64748b" };
const GRID = "#e2e8f0";

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-base font-bold text-foreground">{title}</h3>
      <p className="mb-3 text-xs text-muted-foreground">{subtitle}</p>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
      No LLM activity in this window.
    </div>
  );
}

export function OverviewCharts({ accountId }: { accountId: number | null }) {
  const { data = [], isLoading } = useAiTimeseries(accountId, 30, accountId != null);
  const hasData = data.length > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ChartCard title="LLM calls by day" subtitle="Daily volume of LLM calls">
          {isLoading ? (
            <div className="h-[220px]" />
          ) : !hasData ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS_TICK} minTickGap={24} />
                <YAxis allowDecimals={false} tick={AXIS_TICK} width={36} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} labelFormatter={(l) => `Day ${l}`} />
                <Line type="monotone" dataKey="calls" name="Calls" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Latency by day" subtitle="Average LLM latency (ms) per day">
          {isLoading ? (
            <div className="h-[220px]" />
          ) : !hasData ? (
            <EmptyState />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
                <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS_TICK} minTickGap={24} />
                <YAxis tickFormatter={(v: number) => compact.format(v)} tick={AXIS_TICK} width={44} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  formatter={(v) => [`${Math.round(Number(v)).toLocaleString()} ms`, "Avg latency"]}
                  labelFormatter={(l) => `Day ${l}`}
                />
                <Line type="monotone" dataKey="avg_latency_ms" name="Avg latency" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <ChartCard title="Token usage by day" subtitle="Total LLM tokens consumed per day">
        {isLoading ? (
          <div className="h-[240px]" />
        ) : !hasData ? (
          <EmptyState />
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="tokenFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
              <XAxis dataKey="day" tickFormatter={shortDay} tick={AXIS_TICK} minTickGap={24} />
              <YAxis tickFormatter={(v: number) => compact.format(v)} tick={AXIS_TICK} width={44} />
              <Tooltip
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
                formatter={(v) => [Number(v).toLocaleString(), "Tokens"]}
                labelFormatter={(l) => `Day ${l}`}
              />
              <Area type="monotone" dataKey="total_tokens" name="Tokens" stroke="#8b5cf6" strokeWidth={2} fill="url(#tokenFill)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
