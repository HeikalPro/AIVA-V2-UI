import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Status, humanizeStatus, type StatusTone } from "@/components/data/status";
import { Badge, type BadgeVariant } from "@/components/ui/badge";

/*
 * Small cell renderers shared by the Logs & Health tables. All are thin wrappers over the shared
 * Badge / Status, so logs use the same badge and status system as the rest of the console.
 */

const LOG_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
};

/** Dense timestamp for log rows: "Oct 3, 09:28:14" (tabular), full date/time in the tooltip. */
export function LogTime({ value, className }: { value: string | null | undefined; className?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return (
    <time dateTime={value} title={formatDateTime(value, { dateStyle: "full", timeStyle: "medium" })} className={cn("whitespace-nowrap tabular-nums", className)}>
      {formatDateTime(value, LOG_TIME_FORMAT)}
    </time>
  );
}

/** Who triggered an AI request / retrieval: the desktop widget or the agent console. */
export function LogSourceBadge({ value }: { value: string | null | undefined }) {
  const isWidget = (value ?? "").toUpperCase() === "WIDGET";
  return <Badge variant={isWidget ? "info" : "neutral"}>{isWidget ? "Widget" : "Agent"}</Badge>;
}

const RESULT_TONE: Record<string, StatusTone> = {
  SUCCESS: "success",
  FAILED: "danger",
  EMPTY: "warning",
};

/** SUCCESS / FAILED / EMPTY result of an AI request or retrieval. */
export function LogResultStatus({ value }: { value: string | null | undefined }) {
  const v = (value ?? "").toUpperCase();
  if (!v) return <span className="text-muted-foreground">—</span>;
  return <Status tone={RESULT_TONE[v] ?? "neutral"} label={v === "EMPTY" ? "Empty" : humanizeStatus(v)} />;
}

const METHOD_VARIANT: Record<string, BadgeVariant> = {
  GET: "neutral",
  POST: "info",
  PUT: "warning",
  PATCH: "warning",
  DELETE: "danger",
};

export function HttpMethodBadge({ value }: { value: string | null | undefined }) {
  const v = (value ?? "?").toUpperCase();
  return (
    <Badge variant={METHOD_VARIANT[v] ?? "neutral"} className="font-mono">
      {v}
    </Badge>
  );
}

/** HTTP status: 2xx/3xx green, 4xx amber, 5xx red; the code is the label. */
export function HttpStatusCode({ value }: { value: number | null | undefined }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const tone: StatusTone = value >= 500 ? "danger" : value >= 400 ? "warning" : "success";
  return <Status tone={tone} label={<span className="font-mono tabular-nums">{value}</span>} />;
}

const SIGN_IN_EVENTS: Record<string, { label: string; tone: StatusTone }> = {
  login_success: { label: "Login success", tone: "success" },
  login_failed: { label: "Login failed", tone: "danger" },
  account_locked: { label: "Account locked", tone: "danger" },
  otp_verified: { label: "OTP verified", tone: "success" },
  password_reset_success: { label: "Password reset", tone: "info" },
};

export function SignInEventStatus({ value }: { value: string | null | undefined }) {
  const key = (value ?? "").toLowerCase();
  const meta = SIGN_IN_EVENTS[key];
  return <Status tone={meta?.tone ?? "neutral"} label={meta?.label ?? humanizeStatus(value)} />;
}
