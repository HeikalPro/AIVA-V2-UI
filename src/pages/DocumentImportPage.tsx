import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Eye, FileUp, ListChecks, Loader2, RotateCcw, Send, Trash2, Upload } from "lucide-react";
import { formatUserError } from "@/lib/errors";
import {
  DOC_STATUSES,
  DOC_STATUS_LABELS,
  docIntelUnavailable,
  formatBytes,
  formatUploadError,
  formatWhen,
  isActiveDocStatus,
  isUploadRejected,
  notInstalled,
  stageStatusOf,
  uploadLimitsFrom,
  uploadSummaryTitle,
  type DocIntelUnavailable,
  type FileUploadState,
  type UploadCounts,
} from "@/lib/doc-intel";
import { useAccountKbQueues, useAccounts } from "@/hooks/useAccounts";
import {
  useDocIntelStatus,
  useKbDocuments,
  useRepublishKbDocument,
  useRetryKbDocument,
  useUnpublishKbDocument,
  useUploadKbDocuments,
} from "@/hooks/useDocumentImport";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ChangeQueuesDialog } from "@/components/doc-intel/ChangeQueuesDialog";
import { DocStatusBadge } from "@/components/doc-intel/DocStatusBadge";
import { DocumentDetailsDialog } from "@/components/doc-intel/DocumentDetailsDialog";
import { FileDropzone } from "@/components/doc-intel/FileDropzone";
import { Notice } from "@/components/doc-intel/Notice";
import { QueueMultiSelect } from "@/components/doc-intel/QueueMultiSelect";
import { StagePipeline } from "@/components/doc-intel/StagePipeline";
import type { Account, DocStatus, KbDocumentOut } from "@/types/api";

const PAGE_SIZE = 25;

function accountLabel(a: Account): string {
  return `${a.organization_name ?? `Org #${a.organization_id}`} · ${a.name}`;
}

function documentAccountLabel(doc: KbDocumentOut): string {
  const account = doc.account_name ?? `Account #${doc.account_id}`;
  return doc.organization_name ? `${doc.organization_name} · ${account}` : account;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Row actions per status (Super Admin only; the backend enforces the same rules). */
function documentActions(doc: KbDocumentOut) {
  // A file rejected at upload was never stored: there is nothing to retry, re-queue or unpublish.
  if (isUploadRejected(doc)) {
    return { retry: false, republish: false, changeQueues: false, unpublish: false };
  }
  return {
    retry: doc.status === "FAILED",
    republish:
      doc.status === "PUBLISHED" || (doc.status === "FAILED" && stageStatusOf(doc, "extraction") === "COMPLETED"),
    changeQueues: doc.status !== "UNPUBLISHED" && doc.status !== "PROCESSING",
    unpublish: doc.status === "PUBLISHED" || doc.status === "FAILED",
  };
}

/** One summary for the whole batch; per-file reasons stay on the file list above it. */
function UploadBatchSummary({ counts, onDismiss }: { counts: UploadCounts; onDismiss: () => void }) {
  const notAccepted = counts.rejected + counts.failed;
  const tone = notAccepted === 0 ? "success" : counts.accepted === 0 ? "danger" : "warning";
  return (
    <Notice tone={tone} title={uploadSummaryTitle(counts)} onDismiss={onDismiss}>
      {counts.accepted > 0 && (
        <p>Accepted files are queued for processing. Follow their progress in the Documents table below.</p>
      )}
      {notAccepted > 0 && (
        <p className={counts.accepted > 0 ? "mt-1" : undefined}>
          {notAccepted === 1 ? "The file that was not accepted stays" : "Files that were not accepted stay"} in the file
          list with the reason. Fix or remove {notAccepted === 1 ? "it" : "them"}, then upload again.
        </p>
      )}
    </Notice>
  );
}

/** Progress of the batch in flight, read from the per-file states. */
function batchProgress(states: ReadonlyMap<File, FileUploadState>) {
  let done = 0;
  let current: File | null = null;
  for (const [file, state] of states) {
    if (state.status === "uploading") current = file;
    else if (state.status !== "waiting") done += 1;
  }
  return { done, total: states.size, current };
}

function Pagination({
  offset,
  limit,
  total,
  onChange,
}: {
  offset: number;
  limit: number;
  total: number;
  onChange: (offset: number) => void;
}) {
  if (total <= limit && offset === 0) return null;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <nav aria-label="Documents pages" className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">
        Showing {from}–{to} of {total}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
          <ChevronLeft aria-hidden="true" className="mr-1 h-4 w-4" /> Previous
        </Button>
        <Button variant="outline" size="sm" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>
          Next <ChevronRight aria-hidden="true" className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}

export function DocumentImportPage() {
  const status = useDocIntelStatus();
  const { data: accounts = [], isLoading: accountsLoading } = useAccounts(null);
  const corpusAccounts = useMemo(
    () =>
      accounts
        .filter((a) => a.corpus_id)
        .sort((a, b) => accountLabel(a).localeCompare(accountLabel(b), undefined, { sensitivity: "base" })),
    [accounts],
  );

  // ---- Import form ----
  const [accountId, setAccountId] = useState<number | null>(null);
  const [queueKeys, setQueueKeys] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  // Per-file state of the current/last batch (files are uploaded one request each).
  const [fileStates, setFileStates] = useState<ReadonlyMap<File, FileUploadState>>(() => new Map());
  const [uploadSummary, setUploadSummary] = useState<UploadCounts | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const kbQueues = useAccountKbQueues(accountId);
  const upload = useUploadKbDocuments();

  // ---- Documents table ----
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [offset, setOffset] = useState(0);
  const [detailsDoc, setDetailsDoc] = useState<KbDocumentOut | null>(null);
  const [queuesDoc, setQueuesDoc] = useState<KbDocumentOut | null>(null);
  const [unpublishDoc, setUnpublishDoc] = useState<KbDocumentOut | null>(null);
  const [unpublishError, setUnpublishError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const retry = useRetryKbDocument();
  const republish = useRepublishKbDocument();
  const unpublish = useUnpublishKbDocument();

  const statusUnavailable: DocIntelUnavailable | null =
    docIntelUnavailable(status.error) ??
    (status.data && !status.data.installed
      ? notInstalled(status.data.detail)
      : status.data && !status.data.enabled
        ? {
            title: "Document intelligence is turned off",
            message: status.data.detail || "Set DOC_INTEL_ENABLED=true on the backend and restart it.",
          }
        : null);

  const list = useKbDocuments(
    {
      account_id: accountFilter === "ALL" ? undefined : Number(accountFilter),
      status: statusFilter === "ALL" ? undefined : (statusFilter as DocStatus),
      limit: PAGE_SIZE,
      offset,
    },
    statusUnavailable == null,
  );
  const unavailable = statusUnavailable ?? docIntelUnavailable(list.error);

  const total = list.data?.total ?? 0;
  const documents = list.data?.items ?? [];
  const anyActive = documents.some((d) => isActiveDocStatus(d.status));

  // Stay on a real page when the last row of the last page goes away (e.g. a filter change elsewhere).
  useEffect(() => {
    const data = list.data;
    if (!data || list.isPlaceholderData || offset === 0) return;
    if (data.items.length === 0 && data.total > 0) {
      setOffset(Math.floor((data.total - 1) / PAGE_SIZE) * PAGE_SIZE);
    }
  }, [list.data, list.isPlaceholderData, offset]);

  const limits = uploadLimitsFrom(status.data);
  const progress = upload.isPending ? batchProgress(fileStates) : null;
  const progressStep = progress ? Math.min(progress.done + 1, progress.total) : 0;
  const queues = kbQueues.data ?? [];
  const selectedQueueCount = queues.filter((q) => queueKeys.includes(q.key)).length;
  const uploadBlocker =
    accountId == null
      ? "Select an account."
      : kbQueues.isLoading
        ? "Loading the account's queues…"
        : kbQueues.isError
          ? "The account's queues could not be loaded."
          : queues.length === 0
            ? "This account has no knowledge-base queues to publish to."
            : selectedQueueCount === 0
              ? "Select at least one queue to publish to."
              : files.length === 0
                ? "Add at least one PDF or DOCX file."
                : null;

  function handleAccountChange(value: string) {
    setAccountId(value ? Number(value) : null);
    setQueueKeys([]);
    setUploadError(null);
    // Reasons from the last batch belong to the previous account.
    setFileStates(new Map());
    setUploadSummary(null);
  }

  async function handleUpload() {
    if (uploadBlocker || accountId == null || upload.isPending) return;
    const batch = [...files];
    setUploadError(null);
    setUploadSummary(null);
    setFileStates(new Map(batch.map((file): [File, FileUploadState] => [file, { status: "waiting" }])));
    try {
      const result = await upload.mutateAsync({
        accountId,
        queueKeys: queueKeys.filter((k) => queues.some((q) => q.key === k)),
        files: batch,
        onProgress: (file, state) => setFileStates((prev) => new Map(prev).set(file, state)),
      });
      setUploadSummary({
        accepted: result.accepted.length,
        rejected: result.rejected.length,
        failed: result.failed.length,
      });
      // Keep rejected/failed files (with their reasons) so they can be fixed or removed.
      const accepted = new Set(result.accepted);
      setFiles((prev) => prev.filter((file) => !accepted.has(file)));
      if (accepted.size > 0) setOffset(0);
    } catch (e) {
      // Per-file failures are handled inside the batch; this is only an unexpected error.
      const reason = formatUploadError(e);
      setUploadError(reason);
      setFileStates((prev) => {
        const next = new Map(prev);
        for (const [file, state] of prev) {
          if (state.status === "waiting" || state.status === "uploading") next.set(file, { status: "failed", reason });
        }
        return next;
      });
    }
  }

  function runRowAction(kind: "retry" | "republish", doc: KbDocumentOut) {
    setActionError(null);
    const mutation = kind === "retry" ? retry : republish;
    mutation.mutate(doc.id, {
      onError: (e) =>
        setActionError(`${kind === "retry" ? "Retry" : "Republish"} failed for “${doc.filename}”: ${formatUserError(e)}`),
    });
  }

  async function confirmUnpublish() {
    if (!unpublishDoc) return;
    setUnpublishError(null);
    try {
      await unpublish.mutateAsync(unpublishDoc.id);
      setUnpublishDoc(null);
    } catch (e) {
      setUnpublishError(formatUserError(e));
    }
  }

  function clearFilters() {
    setAccountFilter("ALL");
    setStatusFilter("ALL");
    setOffset(0);
  }

  const columns: Column<KbDocumentOut>[] = [
    {
      key: "file",
      header: "File",
      render: (doc) => (
        // Wrapping (not truncate) keeps the column's minimum width small, so the table fits beside the sidebar.
        <div className="min-w-[10rem] max-w-[16rem]">
          <p className="line-clamp-2 font-medium text-foreground [overflow-wrap:anywhere]" title={doc.filename}>
            {doc.filename}
          </p>
          <p className="text-xs text-muted-foreground">{formatBytes(doc.size_bytes)}</p>
          <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {doc.uploaded_by_email ?? (doc.uploaded_by != null ? `User #${doc.uploaded_by}` : "—")} ·{" "}
            {formatWhen(doc.created_at)}
          </p>
        </div>
      ),
    },
    {
      key: "account",
      header: "Account",
      render: (doc) => <span className="block max-w-[12rem] break-words">{documentAccountLabel(doc)}</span>,
    },
    {
      key: "queues",
      header: "Queues",
      render: (doc) =>
        doc.queue_keys.length === 0 ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <div className="flex max-w-[12rem] flex-wrap gap-1">
            {doc.queue_keys.map((key, i) => (
              <span
                key={`${key}-${i}`}
                title={key}
                className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[11px] font-medium leading-4 text-foreground"
              >
                {doc.queue_labels[i] || key}
              </span>
            ))}
          </div>
        ),
    },
    {
      key: "pipeline",
      header: "Pipeline",
      render: (doc) => (
        // Wide enough for three pills per line; one line when the table has room.
        <StagePipeline className="min-w-[12.5rem]" stages={doc.stages} fallbackError={doc.error_message} />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (doc) => (
        <div className="space-y-1">
          <DocStatusBadge status={doc.status} />
          {doc.status === "QUEUED" && doc.queue_position != null && (
            <p className="whitespace-nowrap text-xs text-muted-foreground">#{doc.queue_position} in queue</p>
          )}
        </div>
      ),
    },
    {
      key: "updated",
      header: "Updated",
      render: (doc) => <span className="block min-w-[5.5rem] text-xs">{formatWhen(doc.updated_at ?? doc.created_at)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      render: (doc) => {
        const can = documentActions(doc);
        const retrying = retry.isPending && retry.variables === doc.id;
        const republishing = republish.isPending && republish.variables === doc.id;
        const busy = retrying || republishing;
        return (
          // Row clicks open the details; keep button clicks from also doing that.
          <div className="flex min-w-[10.5rem] flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" onClick={() => setDetailsDoc(doc)}>
              <Eye aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Details
            </Button>
            {can.retry && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => runRowAction("retry", doc)}>
                {retrying ? (
                  <Loader2 aria-hidden="true" className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RotateCcw aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
                )}
                Retry
              </Button>
            )}
            {can.republish && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => runRowAction("republish", doc)}>
                {republishing ? (
                  <Loader2 aria-hidden="true" className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
                )}
                Republish
              </Button>
            )}
            {can.changeQueues && (
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setQueuesDoc(doc)}>
                <ListChecks aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Change queues
              </Button>
            )}
            {can.unpublish && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => {
                  setUnpublishError(null);
                  setUnpublishDoc(doc);
                }}
              >
                <Trash2 aria-hidden="true" className="mr-1 h-3.5 w-3.5 text-red-600" /> Unpublish
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  const header = (
    <PageHeader
      icon={FileUp}
      title="Document Import"
      description="Upload PDF and Word documents to an account's knowledge base and publish them to the queues you choose."
    />
  );

  if (unavailable) {
    return (
      <div className="space-y-6">
        {header}
        <Notice tone="danger" title={unavailable.title}>
          {unavailable.message}
        </Notice>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {status.isError && (
        <ErrorAlert message={`Couldn't load the import status: ${formatUserError(status.error)}. Default upload limits apply.`} />
      )}
      {status.data && !status.data.extraction_available && (
        <Notice tone="warning" title="Text extraction is unavailable">
          <p>{status.data.extraction_unavailable_reason || "The document extractor is not available on the server."}</p>
          <p className="mt-1">
            Uploads are still accepted, but documents will fail at the extraction stage until this is fixed.
          </p>
        </Notice>
      )}
      {status.data && !status.data.worker_running && (
        <Notice tone="warning" title="The import worker is not running">
          Uploaded documents stay queued until the backend's import worker starts.
        </Notice>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Import documents</CardTitle>
          <CardDescription>
            Each file is extracted, split into chunks, embedded and published to the selected queues of the account's
            knowledge base.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-5">
              <div>
                <Label htmlFor="doc-import-account">Account</Label>
                <Select
                  id="doc-import-account"
                  value={accountId != null ? String(accountId) : ""}
                  onChange={(e) => handleAccountChange(e.target.value)}
                  disabled={accountsLoading || upload.isPending}
                  className="mt-1"
                >
                  <option value="">
                    {accountsLoading
                      ? "Loading accounts…"
                      : corpusAccounts.length
                        ? "Select an account…"
                        : "No accounts with a knowledge base"}
                  </option>
                  {corpusAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {accountLabel(a)}
                    </option>
                  ))}
                </Select>
                <p className="mt-1 text-xs text-muted-foreground">Only accounts with a knowledge base are listed.</p>
              </div>

              {accountId == null ? (
                <div>
                  <p className="text-sm font-medium text-slate-700">Queues</p>
                  <p className="mt-1 text-sm text-muted-foreground">Select an account to choose its queues.</p>
                </div>
              ) : (
                <QueueMultiSelect
                  queues={queues}
                  selected={queueKeys}
                  onChange={setQueueKeys}
                  loading={kbQueues.isLoading}
                  error={kbQueues.isError ? formatUserError(kbQueues.error) : null}
                  disabled={upload.isPending}
                  label="Publish to queues"
                />
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Files</p>
              <FileDropzone
                files={files}
                onChange={setFiles}
                limits={limits}
                disabled={status.isLoading || upload.isPending}
                fileStates={fileStates}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <p id="doc-import-upload-hint" className={`text-sm ${progress ? "text-primary" : "text-muted-foreground"}`}>
              {progress
                ? `Uploading file ${progressStep} of ${progress.total}${progress.current ? `: ${progress.current.name}` : ""}. Keep this page open until it finishes.`
                : (uploadBlocker ??
                  `Ready to upload ${plural(files.length, "file")} to ${plural(selectedQueueCount, "queue")}, one file at a time.`)}
            </p>
            <Button
              onClick={handleUpload}
              disabled={uploadBlocker != null || upload.isPending}
              aria-describedby="doc-import-upload-hint"
              className="shrink-0"
            >
              {upload.isPending ? (
                <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload aria-hidden="true" className="mr-2 h-4 w-4" />
              )}
              {progress
                ? `Uploading ${progressStep} of ${progress.total}…`
                : files.length > 1
                  ? `Upload ${files.length} files`
                  : "Upload"}
            </Button>
          </div>
          {/* Announces batch progress to screen readers (the visible hint above is not a live region). */}
          <p className="sr-only" aria-live="polite">
            {progress ? `Uploading file ${progressStep} of ${progress.total}` : ""}
          </p>

          <ErrorAlert message={uploadError} />
          {uploadSummary && <UploadBatchSummary counts={uploadSummary} onDismiss={() => setUploadSummary(null)} />}
        </CardContent>
      </Card>

      <section aria-labelledby="doc-import-documents" className="space-y-4">
        <h2 id="doc-import-documents" className="text-lg font-semibold text-foreground">
          Documents
        </h2>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="w-full lg:w-72">
              <Label htmlFor="doc-filter-account">Account</Label>
              <Select
                id="doc-filter-account"
                value={accountFilter}
                onChange={(e) => {
                  setAccountFilter(e.target.value);
                  setOffset(0);
                }}
                className="mt-1"
              >
                <option value="ALL">All accounts</option>
                {corpusAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountLabel(a)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="w-full lg:w-48">
              <Label htmlFor="doc-filter-status">Status</Label>
              <Select
                id="doc-filter-status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setOffset(0);
                }}
                className="mt-1"
              >
                <option value="ALL">All statuses</option>
                {DOC_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {DOC_STATUS_LABELS[s]}
                  </option>
                ))}
              </Select>
            </div>
            {(accountFilter !== "ALL" || statusFilter !== "ALL") && (
              <Button type="button" variant="outline" onClick={clearFilters} className="lg:mb-0.5">
                Clear filters
              </Button>
            )}
          </div>
          <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
            {list.data ? plural(total, "document") : list.isLoading ? "Loading documents…" : "—"}
            {anyActive ? " · refreshing every 3 s while documents are processing" : ""}
          </p>
        </div>

        <ErrorAlert message={actionError} />
        <ErrorAlert message={list.isError ? `Couldn't load documents: ${formatUserError(list.error)}` : null} />

        {/* While another page/filter loads, the previous rows stay visible but dimmed. */}
        <div aria-busy={list.isPlaceholderData} className={`transition-opacity ${list.isPlaceholderData ? "opacity-60" : ""}`}>
          <DataTable
            columns={columns}
            data={documents}
            keyFn={(doc) => doc.id}
            loading={list.isLoading}
            emptyMessage={
              accountFilter !== "ALL" || statusFilter !== "ALL"
                ? "No documents match these filters."
                : "No documents imported yet."
            }
            onRowClick={(doc) => setDetailsDoc(doc)}
          />
        </div>

        <Pagination offset={offset} limit={PAGE_SIZE} total={total} onChange={setOffset} />
      </section>

      {detailsDoc && <DocumentDetailsDialog document={detailsDoc} onClose={() => setDetailsDoc(null)} />}
      {queuesDoc && <ChangeQueuesDialog document={queuesDoc} onClose={() => setQueuesDoc(null)} />}
      <ConfirmDialog
        open={unpublishDoc != null}
        title="Unpublish document?"
        message={
          unpublishDoc
            ? `“${unpublishDoc.filename}” will be removed from all of its queues and its indexed chunks deleted, so chat answers stop using it right away. The document record is kept as Unpublished.`
            : ""
        }
        confirmLabel="Unpublish"
        destructive
        loading={unpublish.isPending}
        error={unpublishError}
        onConfirm={confirmUnpublish}
        onCancel={() => {
          if (unpublish.isPending) return;
          setUnpublishDoc(null);
          setUnpublishError(null);
        }}
      />
    </div>
  );
}
