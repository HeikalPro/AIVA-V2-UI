import { Pie, PieChart, Tooltip } from "recharts";
import { MessageSquareText } from "lucide-react";
import { formatNumber, formatPercent } from "@/lib/format";
import { ChartCard, ChartLegend, ChartTooltip, useChartTheme, type ChartCardEmpty } from "@/components/data/chart";
import type { AiMetricsBreakdownItem } from "@/types/api";

type AnswerOutcomesCardProps = {
  successful: number;
  failed: number;
  /** Where the numbers come from, shown under the title ("Last 30 days · AI request logs"). */
  sourceLabel: string;
  /** Per-model error rates (ai-metrics only). */
  byModel?: AiMetricsBreakdownItem[];
  loading?: boolean;
  error?: ChartCardEmpty | null;
};

const DONUT = 148;

/** Success vs failed answers: donut + counts/percentages, and error rate per model when available. */
export function AnswerOutcomesCard({ successful, failed, sourceLabel, byModel = [], loading = false, error }: AnswerOutcomesCardProps) {
  const theme = useChartTheme();
  const total = successful + failed;
  const rate = total > 0 ? successful / total : null;
  const data = [
    { name: "Successful", value: successful, fill: theme.success },
    { name: "Failed", value: failed, fill: theme.danger },
  ];
  const models = [...byModel].filter((m) => m.count > 0).sort((a, b) => b.count - a.count).slice(0, 4);

  return (
    <ChartCard
      title="Answer outcomes"
      description={sourceLabel}
      loading={loading}
      isEmpty={!loading && (error != null || total === 0)}
      empty={
        error ?? {
          icon: MessageSquareText,
          title: "No answers recorded",
          description: "Successful and failed AI answers appear here once agents use AI.",
        }
      }
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
        <div className="relative shrink-0" style={{ width: DONUT, height: DONUT }}>
          <PieChart width={DONUT} height={DONUT} accessibilityLayer>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={DONUT / 2 - 18}
              outerRadius={DONUT / 2 - 2}
              startAngle={90}
              endAngle={-270}
              stroke={theme.surface}
              strokeWidth={2}
              isAnimationActive={false}
            />
            <Tooltip
              isAnimationActive={false}
              content={
                <ChartTooltip
                  hideLabel
                  valueFormatter={(value) =>
                    typeof value === "number" ? `${formatNumber(value)} (${formatPercent(total ? value / total : null)})` : "—"
                  }
                />
              }
            />
          </PieChart>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-xl font-semibold tabular-nums text-foreground">{formatPercent(rate)}</span>
            <span className="text-xs text-muted-foreground">success</span>
          </div>
        </div>

        <div className="min-w-[12rem] max-w-sm flex-1 space-y-4">
          <ChartLegend
            orientation="vertical"
            items={[
              { label: "Successful", color: theme.success, value: formatNumber(successful), hint: formatPercent(rate) },
              { label: "Failed", color: theme.danger, value: formatNumber(failed), hint: formatPercent(rate == null ? null : 1 - rate) },
            ]}
          />
          <p className="text-xs text-muted-foreground">{formatNumber(total)} answers in total</p>
        </div>
      </div>

      {models.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Error rate by model</p>
          <ul className="space-y-1.5">
            {models.map((model) => (
              <li key={`${model.provider ?? ""}-${model.model_name}`} className="flex items-center gap-3 text-ui">
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground" title={model.model_name}>
                  {model.model_name}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">{formatNumber(model.count)} calls</span>
                <span
                  className={
                    (model.error_rate ?? 0) > 0.05
                      ? "w-14 shrink-0 text-right font-medium tabular-nums text-danger"
                      : "w-14 shrink-0 text-right font-medium tabular-nums text-foreground"
                  }
                >
                  {formatPercent(model.error_rate)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ChartCard>
  );
}
