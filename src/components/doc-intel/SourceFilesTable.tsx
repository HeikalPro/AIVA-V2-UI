import type { ReactNode } from "react";
import { AlertTriangle, ExternalLink, FileText, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBytes, formatCount } from "@/lib/doc-intel";
import { safeExternalUrl } from "@/lib/sharepoint-sync";
import { DataTable, actionsColumn, type Column, type DataTableEmpty, type ServerPaginationOptions } from "@/components/data/data-table";
import { Status } from "@/components/data/status";
import { Badge } from "@/components/ui/badge";
import { CrmStagePipeline } from "@/components/doc-intel/CrmStagePipeline";
import { RelativeTime } from "@/components/doc-intel/RelativeTime";
import { FileStatusBadge } from "@/components/doc-intel/SyncBadges";
import type { SourceFileOut } from "@/types/api";

type Props = {
  files: SourceFileOut[];
  loading?: boolean;
  empty?: DataTableEmpty;
  /** Retry a failed file (Super Admin). Omit to hide the action. */
  onRetry?: (file: SourceFileOut) => void;
  retryingId?: number | null;
  pagination?: ServerPaginationOptions;
  toolbar?: ReactNode;
  toolbarEnd?: ReactNode;
};

function fileName(f: SourceFileOut): string {
  return f.name?.trim() || f.path?.split("/").filter(Boolean).pop() || `File #${f.id}`;
}

/** Files found in a source's folder with their five processing stages and extracted entities. */
export function SourceFilesTable({ files, loading, empty, onRetry, retryingId, pagination, toolbar, toolbarEnd }: Props) {
  const columns: Column<SourceFileOut>[] = [
    {
      key: "file",
      header: "File",
      render: (f) => {
        const name = fileName(f);
        const href = safeExternalUrl(f.web_url);
        const warnings = f.warnings ?? [];
        const deleted = f.state === "DELETED";
        return (
          <div className="min-w-[11rem] max-w-[18rem]">
            {href ? (
              <a
                href={href}
                target="_blank"
                rel="noreferrer noopener"
                title={`Open ${name} in SharePoint (new tab)`}
                className={cn(
                  "inline-flex max-w-full items-center gap-1 font-medium text-primary underline-offset-2 hover:underline",
                  deleted && "line-through decoration-muted-foreground",
                )}
              >
                <bdi className="truncate">{name}</bdi>
                <ExternalLink aria-hidden="true" className="h-3 w-3 shrink-0" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <p className={cn("truncate font-medium text-foreground", deleted && "line-through decoration-muted-foreground")} title={name}>
                <bdi>{name}</bdi>
              </p>
            )}
            {f.path && (
              <p className="truncate font-mono text-xs text-muted-foreground" title={f.path}>
                <bdi>{f.path}</bdi>
              </p>
            )}
            {warnings.length > 0 && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-warning" title={warnings.map((w) => w.message).join("\n")}>
                <AlertTriangle aria-hidden="true" className="h-3 w-3 shrink-0" />
                {warnings.length} {warnings.length === 1 ? "warning" : "warnings"}
              </p>
            )}
          </div>
        );
      },
    },
    { key: "size", header: "Size", numeric: true, render: (f) => <span className="whitespace-nowrap">{formatBytes(f.size_bytes)}</span> },
    { key: "modified", header: "Modified", render: (f) => <RelativeTime value={f.modified_at} /> },
    {
      key: "state",
      header: "State",
      render: (f) =>
        f.state === "DELETED" ? (
          <div className="space-y-0.5">
            <Badge variant="neutral">Deleted</Badge>
            {f.deleted_at && <RelativeTime value={f.deleted_at} className="block text-xs text-muted-foreground" />}
          </div>
        ) : (
          <span className="text-foreground">Active</span>
        ),
    },
    {
      key: "pipeline",
      header: "Pipeline",
      render: (f) => <CrmStagePipeline stages={f.stages} fallbackError={f.error_message} />,
    },
    {
      key: "status",
      header: "Status",
      render: (f) => {
        const unattributed = f.status === "FAILED" && !(f.stages ?? []).some((s) => s.status === "FAILED") && f.error_message?.trim();
        return (
          <div className="min-w-[6rem] space-y-0.5">
            <FileStatusBadge status={f.status} />
            {unattributed && (
              <p className="line-clamp-2 max-w-[14rem] break-words text-xs text-danger" title={f.error_message ?? undefined}>
                {f.error_message}
              </p>
            )}
            {retryingId === f.id && <p className="text-xs text-muted-foreground">Queuing retry…</p>}
            {f.attempts > 1 && <p className="whitespace-nowrap text-xs text-muted-foreground">{f.attempts} attempts</p>}
          </div>
        );
      },
    },
    {
      key: "entities",
      header: "Entities",
      render: (f) => (
        <div className="min-w-[5rem] space-y-0.5">
          <p className="tabular-nums text-foreground">{formatCount(f.entity_count)}</p>
          {f.is_valid === true && <Status tone="success" label="Valid" className="text-xs" />}
          {f.is_valid === false && <Status tone="warning" label="Has issues" className="text-xs" />}
        </div>
      ),
    },
  ];

  columns.push(
    actionsColumn<SourceFileOut>(
      (f) => {
        const href = safeExternalUrl(f.web_url);
        return [
          {
            label: "Open in SharePoint",
            icon: ExternalLink,
            hidden: !href,
            onSelect: () => {
              if (href) window.open(href, "_blank", "noopener,noreferrer");
            },
          },
          {
            label: "Retry",
            icon: RotateCcw,
            hidden: !onRetry || f.status !== "FAILED" || f.state !== "ACTIVE",
            disabled: retryingId === f.id,
            onSelect: () => onRetry?.(f),
          },
        ];
      },
      { label: (f) => `Actions for ${fileName(f)}` },
    ),
  );

  return (
    <DataTable<SourceFileOut>
      aria-label="Files"
      columns={columns}
      data={files}
      keyFn={(f) => f.id}
      loading={loading}
      itemLabel="files"
      pagination={pagination ?? false}
      toolbar={toolbar}
      toolbarEnd={toolbarEnd}
      empty={empty ?? { icon: FileText, title: "No files found in this folder yet" }}
    />
  );
}
