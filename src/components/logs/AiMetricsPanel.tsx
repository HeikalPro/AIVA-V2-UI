import { useState } from "react";
import { Cpu } from "lucide-react";
import { useAiMetrics } from "@/hooks/useLogs";
import { formatCompactNumber, formatDurationMs, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterBar, type DateRangeValue } from "@/components/data/filter-bar";
import { Stat, StatGroup } from "@/components/data/stat";
import type { AiMetricsBreakdownItem } from "@/types/api";

/** Aggregate LLM-call stats (all statuses) and a per-model breakdown, optionally scoped to a date range. */
export function AiMetricsPanel({ accountId }: { accountId?: number | null }) {
  const [range, setRange] = useState<DateRangeValue>({ from: "", to: "" });

  const { data, isLoading } = useAiMetrics({
    account_id: accountId ?? undefined,
    start: range.from || undefined,
    end: range.to || undefined,
  });
  const summary = data?.summary;
  const loading = isLoading && !data;

  const columns: Column<AiMetricsBreakdownItem>[] = [
    {
      key: "model_name",
      header: "Model",
      sortable: true,
      render: (r) => <span className="font-mono text-xs">{r.model_name}</span>,
    },
    { key: "provider", header: "Provider", render: (r) => r.provider ?? "—" },
    { key: "count", header: "Calls", numeric: true, sortable: true, render: (r) => formatNumber(r.count) },
    { key: "avg_latency_ms", header: "Avg latency", numeric: true, sortable: true, render: (r) => formatDurationMs(r.avg_latency_ms) },
    { key: "min_latency_ms", header: "Min latency", numeric: true, render: (r) => formatDurationMs(r.min_latency_ms) },
    { key: "max_latency_ms", header: "Max latency", numeric: true, render: (r) => formatDurationMs(r.max_latency_ms) },
    { key: "total_tokens", header: "Tokens", numeric: true, sortable: true, render: (r) => formatCompactNumber(r.total_tokens) },
    {
      key: "error_rate",
      header: "Error rate",
      numeric: true,
      sortable: true,
      render: (r) => (
        <span className={r.error_rate && r.error_rate > 0.05 ? "font-medium text-danger" : undefined}>{formatPercent(r.error_rate)}</span>
      ),
    },
  ];

  return (
    <section className="space-y-3" aria-labelledby="ai-metrics-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="ai-metrics-heading" className="text-base font-semibold text-foreground">
            AI metrics
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Aggregate LLM-call stats across all statuses.</p>
        </div>
        <FilterBar
          dateRange={{ ...range, onChange: setRange, presets: true, label: "Period" }}
          onClear={() => setRange({ from: "", to: "" })}
        />
      </div>

      <StatGroup columns={4} variant="strip" aria-label="AI metrics summary">
        <Stat emphasis="secondary" label="LLM calls" loading={loading} value={formatNumber(summary?.total_calls)} />
        <Stat emphasis="secondary" label="Success rate" loading={loading} value={formatPercent(summary?.success_rate)} />
        <Stat emphasis="secondary" label="Error rate" loading={loading} value={formatPercent(summary?.error_rate)} />
        <Stat
          emphasis="secondary"
          label="Total cost"
          loading={loading}
          value={formatMoney(summary?.total_cost)}
          info="Cost of LLM calls in EGP, computed by the server with the configured markup included."
        />
        <Stat emphasis="secondary" label="Avg latency" loading={loading} value={formatDurationMs(summary?.avg_latency_ms)} />
        <Stat emphasis="secondary" label="Min latency" loading={loading} value={formatDurationMs(summary?.min_latency_ms)} />
        <Stat emphasis="secondary" label="Max latency" loading={loading} value={formatDurationMs(summary?.max_latency_ms)} />
        <Stat emphasis="secondary" label="Total tokens" loading={loading} value={formatCompactNumber(summary?.total_tokens)} />
      </StatGroup>

      <DataTable<AiMetricsBreakdownItem>
        aria-label="Metrics by model"
        columns={columns}
        data={data?.by_model ?? []}
        keyFn={(r) => r.model_name}
        loading={loading}
        skeletonRows={3}
        density="compact"
        pagination={false}
        itemLabel="models"
        defaultSort={{ key: "count", dir: "desc" }}
        empty={{ icon: Cpu, title: "No LLM calls in this range" }}
      />
    </section>
  );
}
