import { useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { PREVIEW_MAX_CHARS, useKbDocument, useKbDocumentPreview } from "@/hooks/useDocumentImport";
import {
  STAGE_STATUS_LABELS,
  failureReason,
  formatBytes,
  formatCostUsd,
  formatCount,
  formatDuration,
  formatWhen,
  orderedStages,
  stageLabel,
  stageStatusOf,
} from "@/lib/doc-intel";
import { ApiError, formatUserError } from "@/lib/errors";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { KPIStatCard } from "@/components/shared/KPIStatCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DocStatusBadge } from "@/components/doc-intel/DocStatusBadge";
import { KeyValueTable } from "@/components/doc-intel/KeyValueTable";
import { Notice } from "@/components/doc-intel/Notice";
import { STAGE_STATUS_STYLE, StageStatusIcon } from "@/components/doc-intel/StagePipeline";
import type { KbDocumentOut } from "@/types/api";

type TabId = "overview" | "text";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "text", label: "Extracted text" },
];

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{children}</h3>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

function StageTimeline({ doc }: { doc: KbDocumentOut }) {
  return (
    <ol className="space-y-2">
      {orderedStages(doc.stages).map((stage) => {
        const style = STAGE_STATUS_STYLE[stage.status] ?? STAGE_STATUS_STYLE.PENDING;
        const took = formatDuration(stage.started_at, stage.finished_at);
        const times = [
          stage.started_at ? `Started ${formatWhen(stage.started_at)}` : null,
          stage.finished_at ? `Finished ${formatWhen(stage.finished_at)}` : null,
          took ? `took ${took}` : null,
        ].filter(Boolean);
        return (
          <li key={stage.name} className="rounded-lg border border-border px-3 py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                <StageStatusIcon status={stage.status} className={`h-4 w-4 ${style.text}`} />
                {stageLabel(stage.name)}
              </span>
              <span className={`text-xs font-semibold ${style.text}`}>
                {STAGE_STATUS_LABELS[stage.status] ?? stage.status}
              </span>
            </div>
            {times.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{times.join(" · ")}</p>}
            {stage.status === "FAILED" && (
              <p className="mt-1 break-words text-sm text-red-700">
                {stage.error?.trim() || doc.error_message?.trim() || "No reason was recorded."}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function Overview({ doc }: { doc: KbDocumentOut }) {
  const reason = doc.status === "FAILED" ? failureReason(doc) : null;
  const queues = doc.queue_keys.map((key, i) => doc.queue_labels[i] || key);

  return (
    <div className="space-y-6">
      {doc.status === "FAILED" && (
        <Notice tone="danger" title={`Failed at ${stageLabel(doc.failed_stage ?? doc.stages.find((s) => s.status === "FAILED")?.name)}`}>
          {reason ?? "No reason was recorded."}
        </Notice>
      )}

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        <Field label="Account">
          {doc.organization_name ? `${doc.organization_name} · ` : ""}
          {doc.account_name ?? `Account #${doc.account_id}`}
        </Field>
        <Field label="Queues">
          {queues.length ? (
            <span className="flex flex-wrap gap-1">
              {queues.map((label, i) => (
                <span
                  key={`${doc.queue_keys[i]}-${i}`}
                  className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-xs font-medium"
                >
                  {label}
                </span>
              ))}
            </span>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Uploaded by">{doc.uploaded_by_email ?? (doc.uploaded_by != null ? `User #${doc.uploaded_by}` : "—")}</Field>
        <Field label="Uploaded">{formatWhen(doc.created_at)}</Field>
        <Field label="Last updated">{formatWhen(doc.updated_at)}</Field>
        <Field label="Published">{formatWhen(doc.published_at)}</Field>
        <Field label="File">
          {formatBytes(doc.size_bytes)}
          {doc.content_type ? <span className="text-muted-foreground"> · {doc.content_type}</span> : null}
        </Field>
        <Field label="Attempts">{formatCount(doc.attempts)}</Field>
        {doc.status === "QUEUED" && doc.queue_position != null && (
          <Field label="Queue position">#{doc.queue_position}</Field>
        )}
        {doc.batch_id && (
          <Field label="Upload batch">
            <span className="font-mono text-xs">{doc.batch_id}</span>
          </Field>
        )}
        {doc.sha256 && (
          <Field label="SHA-256">
            <span className="font-mono text-xs" title={doc.sha256}>
              {doc.sha256.slice(0, 16)}…
            </span>
          </Field>
        )}
      </dl>

      <section className="space-y-2">
        <SectionTitle>Metrics</SectionTitle>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <KPIStatCard label="Pages" value={formatCount(doc.page_count)} />
          <KPIStatCard label="Chunks" value={formatCount(doc.chunk_count)} />
          <KPIStatCard label="Embedding tokens" value={formatCount(doc.tokens_used)} />
          <KPIStatCard label="Cost" value={formatCostUsd(doc.cost_usd)} />
        </div>
      </section>

      <section className="space-y-2">
        <SectionTitle>Stages</SectionTitle>
        <StageTimeline doc={doc} />
      </section>

      <section className="space-y-2">
        <SectionTitle>Warnings{doc.warnings.length ? ` (${doc.warnings.length})` : ""}</SectionTitle>
        {doc.warnings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No warnings.</p>
        ) : (
          <ul className="space-y-2">
            {doc.warnings.map((w, i) => (
              <li
                key={`${w.code}-${i}`}
                className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800"
              >
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="break-words">{w.message}</p>
                  <p className="mt-0.5 font-mono text-xs opacity-80">
                    {w.code}
                    {w.page != null ? ` · page ${w.page}` : ""}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Mounted only while its tab is open, so the preview is fetched lazily. */
function ExtractedText({ doc }: { doc: KbDocumentOut }) {
  const extracted = stageStatusOf(doc, "extraction") === "COMPLETED";
  const preview = useKbDocumentPreview(doc.id, extracted);

  if (!extracted) {
    return (
      <p className="text-sm text-muted-foreground">The extracted text is available once the extraction stage has completed.</p>
    );
  }
  if (preview.isLoading) return <p className="text-sm text-muted-foreground">Loading extracted text…</p>;
  if (preview.isError) {
    // 409 = no readable extracted text (yet); the server says why.
    if (preview.error instanceof ApiError && preview.error.status === 409) {
      return <p className="text-sm text-muted-foreground">{formatUserError(preview.error)}</p>;
    }
    return <ErrorAlert message={formatUserError(preview.error)} />;
  }

  const data = preview.data;
  if (!data || data.pages.length === 0) return <p className="text-sm text-muted-foreground">No text was extracted.</p>;

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        {data.page_count != null ? `${data.page_count.toLocaleString()} pages` : `${data.pages.length} pages shown`}
        {data.truncated
          ? ` · showing the first ${PREVIEW_MAX_CHARS.toLocaleString()} characters of the document (all pages combined)`
          : ""}
      </p>
      {data.pages.map((page) => (
        <section key={page.number} className="overflow-hidden rounded-lg border border-border">
          <h4 className="border-b border-border bg-muted px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Page {page.number}
          </h4>
          {/* dir="auto" + plaintext bidi: each paragraph of Arabic or English text gets its own direction. */}
          <pre
            dir="auto"
            className="max-h-96 overflow-auto whitespace-pre-wrap break-words px-3 py-2 font-sans text-sm leading-relaxed text-foreground [unicode-bidi:plaintext]"
          >
            {page.text.trim() ? page.text : "(no text on this page)"}
          </pre>
        </section>
      ))}
      {Object.keys(data.extractor ?? {}).length > 0 && (
        <section className="space-y-2">
          <SectionTitle>Extractor</SectionTitle>
          <KeyValueTable data={data.extractor} />
        </section>
      )}
    </div>
  );
}

type Props = {
  /** Row snapshot shown immediately; the dialog then keeps it fresh from the detail endpoint. */
  document: KbDocumentOut;
  onClose: () => void;
};

export function DocumentDetailsDialog({ document: snapshot, onClose }: Props) {
  const [tab, setTab] = useState<TabId>("overview");
  const detail = useKbDocument(snapshot.id);
  const doc = detail.data ?? snapshot;

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} size="max-w-3xl">
      {/* Keeps DialogContent's own p-6 (a p-0 override loses to it in the generated CSS). */}
      <DialogContent className="flex max-h-[min(90vh,calc(100dvh-2rem))] flex-col overflow-hidden">
        <DialogHeader className="space-y-3 border-b border-slate-100 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="break-words">{doc.filename}</DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">Document #{doc.id}</p>
            </div>
            <DocStatusBadge status={doc.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            {TABS.map((t) => (
              <Button
                key={t.id}
                size="sm"
                variant={tab === t.id ? "default" : "outline"}
                aria-pressed={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </DialogHeader>
        <DialogBody className="min-h-0 flex-1 pr-1">
          {detail.isError && (
            <ErrorAlert
              className="mb-4"
              message={`Couldn't refresh this document: ${formatUserError(detail.error)}`}
            />
          )}
          {tab === "overview" ? <Overview doc={doc} /> : <ExtractedText doc={doc} />}
        </DialogBody>
        <DialogFooter className="border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
