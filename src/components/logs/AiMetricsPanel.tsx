import { useState } from "react";
import { Activity, AlertCircle, CheckCircle2, Clock, Coins, Gauge, Timer } from "lucide-react";
import { useAiMetrics } from "@/hooks/useLogs";
import { KPIStatCard } from "@/components/shared/KPIStatCard";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AiMetricsBreakdownItem } from "@/types/api";

function fmtLatency(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

const tokenFmt = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });
function fmtTokens(n: number | null | undefined): string {
  if (n == null) return "—";
  return tokenFmt.format(n);
}

function fmtPct(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

export function AiMetricsPanel({ accountId }: { accountId?: number | null }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [applied, setApplied] = useState<{ start?: string; end?: string }>({});

  const { data, isLoading } = useAiMetrics({
    account_id: accountId ?? undefined,
    start: applied.start,
    end: applied.end,
  });
  const summary = data?.summary;

  const columns: Column<AiMetricsBreakdownItem>[] = [
    { key: "model", header: "Model", sortable: true, sortValue: (r) => r.model_name, render: (r) => r.model_name },
    { key: "count", header: "Count", sortable: true, sortValue: (r) => r.count, render: (r) => r.count.toLocaleString() },
    { key: "avg", header: "Avg latency", sortable: true, sortValue: (r) => r.avg_latency_ms ?? 0, render: (r) => fmtLatency(r.avg_latency_ms) },
    { key: "min", header: "Min latency", render: (r) => fmtLatency(r.min_latency_ms) },
    { key: "max", header: "Max latency", render: (r) => fmtLatency(r.max_latency_ms) },
    { key: "tokens", header: "Total tokens", sortable: true, sortValue: (r) => r.total_tokens, render: (r) => fmtTokens(r.total_tokens) },
    {
      key: "err",
      header: "Error rate",
      sortable: true,
      sortValue: (r) => r.error_rate ?? 0,
      render: (r) => (
        <span className={r.error_rate && r.error_rate > 0.05 ? "font-semibold text-red-600" : ""}>{fmtPct(r.error_rate)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">AI metrics</h3>
          <p className="text-xs text-muted-foreground">Aggregate LLM-call stats across all statuses. Filter by date to scope the window.</p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="ai-start">From</Label>
            <Input id="ai-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="ai-end">To</Label>
            <Input id="ai-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1" />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mb-0.5"
            onClick={() => setApplied({ start: start || undefined, end: end || undefined })}
          >
            Apply
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        <KPIStatCard label="Total LLM calls" value={summary ? summary.total_calls.toLocaleString() : "—"} icon={<Activity className="h-4 w-4" />} />
        <KPIStatCard label="Avg latency" value={fmtLatency(summary?.avg_latency_ms)} icon={<Clock className="h-4 w-4" />} />
        <KPIStatCard label="Min latency" value={fmtLatency(summary?.min_latency_ms)} icon={<Gauge className="h-4 w-4" />} />
        <KPIStatCard label="Max latency" value={fmtLatency(summary?.max_latency_ms)} icon={<Timer className="h-4 w-4" />} />
        <KPIStatCard label="Total tokens" value={fmtTokens(summary?.total_tokens)} icon={<Coins className="h-4 w-4" />} />
        <KPIStatCard
          label="Success rate"
          value={fmtPct(summary?.success_rate)}
          icon={<CheckCircle2 className="h-4 w-4" />}
          iconColor="bg-emerald-100 text-emerald-700"
        />
        <KPIStatCard
          label="Error rate"
          value={fmtPct(summary?.error_rate)}
          icon={<AlertCircle className="h-4 w-4" />}
          iconColor="bg-red-100 text-red-700"
        />
      </div>

      <div>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Metrics by model</h4>
        <DataTable
          columns={columns}
          data={data?.by_model ?? []}
          keyFn={(r) => r.model_name}
          loading={isLoading}
          emptyMessage="No LLM calls in this range."
        />
      </div>
    </div>
  );
}
