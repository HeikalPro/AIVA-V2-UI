import { Cloud, Contact, Cpu, Database, Lightbulb, RefreshCw, ScanText, Server, type LucideIcon } from "lucide-react";
import { formatWhen } from "@/lib/doc-intel";
import type { HealthComponentOut, HealthStatus } from "@/types/api";

const ICONS: Record<string, LucideIcon> = {
  microsoft_graph: Cloud,
  crm: Contact,
  knowledge_sync: RefreshCw,
  extraction: ScanText,
  embedding: Cpu,
  database: Database,
};

/** Green = healthy, red = failed, grey = not configured (never counted as a failure). */
const HEALTH_TONE: Record<HealthStatus, { label: string; dot: string; text: string }> = {
  HEALTHY: { label: "Healthy", dot: "bg-emerald-500", text: "text-emerald-700" },
  FAILED: { label: "Failed", dot: "bg-red-500", text: "text-red-700" },
  NOT_CONFIGURED: { label: "Not configured", dot: "bg-muted-foreground", text: "text-muted-foreground" },
};

export function healthStatusLabel(status: HealthStatus): string {
  return (HEALTH_TONE[status] ?? HEALTH_TONE.NOT_CONFIGURED).label;
}

/** Status dot plus the status text in the matching colour. */
export function HealthStatusIndicator({ status, className = "text-sm" }: { status: HealthStatus; className?: string }) {
  const tone = HEALTH_TONE[status] ?? HEALTH_TONE.NOT_CONFIGURED;
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap font-semibold ${tone.text} ${className}`}>
      <span aria-hidden="true" className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone.dot}`} />
      {tone.label}
    </span>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-3">
      <dt>{label}</dt>
      <dd className="text-right text-foreground">{value}</dd>
    </div>
  );
}

export function HealthCard({ component: c }: { component: HealthComponentOut }) {
  const Icon = ICONS[c.key] ?? Server;
  const failed = c.status === "FAILED";

  return (
    <article
      aria-label={`${c.label}: ${healthStatusLabel(c.status)}`}
      className={`flex flex-col rounded-xl border bg-card p-5 shadow-sm ${failed ? "border-red-200" : "border-border"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Icon aria-hidden="true" className="h-4 w-4" />
          </div>
          <h3 className="min-w-0 break-words text-sm font-semibold text-foreground">{c.label}</h3>
        </div>
        <HealthStatusIndicator status={c.status} />
      </div>

      {c.reason && (
        <p className={`mt-3 break-words text-sm ${failed ? "text-red-700" : "text-muted-foreground"}`}>{c.reason}</p>
      )}

      {failed && c.suggested_action && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Lightbulb aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide">Suggested action</p>
            <p className="mt-0.5 break-words">{c.suggested_action}</p>
          </div>
        </div>
      )}

      <dl className="mt-auto space-y-1 pt-4 text-xs text-muted-foreground">
        <Fact label="Checked" value={c.checked_at ? formatWhen(c.checked_at) : "not yet"} />
        <Fact label="Last successful check" value={c.last_success_at ? formatWhen(c.last_success_at) : "never"} />
        {c.latency_ms != null && <Fact label="Latency" value={`${c.latency_ms.toLocaleString()} ms`} />}
        {failed && c.consecutive_failures > 1 && (
          <Fact label="Consecutive failures" value={c.consecutive_failures.toLocaleString()} />
        )}
      </dl>
    </article>
  );
}
