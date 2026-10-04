import { useState, type ReactNode } from "react";
import { AlertCircle, FileText } from "lucide-react";
import { PREVIEW_MAX_CHARS, useKbDocument, useKbDocumentPreview } from "@/hooks/useDocumentImport";
import {
  STAGE_STATUS_LABELS,
  failureReason,
  formatBytes,
  formatCount,
  formatDuration,
  orderedStages,
  stageLabel,
  stageStatusOf,
} from "@/lib/doc-intel";
import { ApiError, formatUserError } from "@/lib/errors";
import { formatDateTime, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/data/empty-state";
import { Stat, StatGroup } from "@/components/data/stat";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SkeletonText } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DocStatusBadge } from "@/components/doc-intel/DocStatusBadge";
import { KeyValueTable } from "@/components/doc-intel/KeyValueTable";
import { RelativeTime } from "@/components/doc-intel/RelativeTime";
import { STAGE_TEXT_CLASS, StageMarker, StagePipeline } from "@/components/doc-intel/StagePipeline";
import type { KbDocumentOut } from "@/types/api";

type TabId = "overview" | "text";

function SectionTitle({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>;
}

function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-ui text-foreground">{children}</dd>
    </div>
  );
}

function StageTimeline({ doc }: { doc: KbDocumentOut }) {
  return (
    <ol className="divide-y divide-border overflow-hidden rounded-lg border border-border">
      {orderedStages(doc.stages).map((stage) => {
        const took = formatDuration(stage.started_at, stage.finished_at);
        const times = [
          stage.started_at ? `Started ${formatDateTime(stage.started_at)}` : null,
          stage.finished_at ? `finished ${formatDateTime(stage.finished_at)}` : null,
          took ? `took ${took}` : null,
        ].filter(Boolean);
        return (
          <li key={stage.name} className="flex items-start gap-3 px-3 py-2.5">
            <StageMarker status={stage.status} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                <span className="text-ui font-medium text-foreground">{stageLabel(stage.name)}</span>
                <span className={cn("text-xs font-medium", STAGE_TEXT_CLASS[stage.status])}>
                  {STAGE_STATUS_LABELS[stage.status] ?? stage.status}
                </span>
              </div>
              {times.length > 0 && <p className="mt-0.5 text-xs text-muted-foreground">{times.join(" · ")}</p>}
              {stage.status === "FAILED" && (
                <p className="mt-1 break-words text-xs text-danger">
                  {stage.error?.trim() || doc.error_message?.trim() || "No reason was recorded."}
                </p>
              )}
            </div>
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
        <Alert
          tone="danger"
          title={`Failed at ${stageLabel(doc.failed_stage ?? doc.stages.find((s) => s.status === "FAILED")?.name)}`}
          description={reason ?? "No reason was recorded."}
        />
      )}

      <section className="space-y-3">
        <SectionTitle>Pipeline</SectionTitle>
        <div className="rounded-lg border border-border px-3 py-3">
          <StagePipeline variant="labeled" stages={doc.stages} fallbackError={doc.error_message} showReason={false} />
        </div>
        {doc.status === "QUEUED" && doc.queue_position != null && (
          <p className="text-xs text-muted-foreground">Waiting in the import queue: position #{doc.queue_position}.</p>
        )}
      </section>

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        <Fact label="Account">
          <bdi>
            {doc.organization_name ? `${doc.organization_name} · ` : ""}
            {doc.account_name ?? `Account #${doc.account_id}`}
          </bdi>
        </Fact>
        <Fact label="Queues">
          {queues.length ? (
            <span className="flex flex-wrap gap-1">
              {queues.map((label, i) => (
                <Badge key={`${doc.queue_keys[i]}-${i}`} variant="neutral">
                  <bdi>{label}</bdi>
                </Badge>
              ))}
            </span>
          ) : (
            "—"
          )}
        </Fact>
        <Fact label="Uploaded by">{doc.uploaded_by_email ?? (doc.uploaded_by != null ? `User #${doc.uploaded_by}` : "—")}</Fact>
        <Fact label="Uploaded">{formatDateTime(doc.created_at)}</Fact>
        <Fact label="Last updated">
          {formatDateTime(doc.updated_at)}
          {doc.updated_at && (
            <span className="text-muted-foreground">
              {" "}
              (<RelativeTime value={doc.updated_at} />)
            </span>
          )}
        </Fact>
        <Fact label="Published">{formatDateTime(doc.published_at)}</Fact>
        <Fact label="File">
          {formatBytes(doc.size_bytes)}
          {doc.content_type ? <span className="text-muted-foreground"> · {doc.content_type}</span> : null}
        </Fact>
        <Fact label="Attempts">{formatCount(doc.attempts)}</Fact>
        {doc.status === "QUEUED" && doc.queue_position != null && <Fact label="Queue position">#{doc.queue_position}</Fact>}
        {doc.batch_id && (
          <Fact label="Upload batch">
            <span className="font-mono text-xs">{doc.batch_id}</span>
          </Fact>
        )}
        {doc.sha256 && (
          <Fact label="SHA-256">
            <span className="font-mono text-xs" title={doc.sha256}>
              {doc.sha256.slice(0, 16)}…
            </span>
          </Fact>
        )}
      </dl>

      <section className="space-y-2">
        <SectionTitle>Metrics</SectionTitle>
        <StatGroup columns={4} variant="strip" aria-label="Document metrics">
          <Stat emphasis="secondary" label="Pages" value={formatCount(doc.page_count)} />
          <Stat emphasis="secondary" label="Chunks" value={formatCount(doc.chunk_count)} />
          <Stat emphasis="secondary" label="Embedding tokens" value={formatCount(doc.tokens_used)} />
          <Stat
            emphasis="secondary"
            label="Cost"
            value={formatMoney(doc.cost_usd, "USD")}
            info="Embedding cost as reported by the server, in US dollars."
          />
        </StatGroup>
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
              <li key={`${w.code}-${i}`}>
                <Alert tone="warning">
                  <span dir="auto">{w.message}</span>
                  <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                    {w.code}
                    {w.page != null ? ` · page ${w.page}` : ""}
                  </span>
                </Alert>
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
      <EmptyState
        size="sm"
        icon={FileText}
        title="No extracted text yet"
        description="The extracted text is available once the extraction stage has completed."
      />
    );
  }
  if (preview.isLoading) {
    return (
      <div aria-busy="true" className="space-y-4">
        <SkeletonText lines={6} />
        <SkeletonText lines={4} />
      </div>
    );
  }
  if (preview.isError) {
    // 409 = no readable extracted text (yet); the server says why.
    if (preview.error instanceof ApiError && preview.error.status === 409) {
      return <EmptyState size="sm" icon={FileText} title="No readable text" description={formatUserError(preview.error)} />;
    }
    return <ErrorAlert message={formatUserError(preview.error)} />;
  }

  const data = preview.data;
  if (!data || data.pages.length === 0) return <EmptyState size="sm" icon={FileText} title="No text was extracted" />;

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
          <h4 className="border-b border-border bg-surface-muted px-3 py-1.5 text-xs font-medium text-muted-foreground">
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
    <Dialog open onOpenChange={(open) => !open && onClose()} size="xl">
      <DialogContent>
        <DialogHeader className="gap-3 pb-0">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
            <div className="min-w-0">
              <DialogTitle className="break-words">
                <bdi>{doc.filename}</bdi>
              </DialogTitle>
              <DialogDescription>
                Document <span className="font-mono">#{doc.id}</span> · {formatBytes(doc.size_bytes)}
              </DialogDescription>
            </div>
            <DocStatusBadge status={doc.status} className="mt-1" />
          </div>
          <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
            <TabsList aria-label="Document details" className="border-b-0">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="text">Extracted text</TabsTrigger>
            </TabsList>
          </Tabs>
        </DialogHeader>
        <DialogBody>
          {detail.isError && (
            <Alert
              tone="danger"
              icon={AlertCircle}
              className="mb-4"
              description={`Couldn't refresh this document: ${formatUserError(detail.error)}`}
            />
          )}
          {tab === "overview" ? <Overview doc={doc} /> : <ExtractedText doc={doc} />}
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
