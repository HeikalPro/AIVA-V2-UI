import { CheckCircle2, Circle, Lightbulb, X, XCircle } from "lucide-react";
import { formatWhen } from "@/lib/doc-intel";
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
    <p className="mt-3 break-words text-sm text-foreground [overflow-wrap:anywhere]">
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

/** Step-by-step result of POST /sources/{id}/test: green check or red cross, detail, suggested action, latency. */
export function ConnectionTestResult({ result, onDismiss, className = "" }: Props) {
  const rows = rowsOf(result);
  const firstFailure = rows.find((r) => r.ran && !r.step.ok);

  return (
    <section
      aria-label="Connection test result"
      className={`rounded-xl border px-4 py-3 text-sm ${result.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"} ${className}`.trim()}
    >
      <div className="flex items-start gap-3">
        {result.ok ? (
          <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
        ) : (
          <XCircle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-red-700" />
        )}
        <div className="min-w-0 flex-1">
          <p role="status" className={`font-semibold ${result.ok ? "text-emerald-800" : "text-red-800"}`}>
            {result.ok
              ? "Connection works"
              : firstFailure
                ? `Connection failed at “${stepLabel(firstFailure.step)}”`
                : "Connection failed"}
          </p>
          {result.checked_at && <p className="text-xs text-muted-foreground">Checked {formatWhen(result.checked_at)}</p>}
        </div>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss the connection test result"
            className="-m-1 shrink-0 rounded-md p-1 text-muted-foreground opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        )}
      </div>

      <ol className="mt-3 space-y-1.5">
        {rows.map(({ step, ran }, i) => {
          const failed = ran && !step.ok;
          return (
            <li key={`${step.key}-${i}`} className="rounded-lg border border-border bg-card px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="inline-flex min-w-0 items-center gap-2 font-medium text-foreground">
                  {!ran ? (
                    <Circle aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : step.ok ? (
                    <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-700" />
                  ) : (
                    <XCircle aria-hidden="true" className="h-4 w-4 shrink-0 text-red-700" />
                  )}
                  <span className="min-w-0 break-words">{stepLabel(step)}</span>
                  <span className="sr-only">{!ran ? ": not checked" : step.ok ? ": passed" : ": failed"}</span>
                </span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {!ran ? "Not checked" : step.latency_ms != null ? `${step.latency_ms.toLocaleString()} ms` : ""}
                </span>
              </div>
              {ran && step.detail && (
                <p className={`mt-1 break-words text-xs ${failed ? "text-red-700" : "text-muted-foreground"}`}>{step.detail}</p>
              )}
              {failed && step.suggested_action && (
                <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <Lightbulb aria-hidden="true" className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <p className="min-w-0 break-words">
                    <span className="font-semibold">Suggested action: </span>
                    {step.suggested_action}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      <FoundFiles result={result} />
    </section>
  );
}
