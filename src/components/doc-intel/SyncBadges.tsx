import { KeyRound } from "lucide-react";
import { formatDate } from "@/lib/format";
import {
  ENTITY_STATUS_LABELS,
  FILE_STATUS_LABELS,
  RUN_STATUS_LABELS,
  SOURCE_STATUS_LABELS,
} from "@/lib/sharepoint-sync";
import { Status, type StatusTone } from "@/components/data/status";
import { Badge } from "@/components/ui/badge";
import { RelativeTime } from "./RelativeTime";
import type { EntityStatus, FileStatus, RunStatus, SourceOut, SourceStatus } from "@/types/api";

/*
 * SharePoint sync statuses, all rendered with the shared <Status> (dot + label; running states
 * pulse). Labels come from lib/sharepoint-sync so wording stays identical everywhere.
 */

const RUN_TONE: Record<RunStatus, StatusTone> = {
  QUEUED: "neutral",
  RUNNING: "warning",
  COMPLETED: "success",
  PARTIAL: "warning",
  FAILED: "danger",
};

type BadgeProps = { className?: string; variant?: "dot" | "badge" };

/** Completed (green), partial (amber), failed (red), running (amber, pulsing), queued (grey). */
export function RunStatusBadge({ status, className, variant }: { status: RunStatus } & BadgeProps) {
  return (
    <Status
      tone={RUN_TONE[status] ?? "neutral"}
      label={RUN_STATUS_LABELS[status] ?? status}
      pulse={status === "RUNNING"}
      variant={variant}
      className={className}
    />
  );
}

const FILE_TONE: Record<FileStatus, StatusTone> = {
  PENDING: "neutral",
  PROCESSING: "warning",
  COMPLETED: "success",
  FAILED: "danger",
  SKIPPED: "neutral",
};

export function FileStatusBadge({ status, className, variant }: { status: FileStatus } & BadgeProps) {
  return (
    <Status
      tone={FILE_TONE[status] ?? "neutral"}
      label={FILE_STATUS_LABELS[status] ?? status}
      pulse={status === "PROCESSING"}
      variant={variant}
      className={className}
    />
  );
}

export function SourceStatusBadge({ status, className, variant }: { status: SourceStatus } & BadgeProps) {
  return (
    <Status
      tone={status === "ACTIVE" ? "success" : "neutral"}
      label={SOURCE_STATUS_LABELS[status] ?? status}
      variant={variant}
      className={className}
    />
  );
}

export function EntityStatusBadge({ status, className, variant }: { status: EntityStatus } & BadgeProps) {
  return (
    <Status
      tone={status === "ACTIVE" ? "success" : "neutral"}
      label={ENTITY_STATUS_LABELS[status] ?? status}
      variant={variant}
      className={className}
    />
  );
}

/**
 * Status, time and error of a source's last sync, plus its last success (no links: Developers see
 * it on Monitoring, where the SharePoint Sync page is not open to them). `showActive` adds the
 * queued/running run on top.
 */
export function LastSyncSummary({
  source,
  showActive = false,
}: {
  source: Pick<SourceOut, "last_sync_at" | "last_sync_status" | "last_sync_error" | "last_success_at" | "active_run">;
  showActive?: boolean;
}) {
  const run = source.active_run;
  const active = showActive && run && (run.status === "QUEUED" || run.status === "RUNNING");
  const error = source.last_sync_error?.trim();
  const showError = error && (source.last_sync_status === "FAILED" || source.last_sync_status === "PARTIAL");
  const never = !source.last_sync_at && !source.last_sync_status;
  return (
    <div className="min-w-0 space-y-1">
      {active && (
        <Status
          tone={run.status === "QUEUED" ? "neutral" : "warning"}
          pulse={run.status === "RUNNING"}
          label={run.status === "QUEUED" ? "Sync queued" : "Sync running"}
        />
      )}
      {never ? (
        <p className="text-sm text-muted-foreground">Never synced</p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {source.last_sync_status && <RunStatusBadge status={source.last_sync_status} />}
          <RelativeTime value={source.last_sync_at} className="text-ui text-muted-foreground" />
        </div>
      )}
      {showError && (
        <p
          className={`line-clamp-3 break-words text-xs ${source.last_sync_status === "FAILED" ? "text-danger" : "text-warning"}`}
          title={error}
        >
          {error}
        </p>
      )}
      {source.last_success_at && source.last_success_at !== source.last_sync_at && (
        <p className="text-xs text-muted-foreground">
          Last successful sync <RelativeTime value={source.last_success_at} />
        </p>
      )}
    </div>
  );
}

/** "Stored · ends …abcd · updated <date>". The secret itself is never sent to the browser. */
export function SecretBadge({
  source,
  showHint = true,
}: {
  source: Pick<SourceOut, "client_secret_set" | "client_secret_hint" | "secret_updated_at" | "credentials_readable">;
  showHint?: boolean;
}) {
  if (!source.client_secret_set) {
    return (
      <Badge variant="warning">
        <KeyRound aria-hidden="true" className="h-3.5 w-3.5" />
        Not stored
      </Badge>
    );
  }
  const parts = [
    "Stored",
    showHint && source.client_secret_hint ? `ends ${source.client_secret_hint}` : null,
    source.secret_updated_at ? `updated ${formatDate(source.secret_updated_at)}` : null,
  ].filter(Boolean);
  const unreadable = source.credentials_readable === false;
  return (
    <Badge variant={unreadable ? "danger" : "success"} className="max-w-full whitespace-normal">
      <KeyRound aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {parts.join(" · ")}
        {unreadable ? " · can't be decrypted" : ""}
      </span>
    </Badge>
  );
}
