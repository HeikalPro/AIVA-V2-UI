import { DOC_STATUS_LABELS } from "@/lib/doc-intel";
import { Status, type StatusTone } from "@/components/data/status";
import type { DocStatus } from "@/types/api";

/** Published = green, failed = red, queued / processing = amber (processing pulses), unpublished = grey. */
const TONE: Record<DocStatus, StatusTone> = {
  QUEUED: "warning",
  PROCESSING: "warning",
  PUBLISHED: "success",
  FAILED: "danger",
  UNPUBLISHED: "neutral",
};

export function DocStatusBadge({ status, className }: { status: DocStatus; className?: string }) {
  return (
    <Status
      tone={TONE[status] ?? "neutral"}
      label={DOC_STATUS_LABELS[status] ?? status}
      pulse={status === "PROCESSING"}
      className={className}
    />
  );
}
