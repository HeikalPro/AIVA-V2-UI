import { formatDuration, formatWhen } from "@/lib/doc-intel";
import { RUN_TRIGGER_LABELS, listingIncomplete } from "@/lib/sharepoint-sync";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { RunStatusBadge } from "@/components/doc-intel/SyncBadges";
import type { SyncRunOut } from "@/types/api";

type Props = {
  runs: SyncRunOut[];
  loading?: boolean;
  emptyMessage?: string;
};

function Count({ value, tone }: { value: number; tone?: "red" }) {
  return (
    <span
      className={`block text-right tabular-nums ${value === 0 ? "text-muted-foreground" : tone === "red" ? "font-semibold text-red-700" : "text-foreground"}`}
    >
      {value.toLocaleString()}
    </span>
  );
}

function runDuration(run: SyncRunOut): string {
  const took = formatDuration(run.started_at, run.finished_at);
  if (took) return took;
  if (run.status === "RUNNING") return "running…";
  if (run.status === "QUEUED") return "waiting to start";
  return "—";
}

/** One row per sync: trigger, status, timing and the new / changed / deleted / unchanged / failed counts. */
export function SyncRunsTable({ runs, loading, emptyMessage = "No syncs yet. Press Sync now to run the first one." }: Props) {
  const countCol = (key: string, header: string, pick: (r: SyncRunOut) => number, tone?: "red"): Column<SyncRunOut> => ({
    key,
    header,
    headClassName: "text-right",
    render: (r) => <Count value={pick(r) ?? 0} tone={tone} />,
  });

  const columns: Column<SyncRunOut>[] = [
    {
      key: "trigger",
      header: "Sync",
      render: (r) => (
        <div className="min-w-[7rem]">
          <p className="font-medium text-foreground">{RUN_TRIGGER_LABELS[r.trigger_type] ?? r.trigger_type}</p>
          <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
            #{r.id}
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
          <div className="min-w-[9rem] max-w-xs space-y-1">
            <RunStatusBadge status={r.status} />
            {error && (r.status === "FAILED" || r.status === "PARTIAL") && (
              <p
                className={`line-clamp-3 break-words text-xs ${r.status === "FAILED" ? "text-red-700" : "text-amber-700"}`}
                title={error}
              >
                {error}
              </p>
            )}
            {incomplete && (
              <p className="break-words text-xs text-amber-700">
                Listing incomplete{incomplete.reason ? ` (${incomplete.reason})` : ""}: files missing from it were not
                marked deleted.
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "when",
      header: "When",
      render: (r) => (
        <div className="min-w-[9rem] space-y-0.5 text-xs">
          <p>
            <span className="text-muted-foreground">Started </span>
            {r.started_at ? formatWhen(r.started_at) : r.status === "QUEUED" ? "not yet" : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Finished </span>
            {r.finished_at ? formatWhen(r.finished_at) : "—"}
          </p>
          <p>
            <span className="text-muted-foreground">Took </span>
            {runDuration(r)}
          </p>
        </div>
      ),
    },
    countCol("new", "New", (r) => r.files_new),
    countCol("changed", "Changed", (r) => r.files_changed),
    countCol("deleted", "Deleted", (r) => r.files_deleted),
    countCol("unchanged", "Unchanged", (r) => r.files_unchanged),
    countCol("failed", "Failed", (r) => r.files_failed, "red"),
  ];

  return <DataTable columns={columns} data={runs} keyFn={(r) => r.id} loading={loading} emptyMessage={emptyMessage} />;
}
