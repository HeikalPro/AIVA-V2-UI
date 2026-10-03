/** Shared helpers for the document intelligence pages (Document Import, Monitoring). */
import { ApiError, formatUserError } from "@/lib/errors";
import type {
  DocIntelStatusOut,
  DocStatus,
  KbDocumentOut,
  KbStageName,
  StageOut,
  StageStatus,
} from "@/types/api";

/** One pipeline stage as the stage pills show it: full label (tooltips, reasons) and short pill text. */
export type StageDef<N extends string = string> = { name: N; label: string; short: string };

/** The five import stages in pipeline order (KB_STAGES in backend/doc_intel/constants.py). */
export const KB_STAGES: readonly StageDef<KbStageName>[] = [
  { name: "upload", label: "Upload", short: "Upload" },
  { name: "extraction", label: "Extraction", short: "Extract" },
  { name: "chunking", label: "Chunking", short: "Chunk" },
  { name: "embedding", label: "Embedding", short: "Embed" },
  { name: "publishing", label: "Publishing", short: "Publish" },
];

export const DOC_STATUSES: readonly DocStatus[] = ["QUEUED", "PROCESSING", "PUBLISHED", "FAILED", "UNPUBLISHED"];

export const DOC_STATUS_LABELS: Record<DocStatus, string> = {
  QUEUED: "Queued",
  PROCESSING: "Processing",
  PUBLISHED: "Published",
  FAILED: "Failed",
  UNPUBLISHED: "Unpublished",
};

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  PENDING: "Waiting",
  RUNNING: "Running",
  COMPLETED: "Completed",
  FAILED: "Failed",
  SKIPPED: "Skipped",
};

/** Documents still moving through the pipeline (the list polls while any are shown). */
export function isActiveDocStatus(status: DocStatus): boolean {
  return status === "QUEUED" || status === "PROCESSING";
}

export function stageLabel(name: string | null | undefined): string {
  if (!name) return "—";
  const known = KB_STAGES.find((s) => s.name === name);
  return known ? known.label : name.charAt(0).toUpperCase() + name.slice(1);
}

/** Stages in pipeline order; a stage missing from the payload is shown as waiting. */
export function orderedStages(stages: StageOut[] | null | undefined): StageOut[] {
  const list = stages ?? [];
  return KB_STAGES.map(({ name }) => list.find((s) => s.name === name) ?? { name, status: "PENDING" });
}

export function stageStatusOf(doc: Pick<KbDocumentOut, "stages">, name: KbStageName): StageStatus | undefined {
  return doc.stages.find((s) => s.name === name)?.status;
}

/** The rejected-at-upload case: nothing was stored, so there is nothing to retry or unpublish. */
export function isUploadRejected(doc: Pick<KbDocumentOut, "stages" | "failed_stage">): boolean {
  return stageStatusOf(doc, "upload") === "FAILED" || doc.failed_stage === "upload";
}

/** Failure reason: the failed stage's own error, else the document-level error. */
export function failureReason(doc: Pick<KbDocumentOut, "stages" | "error_message">): string | null {
  const failed = doc.stages.find((s) => s.status === "FAILED");
  return failed?.error?.trim() || doc.error_message?.trim() || null;
}

/** Why the server rejected an uploaded file: the upload stage's error, else the document error. */
export function uploadRejectionReason(doc: Pick<KbDocumentOut, "stages" | "error_message">): string | null {
  const upload = doc.stages.find((s) => s.name === "upload");
  return upload?.error?.trim() || doc.error_message?.trim() || null;
}

// ---- Sequential upload -----------------------------------------------------------------------

/**
 * What happened to one file of a batch. Files are uploaded one request each: "rejected" means the
 * server stored it as a failed row (reason from its upload stage); "failed" means the request
 * itself failed (proxy 413, network, 5xx, …) and nothing was stored.
 */
export type FileUploadState =
  | { status: "waiting" }
  | { status: "uploading" }
  | { status: "accepted" }
  | { status: "rejected"; reason: string }
  | { status: "failed"; reason: string };

export type UploadCounts = { accepted: number; rejected: number; failed: number };

/** "3 accepted, 1 rejected" (plus ", 2 failed" when requests failed). */
export function uploadSummaryTitle({ accepted, rejected, failed }: UploadCounts): string {
  return [`${accepted} accepted`, `${rejected} rejected`, ...(failed > 0 ? [`${failed} failed`] : [])].join(", ");
}

// ---- Upload limits ---------------------------------------------------------------------------

/** MIME types for the extensions the backend accepts (ALLOWED_EXTENSIONS in constants.py). */
export const DOC_MIME_TYPES: Readonly<Record<string, string>> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export type UploadLimits = {
  maxUploadMb: number;
  maxFiles: number;
  allowedExtensions: string[];
};

/** DocIntelStatusOut defaults, used until /status has loaded. */
export const DEFAULT_UPLOAD_LIMITS: UploadLimits = {
  maxUploadMb: 50,
  maxFiles: 20,
  allowedExtensions: [".pdf", ".docx"],
};

export function uploadLimitsFrom(status: DocIntelStatusOut | undefined): UploadLimits {
  if (!status) return DEFAULT_UPLOAD_LIMITS;
  const extensions = status.allowed_extensions?.length
    ? status.allowed_extensions
    : DEFAULT_UPLOAD_LIMITS.allowedExtensions;
  return {
    maxUploadMb: status.max_upload_mb || DEFAULT_UPLOAD_LIMITS.maxUploadMb,
    maxFiles: status.max_files_per_upload || DEFAULT_UPLOAD_LIMITS.maxFiles,
    allowedExtensions: extensions.map((e) => e.toLowerCase()),
  };
}

// ---- Formatting ------------------------------------------------------------------------------

/** UTC ISO timestamp → local date/time (same convention as the Logs pages). */
export function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(kb < 100 ? 1 : 0)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(mb < 100 ? 1 : 0)} MB`;
  return `${(mb / 1024).toFixed(1)} GB`;
}

export function formatDuration(start: string | null | undefined, end: string | null | undefined): string | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${ms} ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs ? `${m} min ${rs} s` : `${m} min`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h} h ${rm} min` : `${h} h`;
}

export function formatCount(value: number | null | undefined): string {
  return value == null ? "—" : value.toLocaleString();
}

export function formatCostUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  })}`;
}

// ---- Module availability ---------------------------------------------------------------------

export type DocIntelUnavailable = { title: string; message: string };

const NOT_INSTALLED = /not installed/i;

const NOT_INSTALLED_HINT =
  "Its database tables are missing: migration V001 has not been applied. Apply the reviewed V001 migration on the backend, then reload this page.";

/** The not-installed banner; a server detail that only repeats "not installed" is replaced by the hint. */
export function notInstalled(detail?: string | null): DocIntelUnavailable {
  const extra = detail?.trim();
  return {
    title: "Document intelligence is not installed",
    message: extra && !NOT_INSTALLED.test(extra) ? `${extra} ${NOT_INSTALLED_HINT}` : NOT_INSTALLED_HINT,
  };
}

/**
 * Recognise "the module isn't there" errors on collection endpoints (status, list, health):
 * a 503 "Document intelligence is not installed — run migration V001", or a 404 because the
 * /api/doc-intel routes are not mounted. Don't use it for /kb-documents/{id}: a 404 there only
 * means that one document is gone.
 */
export function docIntelUnavailable(error: unknown): DocIntelUnavailable | null {
  if (!(error instanceof ApiError)) return null;
  if (error.status === 503 && NOT_INSTALLED.test(error.message)) return notInstalled(error.message);
  if (error.status === 404) {
    return {
      title: "Document intelligence is not available",
      message:
        "This server does not expose the /api/doc-intel endpoints. The backend may not include the module yet, or it is turned off (DOC_INTEL_ENABLED=false).",
    };
  }
  return null;
}

/**
 * Upload errors can come from a proxy rather than the API: nginx answers an oversized body with an
 * HTML 413 page, which apiUpload would otherwise show verbatim. API errors (e.g. a 403 "Requires
 * one of roles: SUPER_ADMIN") keep their own message.
 */
export function formatUploadError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 413) return "The file is larger than the server accepts (HTTP 413).";
    if (error.message.trimStart().startsWith("<")) {
      // A bare HTML 403 is a proxy refusal, not an expired session.
      if (error.status === 403) return "The server refused the upload (HTTP 403).";
      return formatUserError(new ApiError(`Request failed (${error.status})`, error.status));
    }
  }
  return formatUserError(error);
}

/** Query retry policy: the app default (one retry), but never for a missing module. */
export function retryUnlessUnavailable(failureCount: number, error: unknown): boolean {
  return docIntelUnavailable(error) == null && failureCount < 1;
}
