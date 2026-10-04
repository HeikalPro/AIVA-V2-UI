import { CheckCircle2, Circle, Lightbulb, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDurationMs } from "@/lib/format";
import { IconButton } from "@/components/ui/icon-button";
import { RelativeTime } from "./RelativeTime";
import type { ConnectionStepOut, ConnectionTestOut } from "@/types/api";

/**
 * The diagnostic chain in order: key → token → site → library → folder → listing (labels as in
 * backend/doc_intel/graph_source.py, used for the steps that did not run).
 */
const STEP_ORDER: readonly { key: string; label: string }[] = [
  { key: "credentials", label: "Credentials" },
  { key: "token", label: "Microsoft sign-in" },
  { key: "site", label: "SharePoint site" },
  { key: "drive", label: "Document library" },
  { key: "folder", label: "Folder" },
  { key: "listing", label: "File listing" },
];

type Row = { step: ConnectionStepOut; ran: boolean };

/** The steps as returned (the list ends at the first failure), then the known steps that never ran. */
function rowsOf(result: ConnectionTestOut): Row[] {
  const steps = result.steps ?? [];
  const rows: Row[] = steps.map((step) => ({ step, ran: true }));
  if (!result.ok) {
    const lastKnown = Math.max(-1, ...steps.map((s) => STEP_ORDER.findIndex((o) => o.key === s.key)));
    for (const known of STEP_ORDER.slice(lastKnown + 1)) {
      if (!steps.some((s) => s.key === known.key)) rows.push({ step: { key: known.key, label: known.label, ok: false }, ran: false });
    }
  }
  return rows;
}

function stepLabel(step: ConnectionStepOut): string {
  return step.label?.trim() || STEP_ORDER.find((o) => o.key === step.key)?.label || step.key;
}

/** "Found N files: a.pdf, b.docx…"; each name is bidi-isolated so an Arabic name can't reorder its neighbours. */
function FoundFiles({ result }: { result: ConnectionTestOut }) {
  if (result.files_found == null) return null;
  const n = result.files_found;
  const sample = (result.sample_files ?? []).filter(Boolean);
  return (
    <p className="mt-3 text-ui text-foreground [overflow-wrap:anywhere]">
      {n === 0
        ? "Found no matching files in the folder."
        : `Found ${n.toLocaleString()} ${n === 1 ? "file" : "files"}${sample.length ? ": " : "."}`}
      {n > 0 &&
        sample.map((name, i) => (
          <span key={`${name}-${i}`}>
            {i > 0 && ", "}
            <bdi>{name}</bdi>
          </span>
        ))}
      {n > 0 && sample.length > 0 && n > sample.length ? "…" : ""}
    </p>
  );
}

type Props = {
  result: ConnectionTestOut;
  onDismiss?: () => void;
  className?: string;
};

/** Step-by-step result of POST /sources/{id}/test: passed / failed / not checked per step, detail, suggested action, latency. */
export function ConnectionTestResult({ result, onDismiss, className }: Props) {
  const rows = rowsOf(result);
  const firstFailure = rows.find((r) => r.ran && !r.step.ok);

  return (
    <section
      aria-label="Connection test result"
      className={cn(
        "rounded-lg border px-3 py-3 text-sm",
        result.ok ? "border-success/25 bg-success-muted" : "border-danger/25 bg-danger-muted",
        className,
      )}
    >
      <div className="flex items-start gap-2.5">
        {result.ok ? (
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-success" />
        ) : (
          <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        )}
        <div className="min-w-0 flex-1">
          <p role="status" className="font-medium text-foreground">
            {result.ok
              ? "Connection works"
              : firstFailure
                ? `Connection failed at “${stepLabel(firstFailure.step)}”`
                : "Connection failed"}
          </p>
          {result.checked_at && (
            <p className="text-xs text-muted-foreground">
              Checked <RelativeTime value={result.checked_at} />
            </p>
          )}
        </div>
        {onDismiss && (
          <IconButton label="Dismiss the connection test result" icon={X} size="sm" className="-my-1 -mr-1 h-7 w-7" onClick={onDismiss} />
        )}
      </div>

      <ol className="mt-3 divide-y divide-border overflow-hidden rounded-md border border-border bg-card">
        {rows.map(({ step, ran }, i) => {
          const failed = ran && !step.ok;
          return (
            <li key={`${step.key}-${i}`} className="px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="inline-flex min-w-0 items-center gap-2 text-ui font-medium text-foreground">
                  {!ran ? (
                    <Circle aria-hidden="true" className="h-4 w-4 shrink-0 text-subtle-foreground" />
                  ) : step.ok ? (
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <XCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-danger" />
                  )}
                  <span className={cn("min-w-0 break-words", !ran && "text-muted-foreground")}>{stepLabel(step)}</span>
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {!ran ? "Not checked" : step.ok ? (step.latency_ms != null ? `Passed · ${formatDurationMs(step.latency_ms)}` : "Passed") : "Failed"}
                </span>
              </div>
              {ran && step.detail && (
                <p className={cn("mt-1 break-words pl-6 text-xs", failed ? "text-danger" : "text-muted-foreground")}>{step.detail}</p>
              )}
              {failed && step.suggested_action && (
                <p className="mt-1.5 flex items-start gap-1.5 pl-6 text-xs text-foreground">
                  <Lightbulb aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0 text-warning" />
                  <span className="min-w-0 break-words">
                    <span className="font-medium">Suggested action: </span>
                    {step.suggested_action}
                  </span>
                </p>
              )}
            </li>
          );
        })}
      </ol>

      <FoundFiles result={result} />
    </section>
  );
}
