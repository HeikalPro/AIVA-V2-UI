import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { formatBytes, formatCount, formatWhen } from "@/lib/doc-intel";
import { safeExternalUrl } from "@/lib/sharepoint-sync";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CrmStagePipeline } from "@/components/doc-intel/CrmStagePipeline";
import { FileStatusBadge } from "@/components/doc-intel/SyncBadges";
import type { SourceFileOut } from "@/types/api";

type Props = {
  files: SourceFileOut[];
  loading?: boolean;
  emptyMessage?: string;
  /** Retry a failed file (Super Admin). Omit to hide the action. */
  onRetry?: (file: SourceFileOut) => void;
  retryingId?: number | null;
};

function fileName(f: SourceFileOut): string {
  return f.name?.trim() || f.path?.split("/").filter(Boolean).pop() || `File #${f.id}`;
}

/** Files found in a source's folder with their five processing stages and extracted entities. */
export function SourceFilesTable({ files, loading, emptyMessage = "No files found in this folder yet.", onRetry, retryingId }: Props) {
  const columns: Column<SourceFileOut>[] = [
    {
      key: "file",
      header: "File",
      render: (f) => {
        const name = fileName(f);
        const href = safeExternalUrl(f.web_url);
        const warnings = f.warnings ?? [];
        return (
          <div className="min-w-[10rem] max-w-[16rem]">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                title={`Open ${name} in SharePoint (new tab)`}
                className={`inline-flex max-w-full items-start gap-1 font-medium text-primary underline-offset-2 hover:underline ${f.state === "DELETED" ? "line-through decoration-muted-foreground" : ""}`}
              >
                <span dir="auto" className="line-clamp-2 [overflow-wrap:anywhere]">
                  {name}
                </span>
                <ExternalLink aria-hidden="true" className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <p
                dir="auto"
                className={`line-clamp-2 font-medium text-foreground [overflow-wrap:anywhere] ${f.state === "DELETED" ? "line-through decoration-muted-foreground" : ""}`}
                title={name}
              >
                {name}
              </p>
            )}
            {f.path && (
              <p dir="auto" className="line-clamp-2 text-xs text-muted-foreground [overflow-wrap:anywhere]">
                {f.path}
              </p>
            )}
            {warnings.length > 0 && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-amber-700" title={warnings.map((w) => w.message).join("\n")}>
                <AlertTriangle aria-hidden="true" className="h-3 w-3 shrink-0" />
                {warnings.length} {warnings.length === 1 ? "warning" : "warnings"}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "size",
      header: "Size",
      render: (f) => <span className="whitespace-nowrap text-xs">{formatBytes(f.size_bytes)}</span>,
    },
    {
      key: "modified",
      header: "Modified",
      render: (f) => <span className="block min-w-[5.5rem] text-xs">{formatWhen(f.modified_at)}</span>,
    },
    {
      key: "state",
      header: "State",
      render: (f) =>
        f.state === "DELETED" ? (
          <div className="min-w-[5.5rem] space-y-1">
            <Badge variant="muted">Deleted</Badge>
            {f.deleted_at && <p className="text-xs text-muted-foreground">{formatWhen(f.deleted_at)}</p>}
          </div>
        ) : (
          <span className="text-xs text-foreground">Active</span>
        ),
    },
    {
      key: "pipeline",
      header: "Pipeline",
      render: (f) => <CrmStagePipeline className="min-w-[13rem]" stages={f.stages} fallbackError={f.error_message} />,
    },
    {
      key: "status",
      header: "Status",
      render: (f) => {
        const unattributed = f.status === "FAILED" && !(f.stages ?? []).some((s) => s.status === "FAILED") && f.error_message?.trim();
        return (
          <div className="min-w-[6rem] space-y-1">
            <FileStatusBadge status={f.status} />
            {unattributed && (
              <p className="line-clamp-3 max-w-[14rem] break-words text-xs text-red-700" title={f.error_message ?? undefined}>
                {f.error_message}
              </p>
            )}
            {f.attempts > 1 && <p className="whitespace-nowrap text-xs text-muted-foreground">{f.attempts} attempts</p>}
          </div>
        );
      },
    },
    {
      key: "entities",
      header: "Entities",
      render: (f) => (
        <div className="min-w-[5rem] space-y-0.5 text-xs">
          <p className="tabular-nums text-foreground">{formatCount(f.entity_count)}</p>
          {f.is_valid === true && (
            <p className="inline-flex items-center gap-1 text-emerald-700">
              <CheckCircle2 aria-hidden="true" className="h-3 w-3" /> valid
            </p>
          )}
          {f.is_valid === false && (
            <p className="inline-flex items-center gap-1 text-amber-700">
              <AlertTriangle aria-hidden="true" className="h-3 w-3" /> has issues
            </p>
          )}
        </div>
      ),
    },
  ];

  if (onRetry) {
    columns.push({
      key: "actions",
      header: "Actions",
      render: (f) => {
        if (f.status !== "FAILED" || f.state !== "ACTIVE") return <span className="text-xs text-muted-foreground">—</span>;
        const retrying = retryingId === f.id;
        return (
          <Button variant="outline" size="sm" disabled={retrying} onClick={() => onRetry(f)} aria-label={`Retry ${fileName(f)}`}>
            {retrying ? (
              <Loader2 aria-hidden="true" className="mr-1 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RotateCcw aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
            )}
            Retry
          </Button>
        );
      },
    });
  }

  return <DataTable columns={columns} data={files} keyFn={(f) => f.id} loading={loading} emptyMessage={emptyMessage} />;
}
