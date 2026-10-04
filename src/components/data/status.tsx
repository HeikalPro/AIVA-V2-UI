import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

/*
 * Tone mapping (spec §8): green = healthy/completed, amber = pending/degraded/processing,
 * red = failed/error, blue = informational/current, gray = inactive/disabled/unknown.
 * In-flight states (RUNNING, PROCESSING, SYNCING, IN_PROGRESS, RETRYING) are amber like the
 * spec's "processing" and pulse to show activity — see isLiveStatus().
 */
const TONE_BY_STATUS: Record<string, StatusTone> = {};
const assign = (tone: StatusTone, keys: string[]) => keys.forEach((k) => (TONE_BY_STATUS[k] = tone));
assign("success", [
  "ACTIVE", "HEALTHY", "COMPLETED", "COMPLETE", "SUCCESS", "SUCCEEDED", "SUCCESSFUL", "RESOLVED", "CLOSED",
  "PUBLISHED", "OK", "UP", "ENABLED", "DONE", "PASSED", "CONNECTED", "ONLINE", "APPROVED", "GOOD",
]);
assign("warning", [
  "PENDING", "QUEUED", "IN_PROGRESS", "PROCESSING", "RUNNING", "SYNCING", "DEGRADED", "WARNING", "WARN",
  "OPEN", "RETRYING", "PARTIAL", "STALE", "WAITING", "SCHEDULED", "STARTING",
]);
assign("danger", [
  "FAILED", "FAILURE", "FAIL", "ERROR", "DOWN", "UNHEALTHY", "REJECTED", "CRITICAL", "TIMEOUT", "TIMED_OUT",
  "OFFLINE", "DISCONNECTED", "EXPIRED",
]);
assign("info", ["INFO", "NEW"]);
assign("neutral", [
  "INACTIVE", "DISABLED", "CANCELLED", "CANCELED", "ARCHIVED", "UNKNOWN", "NOT_CONFIGURED", "SKIPPED",
  "UNPUBLISHED", "NONE", "PAUSED", "DELETED", "WITHDRAWN", "DRAFT", "N/A",
]);

const LIVE = new Set(["RUNNING", "PROCESSING", "SYNCING", "IN_PROGRESS", "RETRYING", "STARTING"]);

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

/** Maps a backend status string (any case, spaces/hyphens/underscores) to a tone. Unknown → neutral. */
export function statusTone(value: string | null | undefined): StatusTone {
  return TONE_BY_STATUS[normalize(value)] ?? "neutral";
}

/** True for in-flight states that should pulse (running, processing, syncing …). */
export function isLiveStatus(value: string | null | undefined): boolean {
  return LIVE.has(normalize(value));
}

/** "IN_PROGRESS" → "In progress", "not-configured" → "Not configured", null → "—". */
export function humanizeStatus(value: string | null | undefined): string {
  const words = (value ?? "").trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").toLowerCase();
  if (!words) return "—";
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const DOT: Record<StatusTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  neutral: "bg-neutral",
};

const BADGE: Record<StatusTone, string> = {
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  danger: "bg-danger-muted text-danger",
  info: "bg-info-muted text-info",
  neutral: "bg-neutral-muted text-neutral",
};

type StatusProps = {
  /** Tone; derived from `value` when omitted. */
  tone?: StatusTone;
  /** Visible text; defaults to humanizeStatus(value). Never color-only. */
  label?: ReactNode;
  /** Raw backend status (e.g. "IN_PROGRESS"): drives tone, label and pulse when those are omitted. */
  value?: string | null;
  /** dot (default) = dot + text; badge = restrained tinted pill. */
  variant?: "dot" | "badge";
  /** Animated ring on the dot for live/running states (disabled under prefers-reduced-motion). */
  pulse?: boolean;
  title?: string;
  className?: string;
};

/**
 * The one status indicator: `<Status tone="success" label="Active" />` or `<Status value={row.status} />`.
 */
export function Status({ tone, label, value, variant = "dot", pulse, title, className }: StatusProps) {
  const t = tone ?? statusTone(value);
  const text = label ?? humanizeStatus(value);
  const live = pulse ?? (value != null && isLiveStatus(value));

  const dot = (
    <span aria-hidden="true" className="relative inline-flex h-2 w-2 shrink-0">
      {live && <span className={cn("absolute inset-0 rounded-full opacity-60 motion-safe:animate-ping", DOT[t])} />}
      <span className={cn("relative inline-flex h-2 w-2 rounded-full", DOT[t])} />
    </span>
  );

  if (variant === "badge") {
    return (
      <span
        title={title}
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium leading-4",
          BADGE[t],
          className,
        )}
      >
        {dot}
        {text}
      </span>
    );
  }

  return (
    <span title={title} className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-ui text-foreground", className)}>
      {dot}
      {text}
    </span>
  );
}
