import { KeyRound, Loader2 } from "lucide-react";
import { formatWhen } from "@/lib/doc-intel";
import {
  ENTITY_STATUS_LABELS,
  FILE_STATUS_LABELS,
  RUN_STATUS_LABELS,
  SOURCE_STATUS_LABELS,
} from "@/lib/sharepoint-sync";
import type { EntityStatus, FileStatus, RunStatus, SourceOut, SourceStatus } from "@/types/api";

type Tone = "grey" | "running" | "green" | "amber" | "red";

// Same shapes as ui/badge; "running" uses the theme primary (text-primary), everything else
// dark-remapped shades, so no index.css change is needed.
const TONE_CLASS: Record<Tone, string> = {
  grey: "bg-slate-100 text-slate-600",
  running: "bg-primary/10 text-primary",
  green: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
};

function StatusPill({ tone, label, spin = false }: { tone: Tone; label: string; spin?: boolean }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[tone]}`}
    >
      {spin && <Loader2 aria-hidden="true" className="mr-1 h-3 w-3 animate-spin" />}
      {label}
    </span>
  );
}

const RUN_TONE: Record<RunStatus, Tone> = {
  QUEUED: "grey",
  RUNNING: "running",
  COMPLETED: "green",
  PARTIAL: "amber",
  FAILED: "red",
};

/** COMPLETED green, PARTIAL amber, FAILED red, RUNNING spinner, QUEUED grey. */
export function RunStatusBadge({ status }: { status: RunStatus }) {
  return <StatusPill tone={RUN_TONE[status] ?? "grey"} label={RUN_STATUS_LABELS[status] ?? status} spin={status === "RUNNING"} />;
}

const FILE_TONE: Record<FileStatus, Tone> = {
  PENDING: "grey",
  PROCESSING: "running",
  COMPLETED: "green",
  FAILED: "red",
  SKIPPED: "grey",
};

export function FileStatusBadge({ status }: { status: FileStatus }) {
  return (
    <StatusPill tone={FILE_TONE[status] ?? "grey"} label={FILE_STATUS_LABELS[status] ?? status} spin={status === "PROCESSING"} />
  );
}

export function SourceStatusBadge({ status }: { status: SourceStatus }) {
  return <StatusPill tone={status === "ACTIVE" ? "green" : "grey"} label={SOURCE_STATUS_LABELS[status] ?? status} />;
}

export function EntityStatusBadge({ status }: { status: EntityStatus }) {
  return <StatusPill tone={status === "ACTIVE" ? "green" : "grey"} label={ENTITY_STATUS_LABELS[status] ?? status} />;
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
        <p className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
          <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
          {run.status === "QUEUED" ? "Sync queued" : "Sync running"}
        </p>
      )}
      {never ? (
        <p className="text-sm text-muted-foreground">Never synced.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {source.last_sync_status && <RunStatusBadge status={source.last_sync_status} />}
          <span className="text-sm text-foreground">{formatWhen(source.last_sync_at)}</span>
        </div>
      )}
      {showError && (
        <p
          className={`line-clamp-3 break-words text-xs ${source.last_sync_status === "FAILED" ? "text-red-700" : "text-amber-700"}`}
          title={error}
        >
          {error}
        </p>
      )}
      {source.last_success_at && source.last_success_at !== source.last_sync_at && (
        <p className="text-xs text-muted-foreground">Last successful sync: {formatWhen(source.last_success_at)}</p>
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
      <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">
        <KeyRound aria-hidden="true" className="h-3.5 w-3.5" />
        Not stored
      </span>
    );
  }
  const parts = [
    "Stored",
    showHint && source.client_secret_hint ? `ends ${source.client_secret_hint}` : null,
    source.secret_updated_at ? `updated ${formatWhen(source.secret_updated_at)}` : null,
  ].filter(Boolean);
  const unreadable = source.credentials_readable === false;
  return (
    <span
      className={`inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${
        unreadable ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-800"
      }`}
    >
      <KeyRound aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">
        {parts.join(" · ")}
        {unreadable ? " · can't be decrypted" : ""}
      </span>
    </span>
  );
}
