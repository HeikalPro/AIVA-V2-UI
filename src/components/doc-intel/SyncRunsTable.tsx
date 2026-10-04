import type { ReactNode } from "react";
import { History } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { formatDuration } from "@/lib/doc-intel";
import { RUN_TRIGGER_LABELS, listingIncomplete } from "@/lib/sharepoint-sync";
import { DataTable, type Column, type DataTableEmpty, type ServerPaginationOptions } from "@/components/data/data-table";
import { RelativeTime } from "@/components/doc-intel/RelativeTime";
import { RunStatusBadge } from "@/components/doc-intel/SyncBadges";
import type { SyncRunOut } from "@/types/api";

type Props = {
  runs: SyncRunOut[];
  loading?: boolean;
  empty?: DataTableEmpty;
  /** Server pagination ({items, limit, offset, total} API). */
  pagination?: ServerPaginationOptions;
  toolbar?: ReactNode;
  toolbarEnd?: ReactNode;
};

function Count({ value, danger = false }: { value: number; danger?: boolean }) {
  return (
    <span className={cn(value === 0 ? "text-muted-foreground" : danger ? "font-medium text-danger" : "text-foreground")}>
      {formatNumber(value)}
    </span>
  );
}

function runDuration(run: SyncRunOut): string {
  const took = formatDuration(run.started_at, run.finished_at);
  if (took) return took;
  if (run.status === "RUNNING") return "Running…";
  if (run.status === "QUEUED") return "Waiting to start";
  return "—";
}

/** One row per sync: trigger, status, timing and the new / changed / deleted / unchanged / failed counts. */
export function SyncRunsTable({ runs, loading, empty, pagination, toolbar, toolbarEnd }: Props) {
  const countCol = (key: string, header: string, pick: (r: SyncRunOut) => number, danger = false): Column<SyncRunOut> => ({
    key,
    header,
    numeric: true,
    render: (r) => <Count value={pick(r) ?? 0} danger={danger} />,
  });

  const columns: Column<SyncRunOut>[] = [
    {
      key: "trigger",
      header: "Sync",
      render: (r) => (
        <div className="min-w-[8rem]">
          <p className="font-medium text-foreground">{RUN_TRIGGER_LABELS[r.trigger_type] ?? r.trigger_type}</p>
          <p className="truncate text-xs text-muted-foreground">
            <span className="font-mono">#{r.id}</span>
            {r.trigger_type === "MANUAL" && (r.triggered_by_email || r.triggered_by != null)
              ? ` · ${r.triggered_by_email ?? `User #${r.triggered_by}`}`
              : ""}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (r) => {
        const incomplete = listingIncomplete(r);
        const error = r.error_message?.trim();
        return (
          <div className="min-w-[8rem] max-w-[20rem] space-y-0.5">
            <RunStatusBadge status={r.status} />
            {error && (r.status === "FAILED" || r.status === "PARTIAL") && (
              <p className={cn("line-clamp-2 break-words text-xs", r.status === "FAILED" ? "text-danger" : "text-warning")} title={error}>
                {error}
              </p>
            )}
            {incomplete && (
              <p className="break-words text-xs text-warning">
                Listing incomplete{incomplete.reason ? ` (${incomplete.reason})` : ""}: files missing from it were not marked deleted.
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "started",
      header: "Started",
      render: (r) =>
        r.started_at ? (
          <RelativeTime value={r.started_at} />
        ) : (
          <span className="text-muted-foreground">{r.status === "QUEUED" ? "Not yet" : "—"}</span>
        ),
    },
    { key: "duration", header: "Duration", render: (r) => <span className="whitespace-nowrap">{runDuration(r)}</span> },
    countCol("new", "New", (r) => r.files_new),
    countCol("changed", "Changed", (r) => r.files_changed),
    countCol("deleted", "Deleted", (r) => r.files_deleted),
    countCol("unchanged", "Unchanged", (r) => r.files_unchanged),
    countCol("failed", "Failed", (r) => r.files_failed, true),
  ];

  return (
    <DataTable<SyncRunOut>
      aria-label="Sync history"
      columns={columns}
      data={runs}
      keyFn={(r) => r.id}
      loading={loading}
      itemLabel="syncs"
      itemLabelSingular="sync"
      pagination={pagination ?? false}
      toolbar={toolbar}
      toolbarEnd={toolbarEnd}
      empty={empty ?? { icon: History, title: "No syncs yet", description: "Press Sync now to run the first one." }}
    />
  );
}
