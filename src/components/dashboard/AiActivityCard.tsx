import { useMemo, useState, type ReactNode } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Activity } from "lucide-react";
import { formatCompactNumber, formatDurationMs, formatNumber } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CHART_MARGIN,
  ChartCard,
  ChartTooltip,
  alpha,
  chartActiveDot,
  chartAxisProps,
  chartCursor,
  chartGridProps,
  useChartTheme,
  type ChartCardEmpty,
} from "@/components/data/chart";
import type { AiTimeseriesPoint } from "@/types/api";
import { fillDailySeries, longDayLabel, rangeLabel, shortDayLabel, type DailyPoint } from "./dashboard-utils";

type Metric = "calls" | "latency" | "tokens";

const METRICS: Record<
  Metric,
  { tab: string; name: string; dataKey: keyof DailyPoint; axis: (v: number) => string; value: (v: number) => string }
> = {
  calls: { tab: "Requests", name: "AI requests", dataKey: "calls", axis: formatCompactNumber, value: (v) => formatNumber(v) },
  latency: {
    tab: "Latency",
    name: "Avg latency",
    dataKey: "avg_latency_ms",
    axis: (v) => formatDurationMs(v),
    value: (v) => formatDurationMs(v),
  },
  tokens: { tab: "Tokens", name: "Tokens", dataKey: "total_tokens", axis: formatCompactNumber, value: (v) => formatNumber(v) },
};

type AiActivityCardProps = {
  points: AiTimeseriesPoint[];
  days: number;
  loading?: boolean;
  /** Error state rendered in the chart body. */
  error?: ChartCardEmpty | null;
};

/** Daily AI requests / latency / tokens for the selected range (chart-1 series, tokenized chrome). */
export function AiActivityCard({ points, days, loading = false, error }: AiActivityCardProps) {
  const theme = useChartTheme();
  const [metric, setMetric] = useState<Metric>("calls");
  const config = METRICS[metric];

  const series = useMemo(() => fillDailySeries(points, days), [points, days]);
  const totals = useMemo(() => {
    let calls = 0;
    let tokens = 0;
    let latencyWeighted = 0;
    let latencyCalls = 0;
    for (const p of points) {
      calls += p.calls ?? 0;
      tokens += p.total_tokens ?? 0;
      if (p.avg_latency_ms != null && p.calls > 0) {
        latencyWeighted += p.avg_latency_ms * p.calls;
        latencyCalls += p.calls;
      }
    }
    return { calls, tokens, latency: latencyCalls > 0 ? latencyWeighted / latencyCalls : null };
  }, [points]);

  const hasActivity = totals.calls > 0;
  let description: ReactNode = rangeLabel(days);
  if (!loading && hasActivity) {
    description = `${rangeLabel(days)} · ${formatNumber(totals.calls)} requests · ${formatCompactNumber(totals.tokens)} tokens · avg ${formatDurationMs(totals.latency)}`;
  }

  const color = theme.series[0];

  return (
    <ChartCard
      title="AI activity"
      description={description}
      height={240}
      loading={loading}
      isEmpty={!loading && (error != null || !hasActivity)}
      empty={
        error ?? {
          icon: Activity,
          title: "No AI requests in this period",
          description: "Daily requests, latency and tokens appear here once agents use AI for this account.",
        }
      }
      actions={
        <Tabs variant="segmented" value={metric} onValueChange={(value) => setMetric(value as Metric)}>
          <TabsList aria-label="Activity metric">
            {(Object.keys(METRICS) as Metric[]).map((key) => (
              <TabsTrigger key={key} value={key}>
                {METRICS[key].tab}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={CHART_MARGIN} accessibilityLayer>
          <CartesianGrid {...chartGridProps(theme)} />
          <XAxis dataKey="day" tickFormatter={shortDayLabel} minTickGap={32} {...chartAxisProps(theme)} />
          <YAxis
            {...chartAxisProps(theme)}
            width={metric === "latency" ? 52 : 44}
            allowDecimals={false}
            tickFormatter={(value: number) => config.axis(value)}
          />
          <Tooltip
            cursor={chartCursor(theme)}
            isAnimationActive={false}
            content={
              <ChartTooltip
                labelFormatter={(label) => longDayLabel(String(label))}
                valueFormatter={(value) => (typeof value === "number" ? config.value(value) : "—")}
              />
            }
          />
          <Area
            key={metric}
            type="monotone"
            dataKey={config.dataKey}
            name={config.name}
            stroke={color}
            strokeWidth={2}
            fill={alpha(color, 0.1)}
            dot={false}
            activeDot={chartActiveDot(theme, color)}
            connectNulls={metric === "latency"}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
