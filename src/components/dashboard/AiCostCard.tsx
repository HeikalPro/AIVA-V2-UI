import type { ReactNode } from "react";
import { Coins } from "lucide-react";
import { formatCompactNumber, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { ChartCard, useChartTheme, type ChartCardEmpty } from "@/components/data/chart";
import type { AiMetricsBreakdownItem } from "@/types/api";

type AiCostCardProps = {
  /** Total cost in EGP (server-side, markup included). */
  cost: number | null | undefined;
  /** AI requests in the same window (for the per-request average). */
  requests: number | null | undefined;
  /** Window/source line under the title. */
  sourceLabel: string;
  /** Small token figures shown next to the per-request cost. */
  tokens: { label: string; value: number | null | undefined }[];
  /** Usage breakdown (calls/tokens per model). There is no per-model cost in the API. */
  byModel?: AiMetricsBreakdownItem[];
  /** Short note under the content (e.g. why the model breakdown is missing). */
  note?: ReactNode;
  loading?: boolean;
  error?: ChartCardEmpty | null;
};

/** What AI is costing: total, per request, tokens, and model usage share (usage, not cost). */
export function AiCostCard({ cost, requests, sourceLabel, tokens, byModel = [], note, loading = false, error }: AiCostCardProps) {
  const theme = useChartTheme();
  const perRequest = cost != null && requests ? cost / requests : null;
  const models = [...byModel].filter((m) => m.count > 0).sort((a, b) => b.count - a.count);
  const totalCalls = models.reduce((sum, m) => sum + m.count, 0);
  const shown = models.slice(0, 4);
  const hasAnything = cost != null || (requests ?? 0) > 0 || tokens.some((t) => (t.value ?? 0) > 0);

  return (
    <ChartCard
      title="AI cost"
      description={sourceLabel}
      loading={loading}
      isEmpty={!loading && (error != null || !hasAnything)}
      empty={error ?? { icon: Coins, title: "No AI cost recorded", description: "Costs appear once AI requests are billed." }}
    >
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{formatMoney(cost)}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Total cost, markup included</p>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-2 text-ui">
          <div>
            <dt className="text-xs text-muted-foreground">Per request</dt>
            <dd className="font-semibold tabular-nums text-foreground">{formatMoney(perRequest)}</dd>
          </div>
          {tokens.map((t) => (
            <div key={t.label}>
              <dt className="text-xs text-muted-foreground">{t.label}</dt>
              <dd className="font-semibold tabular-nums text-foreground" title={t.value != null ? formatNumber(t.value) : undefined}>
                {formatCompactNumber(t.value)}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {shown.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Usage by model (share of calls)</p>
          <ul className="space-y-2.5">
            {shown.map((model, idx) => {
              const share = totalCalls > 0 ? model.count / totalCalls : 0;
              const color = theme.series[idx % theme.series.length];
              return (
                <li key={`${model.provider ?? ""}-${model.model_name}`} className="space-y-1">
                  <div className="flex items-baseline gap-3 text-ui">
                    <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground" title={model.model_name}>
                      {model.model_name}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {formatNumber(model.count)} calls · {formatCompactNumber(model.total_tokens)} tokens
                    </span>
                    <span className="w-12 shrink-0 text-right font-medium tabular-nums text-foreground">{formatPercent(share, 0)}</span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-muted"
                    role="img"
                    aria-label={`${model.model_name}: ${formatPercent(share, 0)} of calls`}
                  >
                    <div className="h-full rounded-full" style={{ width: `${Math.max(share * 100, 1)}%`, backgroundColor: color }} />
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {note && <p className="mt-3 text-xs text-muted-foreground">{note}</p>}
    </ChartCard>
  );
}
