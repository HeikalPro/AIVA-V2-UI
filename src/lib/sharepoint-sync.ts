/** Shared helpers for SharePoint Sync (Flow 2): CRM stages, run/file/entity labels, schedule text, errors. */
import { ApiError, formatUserError } from "@/lib/errors";
import { notInstalled, type DocIntelUnavailable, type StageDef } from "@/lib/doc-intel";
import type {
  CrmStageName,
  EntityStatus,
  FileState,
  FileStatus,
  RunStatus,
  RunTrigger,
  SourceOut,
  SourceStatus,
  SyncRunOut,
} from "@/types/api";

/** The five SharePoint-file stages in pipeline order (CRM_STAGES in backend/doc_intel/constants.py). */
export const CRM_STAGES: readonly StageDef<CrmStageName>[] = [
  { name: "download", label: "Download", short: "Download" },
  { name: "extraction", label: "Extraction", short: "Extract" },
  { name: "intelligence", label: "CRM intelligence", short: "Intelligence" },
  { name: "entities", label: "Entities", short: "Entities" },
  { name: "persist", label: "Save to CRM", short: "Save" },
];

export function crmStageLabel(name: string | null | undefined): string {
  if (!name) return "—";
  return CRM_STAGES.find((s) => s.name === name)?.label ?? humanize(name);
}

function humanize(value: string): string {
  const text = value.replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : value;
}

// ---- Statuses --------------------------------------------------------------------------------

export const RUN_STATUS_LABELS: Record<RunStatus, string> = {
  QUEUED: "Queued",
  RUNNING: "Running",
  COMPLETED: "Completed",
  PARTIAL: "Partial",
  FAILED: "Failed",
};

export const RUN_TRIGGER_LABELS: Record<RunTrigger, string> = {
  MANUAL: "Manual",
  SCHEDULED: "Scheduled",
};

export const SOURCE_STATUS_LABELS: Record<SourceStatus, string> = {
  ACTIVE: "Active",
  DISABLED: "Disabled",
  DELETED: "Deleted",
};

export const FILE_STATES: readonly FileState[] = ["ACTIVE", "DELETED"];

export const FILE_STATE_LABELS: Record<FileState, string> = {
  ACTIVE: "Active",
  DELETED: "Deleted",
};

export const FILE_STATUSES: readonly FileStatus[] = ["PENDING", "PROCESSING", "COMPLETED", "FAILED", "SKIPPED"];

export const FILE_STATUS_LABELS: Record<FileStatus, string> = {
  PENDING: "Waiting",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  FAILED: "Failed",
  SKIPPED: "Skipped",
};

export const ENTITY_STATUSES: readonly EntityStatus[] = ["ACTIVE", "WITHDRAWN"];

export const ENTITY_STATUS_LABELS: Record<EntityStatus, string> = {
  ACTIVE: "Active",
  WITHDRAWN: "Withdrawn",
};

/** A run the worker has not finished yet ("Sync now" is disabled and the page polls while one exists). */
export function isActiveRun(run: Pick<SyncRunOut, "status"> | null | undefined): boolean {
  return run?.status === "QUEUED" || run?.status === "RUNNING";
}

/** The listing stopped early, so the run did not mark unseen files as deleted. */
export function listingIncomplete(run: Pick<SyncRunOut, "details">): { reason: string | null } | null {
  if (run.details?.listing_complete !== false) return null;
  const reason = run.details.truncated_reason;
  return { reason: typeof reason === "string" && reason.trim() ? reason.trim() : null };
}

export type SourceCountKey = "files_active" | "files_failed" | "files_deleted" | "entities_active";

export function sourceCount(source: Pick<SourceOut, "counts">, key: SourceCountKey): number | null {
  const value = source.counts?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

// ---- CRM entities ----------------------------------------------------------------------------

/** The generic starter schemas; client schemas can add more types (shown humanized). */
export const KNOWN_ENTITY_TYPES: readonly string[] = ["organization", "contact", "document_reference"];

const ENTITY_TYPE_LABELS: Record<string, string> = {
  organization: "Organization",
  contact: "Contact",
  document_reference: "Document reference",
};

export function entityTypeLabel(type: string | null | undefined): string {
  if (!type) return "—";
  return ENTITY_TYPE_LABELS[type] ?? humanize(type);
}

/** 0..1 → "87%" (a value above 1 is taken as a percentage already). */
export function formatConfidence(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value <= 1 ? value * 100 : value)}%`;
}

/** Only https links from the API are rendered as links (web_url comes from Microsoft Graph). */
export function safeExternalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

// ---- Source configuration --------------------------------------------------------------------

/** The file types a source can sync (the backend's ALLOWED_EXTENSIONS). */
export const SYNC_FILE_TYPES: readonly { ext: string; label: string }[] = [
  { ext: ".pdf", label: "PDF" },
  { ext: ".docx", label: "Word (.docx)" },
];

export const DEFAULT_FILE_EXTENSIONS: readonly string[] = [".pdf", ".docx"];

export function fileTypesLabel(extensions: string[] | null | undefined): string {
  const list = extensions ?? [];
  return list.length ? list.map((e) => e.replace(/^\./, "").toUpperCase()).join(", ") : "—";
}

export function libraryLabel(driveName: string | null | undefined): string {
  return driveName?.trim() || "Documents (default library)";
}

export function folderLabel(folderPath: string | null | undefined): string {
  const path = folderPath?.trim();
  return !path || path === "/" ? "/ (library root)" : path;
}

export type SiteUrlCheck = { error: string | null; warning: string | null };

/** https is required; a host outside *.sharepoint.com is only a warning (the server's allow-list decides). */
export function checkSiteUrl(value: string): SiteUrlCheck {
  const text = value.trim();
  if (!text) return { error: "Enter the SharePoint site URL.", warning: null };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { error: "Enter the full site URL, e.g. https://contoso.sharepoint.com/sites/Sales.", warning: null };
  }
  if (url.protocol !== "https:") return { error: "The site URL must start with https://.", warning: null };
  if (!url.hostname.toLowerCase().endsWith(".sharepoint.com")) {
    return {
      error: null,
      warning:
        "SharePoint sites are normally at https://<tenant>.sharepoint.com/… — the server rejects hosts it does not allow.",
    };
  }
  return { error: null, warning: null };
}

// ---- Schedule --------------------------------------------------------------------------------

/** SYNC_INTERVAL_PRESETS in backend/doc_intel/constants.py (days); any 1–365 is accepted as custom. */
export const SYNC_INTERVAL_PRESETS: readonly number[] = [7, 14, 21, 28];
export const MIN_SYNC_INTERVAL_DAYS = 1;
export const MAX_SYNC_INTERVAL_DAYS = 365;
export const DEFAULT_SYNC_INTERVAL_DAYS = 14;
export const DEFAULT_SYNC_HOUR = 2;

/** The schedule hour is local to the server's DOC_INTEL_TIMEZONE (default Africa/Cairo). */
export const SCHEDULE_TIME_ZONE = "Africa/Cairo";
export const SCHEDULE_TIME_ZONE_LABEL = "Africa/Cairo time";

export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

/** The preset buttons: "Every 1 week", "Every 2 weeks", … */
export function presetLabel(days: number): string {
  const weeks = days / 7;
  return `Every ${weeks} ${weeks === 1 ? "week" : "weeks"}`;
}

/** Summaries: "Every week", "Every 2 weeks", "Every 10 days", "Every day". */
export function intervalLabel(days: number): string {
  if (days === 1) return "Every day";
  if (days % 7 === 0) return days === 7 ? "Every week" : `Every ${days / 7} weeks`;
  return `Every ${days} days`;
}

/** A schedule timestamp in the schedule's own time zone, 24-hour clock, e.g. "Sun, 27 Sept 2026, 02:00". */
export function formatScheduleTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return date.toLocaleString(undefined, {
      timeZone: SCHEDULE_TIME_ZONE,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    return date.toLocaleString();
  }
}

/** "Every 2 weeks at 02:00 · next Sun, 27 Sept 2026, 02:00", or "Automatic sync off". */
export function scheduleSummary(
  source: Pick<SourceOut, "sync_enabled" | "sync_interval_days" | "sync_hour" | "next_sync_at">,
): string {
  if (!source.sync_enabled) return "Automatic sync off";
  const base = `${intervalLabel(source.sync_interval_days)} at ${hourLabel(source.sync_hour)}`;
  return source.next_sync_at ? `${base} · next ${formatScheduleTime(source.next_sync_at)}` : base;
}

/** The schedule as edited: a preset (days) or "custom" with the typed number of days. */
export type ScheduleDraft = {
  enabled: boolean;
  interval: number | "custom";
  customDays: string;
  hour: number;
};

export function scheduleDraftFrom(
  source?: Pick<SourceOut, "sync_enabled" | "sync_interval_days" | "sync_hour"> | null,
): ScheduleDraft {
  const days = source?.sync_interval_days ?? DEFAULT_SYNC_INTERVAL_DAYS;
  return {
    enabled: source?.sync_enabled ?? false,
    interval: SYNC_INTERVAL_PRESETS.includes(days) ? days : "custom",
    customDays: String(days),
    hour: source?.sync_hour ?? DEFAULT_SYNC_HOUR,
  };
}

/** The interval in days, or null while the custom value is not a whole number from 1 to 365. */
export function scheduleDraftDays(draft: ScheduleDraft): number | null {
  if (draft.interval !== "custom") return draft.interval;
  const text = draft.customDays.trim();
  if (!/^\d{1,3}$/.test(text)) return null;
  const days = Number(text);
  return days >= MIN_SYNC_INTERVAL_DAYS && days <= MAX_SYNC_INTERVAL_DAYS ? days : null;
}

// ---- Errors ----------------------------------------------------------------------------------

const NOT_INSTALLED = /not installed/i;
const V002_NOT_INSTALLED = /V002|sharepoint sync is not installed/i;
// backend/doc_intel/crypto.py reasons: key missing / key invalid, and a stored credential that can't be decrypted.
const CREDENTIAL_UNREADABLE = /could not be decrypted|expected encrypted format/i;
const KEY_PROBLEM = /DOC_INTEL_SECRETS_KEY|encryption is not configured|encryption key/i;

const V002_HINT =
  "Its database tables are missing: migration V002 has not been applied. Apply the reviewed V002 migration on the backend, then reload this page.";

/** The not-installed banner for Flow 2; a detail that only repeats "not installed" is replaced by the hint. */
export function sharePointNotInstalled(detail?: string | null): DocIntelUnavailable {
  const extra = detail?.trim();
  return {
    title: "SharePoint sync is not installed",
    message: extra && !NOT_INSTALLED.test(extra) ? `${extra} ${V002_HINT}` : V002_HINT,
  };
}

/**
 * "The feature isn't there" errors on the sources list: a 503 for a missing migration (V002, or
 * V001 for the whole module) or a sync service that did not start, or a 404 because the routes
 * are not mounted. Don't use it for /sources/{id}: a 404 there only means that one source is gone.
 */
export function sharePointUnavailable(error: unknown): DocIntelUnavailable | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 503 && V002_NOT_INSTALLED.test(error.message)) return sharePointNotInstalled(error.message);
  if (error.status === 503 && NOT_INSTALLED.test(error.message)) return notInstalled(error.message);
  if (error.status === 503) {
    const detail = error.message.trim();
    return {
      title: "SharePoint sync is unavailable",
      message: detail && !/^Request failed/.test(detail) ? detail : "The server answered 503. Check the backend log for doc_intel.",
    };
  }
  if (error.status === 404) {
    return {
      title: "SharePoint sync is not available",
      message:
        "This server does not expose the SharePoint sync endpoints (/api/doc-intel/sources). The backend may not include them yet, or document intelligence is turned off (DOC_INTEL_ENABLED=false).",
    };
  }
  return null;
}

export type ActionProblem = { tone: "danger" | "info"; title: string; message: string | null };

export const SYNC_ALREADY_ACTIVE = "A sync is already queued or running for this source";

/**
 * A failed source action (save, test, sync, delete, retry) as a banner. A 503 is shown with the
 * server's own explanation (migration missing, encryption key not configured); a 409 on Sync now
 * is informational.
 */
export function describeActionError(error: unknown, action: string, opts: { syncConflict?: boolean } = {}): ActionProblem {
  if (error instanceof ApiError && error.status === 409 && opts.syncConflict) {
    const detail = error.message.trim();
    // The server says the same thing ("…for source 12"); only a different reason is worth repeating.
    const repeat = !detail || /already queued or running/i.test(detail) || /^Request failed/.test(detail);
    return {
      tone: "info",
      title: SYNC_ALREADY_ACTIVE,
      message: repeat ? "Its progress shows on this card; the page refreshes every 3 seconds while it runs." : detail,
    };
  }
  // The server's detail explains credential problems (what to set, what to re-enter); show it as-is.
  if (error instanceof ApiError && CREDENTIAL_UNREADABLE.test(error.message)) {
    return { tone: "danger", title: "Stored credentials can't be decrypted", message: error.message.trim() };
  }
  if (error instanceof ApiError && error.status === 503 && KEY_PROBLEM.test(error.message)) {
    return { tone: "danger", title: "Credential encryption is not configured", message: error.message.trim() };
  }
  if (error instanceof ApiError && error.status === 503) {
    const missing = sharePointUnavailable(error);
    if (missing) return { tone: "danger", title: missing.title, message: missing.message };
  }
  return { tone: "danger", title: `${action} failed`, message: formatUserError(error) };
}
