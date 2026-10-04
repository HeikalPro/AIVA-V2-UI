import { Cpu, Database, MessageSquare, Server, ShieldCheck, type LucideIcon } from "lucide-react";
import { formatDurationMs } from "@/lib/format";
import { useSystemComponents } from "@/hooks/useSystemHealth";
import { DataTable, type Column } from "@/components/data/data-table";
import { Status, type StatusTone } from "@/components/data/status";
import { RelativeTime } from "@/components/doc-intel/RelativeTime";
import { AutoRefreshIndicator } from "./AutoRefreshIndicator";
import type { ComponentHealth } from "@/types/api";

/** Display only: mirrors COMPONENTS_REFETCH_MS in hooks/useSystemHealth. */
const COMPONENTS_REFRESH_MS = 15_000;

const ICONS: Record<string, LucideIcon> = {
  database: Database,
  llm: Cpu,
  redis: Server,
  chatbot: MessageSquare,
};

const STATUS: Record<string, { tone: StatusTone; label: string }> = {
  up: { tone: "success", label: "Operational" },
  degraded: { tone: "warning", label: "Degraded" },
  down: { tone: "danger", label: "Down" },
  not_configured: { tone: "neutral", label: "Not configured" },
  unknown: { tone: "neutral", label: "Unknown" },
};

const STATUS_ORDER: Record<string, number> = { down: 0, degraded: 1, up: 2, not_configured: 3, unknown: 4 };

function componentStatus(status: string) {
  return STATUS[status] ?? { tone: "neutral" as StatusTone, label: status ? status.charAt(0).toUpperCase() + status.slice(1) : "—" };
}

/** Backend dependencies (database, LLM gateway, Redis, chatbot) with live status and latency. */
export function SystemComponentsSection() {
  const { data, isLoading, isFetching } = useSystemComponents();

  const columns: Column<ComponentHealth>[] = [
    {
      key: "label",
      header: "Component",
      sortable: true,
      render: (c) => {
        const Icon = ICONS[c.key] ?? Server;
        return (
          <span className="inline-flex items-center gap-2.5 font-medium text-foreground">
            <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
            {c.label}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (c) => STATUS_ORDER[c.status] ?? 5,
      render: (c) => {
        const s = componentStatus(c.status);
        return <Status tone={s.tone} label={s.label} />;
      },
    },
    { key: "latency_ms", header: "Latency", numeric: true, sortable: true, render: (c) => formatDurationMs(c.latency_ms) },
    {
      key: "detail",
      header: "Details",
      truncate: true,
      maxWidth: "32rem",
      cellTitle: (c) => [c.info, c.detail].filter(Boolean).join(" · ") || undefined,
      render: (c) =>
        c.detail || c.info ? (
          <span>
            {c.info && <span className="text-muted-foreground">{c.info}</span>}
            {c.info && c.detail && <span className="text-muted-foreground"> · </span>}
            {c.detail && <span className={c.status === "up" ? "text-foreground" : "text-danger"}>{c.detail}</span>}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <section className="space-y-3" aria-labelledby="system-components-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="system-components-heading" className="text-base font-semibold text-foreground">
            Components
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Backend dependencies, checked live
            {data?.generated_at && (
              <>
                {" "}
                · last check <RelativeTime value={data.generated_at} />
              </>
            )}
            .
          </p>
        </div>
        <AutoRefreshIndicator intervalMs={COMPONENTS_REFRESH_MS} fetching={isFetching} />
      </div>
      <DataTable<ComponentHealth>
        aria-label="System components"
        columns={columns}
        data={data?.components ?? []}
        keyFn={(c) => c.key}
        loading={isLoading && !data}
        skeletonRows={4}
        pagination={false}
        itemLabel="components"
        defaultSort={{ key: "status", dir: "asc" }}
        empty={{ icon: ShieldCheck, title: "Component status is not available" }}
      />
    </section>
  );
}
