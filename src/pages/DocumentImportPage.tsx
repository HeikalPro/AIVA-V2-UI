import { useEffect, useMemo, useState } from "react";
import { Eye, FileText, ListChecks, RotateCcw, Send, Trash2, Upload } from "lucide-react";
import { formatUserError } from "@/lib/errors";
import {
  DOC_STATUSES,
  DOC_STATUS_LABELS,
  docIntelUnavailable,
  formatBytes,
  formatUploadError,
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
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAccountKbQueues, useAccounts } from "@/hooks/useAccounts";
import {
  useDocIntelStatus,
  useKbDocuments,
  useRepublishKbDocument,
  useRetryKbDocument,
  useUnpublishKbDocument,
  useUploadKbDocuments,
} from "@/hooks/useDocumentImport";
import { Page, PageHeading } from "@/components/shell/page";
import { DataTable, actionsColumn, type Column } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { toast } from "@/components/ui/toast";
import { ChangeQueuesDialog } from "@/components/doc-intel/ChangeQueuesDialog";
import { DocStatusBadge } from "@/components/doc-intel/DocStatusBadge";
import { DocumentDetailsDialog } from "@/components/doc-intel/DocumentDetailsDialog";
import { FileDropzone } from "@/components/doc-intel/FileDropzone";
import { Notice } from "@/components/doc-intel/Notice";
import { QueueChips } from "@/components/doc-intel/QueueChips";
import { QueueMultiSelect } from "@/components/doc-intel/QueueMultiSelect";
import { RelativeTime } from "@/components/doc-intel/RelativeTime";
import { StagePipeline } from "@/components/doc-intel/StagePipeline";
import { AutoRefreshIndicator } from "@/components/system/AutoRefreshIndicator";
import type { Account, DocStatus, KbDocumentOut } from "@/types/api";

const PAGE_SIZE = 25;
/** Display only: mirrors ACTIVE_REFETCH_MS in hooks/useDocumentImport (polls only while documents are processing). */
const ACTIVE_REFRESH_MS = 3_000;

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
      {counts.accepted > 0 && <p>Accepted files are queued for processing. Follow their progress in the Documents table below.</p>}
      {notAccepted > 0 && (
        <p className={counts.accepted > 0 ? "mt-1" : undefined}>
          {notAccepted === 1 ? "The file that was not accepted stays" : "Files that were not accepted stay"} in the file list with
          the reason. Fix or remove {notAccepted === 1 ? "it" : "them"}, then upload again.
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

export function DocumentImportPage() {
  const status = useDocIntelStatus();
  const workspace = useWorkspace();
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

  // Start on the workspace account when it has a knowledge base (once; the user's choice wins after that).
  const [defaulted, setDefaulted] = useState(false);
  if (!defaulted && corpusAccounts.length > 0 && !workspace.isLoading) {
    setDefaulted(true);
    if (accountId == null && workspace.accountId != null && corpusAccounts.some((a) => a.id === workspace.accountId)) {
      setAccountId(workspace.accountId);
    }
  }

  // ---- Documents table ----
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [offset, setOffset] = useState(0);
  const [detailsDoc, setDetailsDoc] = useState<KbDocumentOut | null>(null);
  const [queuesDoc, setQueuesDoc] = useState<KbDocumentOut | null>(null);
  const [unpublishDoc, setUnpublishDoc] = useState<KbDocumentOut | null>(null);
  const [unpublishError, setUnpublishError] = useState<string | null>(null);
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
        ? "Waiting for the account's queues."
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
    const mutation = kind === "retry" ? retry : republish;
    mutation.mutate(doc.id, {
      onSuccess: () => toast.success(kind === "retry" ? "Retry queued" : "Republish queued", { description: doc.filename }),
      onError: (e) =>
        toast.error(`${kind === "retry" ? "Retry" : "Republish"} failed`, { description: `“${doc.filename}”: ${formatUserError(e)}` }),
    });
  }

  async function confirmUnpublish() {
    if (!unpublishDoc) return;
    setUnpublishError(null);
    try {
      await unpublish.mutateAsync(unpublishDoc.id);
      toast.success("Document unpublished", { description: unpublishDoc.filename });
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
        <div className="min-w-[12rem] max-w-[18rem]">
          <p className="truncate font-medium text-foreground" title={doc.filename}>
            <bdi>{doc.filename}</bdi>
          </p>
          <p className="truncate text-xs text-muted-foreground" title={doc.uploaded_by_email ?? undefined}>
            {formatBytes(doc.size_bytes)} · {doc.uploaded_by_email ?? (doc.uploaded_by != null ? `User #${doc.uploaded_by}` : "—")}
          </p>
        </div>
      ),
    },
    {
      key: "account",
      header: "Account",
      truncate: true,
      maxWidth: "12rem",
      cellTitle: (doc) => documentAccountLabel(doc),
      render: (doc) => <bdi>{documentAccountLabel(doc)}</bdi>,
    },
    {
      key: "queues",
      header: "Queues",
      render: (doc) => <QueueChips queues={doc.queue_keys.map((key, i) => ({ key, label: doc.queue_labels[i] || key }))} />,
    },
    {
      key: "pipeline",
      header: "Pipeline",
      render: (doc) => <StagePipeline stages={doc.stages} fallbackError={doc.error_message} />,
    },
    {
      key: "status",
      header: "Status",
      render: (doc) => {
        const busy =
          (retry.isPending && retry.variables === doc.id) || (republish.isPending && republish.variables === doc.id);
        return (
          <div className="space-y-0.5">
            <DocStatusBadge status={doc.status} />
            {busy ? (
              <p className="whitespace-nowrap text-xs text-muted-foreground">Sending…</p>
            ) : (
              doc.status === "QUEUED" &&
              doc.queue_position != null && <p className="whitespace-nowrap text-xs text-muted-foreground">#{doc.queue_position} in queue</p>
            )}
          </div>
        );
      },
    },
    {
      key: "updated",
      header: "Updated",
      render: (doc) => <RelativeTime value={doc.updated_at ?? doc.created_at} className="text-muted-foreground" />,
    },
    actionsColumn<KbDocumentOut>(
      (doc) => {
        const can = documentActions(doc);
        const busy =
          (retry.isPending && retry.variables === doc.id) || (republish.isPending && republish.variables === doc.id);
        return [
          { label: "Details", icon: Eye, onSelect: () => setDetailsDoc(doc) },
          { label: "Retry", icon: RotateCcw, hidden: !can.retry, disabled: busy, onSelect: () => runRowAction("retry", doc) },
          { label: "Republish", icon: Send, hidden: !can.republish, disabled: busy, onSelect: () => runRowAction("republish", doc) },
          { label: "Change queues", icon: ListChecks, hidden: !can.changeQueues, disabled: busy, onSelect: () => setQueuesDoc(doc) },
          {
            label: "Unpublish",
            icon: Trash2,
            destructive: true,
            separatorBefore: true,
            hidden: !can.unpublish,
            disabled: busy,
            onSelect: () => {
              setUnpublishError(null);
              setUnpublishDoc(doc);
            },
          },
        ];
      },
      { label: (doc) => `Actions for ${doc.filename}` },
    ),
  ];

  const heading = (
    <PageHeading
      title="Document Import"
      description="Upload PDF and Word documents to an account's knowledge base and publish them to the queues you choose."
    />
  );

  if (unavailable) {
    return (
      <Page width="wide">
        {heading}
        <Notice tone="danger" title={unavailable.title}>
          {unavailable.message}
        </Notice>
      </Page>
    );
  }

  const isFiltered = accountFilter !== "ALL" || statusFilter !== "ALL";

  return (
    <Page width="wide">
      {heading}

      {status.isError && (
        <ErrorAlert message={`Couldn't load the import status: ${formatUserError(status.error)}. Default upload limits apply.`} />
      )}
      {status.data && !status.data.extraction_available && (
        <Notice tone="warning" title="Text extraction is unavailable">
          {status.data.extraction_unavailable_reason || "The document extractor is not available on the server."} Uploads are still
          accepted, but documents will fail at the extraction stage until this is fixed.
        </Notice>
      )}
      {status.data && !status.data.worker_running && (
        <Notice tone="warning" title="The import worker is not running">
          Uploaded documents stay queued until the backend's import worker starts.
        </Notice>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">Import documents</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Each file is extracted, split into chunks, embedded and published to the selected queues of the account's knowledge base.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-6 lg:grid-cols-2">
          <div className="space-y-5">
            <Field label="Account" htmlFor="doc-import-account" hint="Only accounts with a knowledge base are listed.">
              <Select
                id="doc-import-account"
                value={accountId != null ? String(accountId) : ""}
                onChange={(e) => handleAccountChange(e.target.value)}
                disabled={accountsLoading || upload.isPending}
              >
                <option value="">
                  {accountsLoading ? "Select an account…" : corpusAccounts.length ? "Select an account…" : "No accounts with a knowledge base"}
                </option>
                {corpusAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {accountLabel(a)}
                  </option>
                ))}
              </Select>
            </Field>

            {accountId == null ? (
              <div className="space-y-1">
                <p className="text-ui font-medium text-foreground">Publish to queues</p>
                <p className="text-sm text-muted-foreground">Select an account to choose its queues.</p>
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

          <div className="space-y-1.5">
            <p className="text-ui font-medium text-foreground">Files</p>
            <FileDropzone files={files} onChange={setFiles} limits={limits} disabled={status.isLoading || upload.isPending} fileStates={fileStates} />
          </div>
        </div>

        <div className="mt-5 space-y-3 border-t border-border pt-4">
          {progress && (
            <Progress value={progress.done} max={progress.total || 1} label="Upload progress" size="sm" />
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p id="doc-import-upload-hint" className={cn("text-sm", progress ? "text-foreground" : "text-muted-foreground")}>
              {progress ? (
                <>
                  Uploading file {progressStep} of {progress.total}
                  {progress.current ? (
                    <>
                      : <bdi className="font-medium">{progress.current.name}</bdi>
                    </>
                  ) : null}
                  . Keep this page open until it finishes.
                </>
              ) : (
                (uploadBlocker ?? `Ready to upload ${plural(files.length, "file")} to ${plural(selectedQueueCount, "queue")}, one file at a time.`)
              )}
            </p>
            <Button
              onClick={handleUpload}
              disabled={uploadBlocker != null}
              loading={upload.isPending}
              aria-describedby="doc-import-upload-hint"
              className="shrink-0"
            >
              {!upload.isPending && <Upload aria-hidden="true" className="h-4 w-4" />}
              {progress ? `Uploading ${progressStep} of ${progress.total}…` : files.length > 1 ? `Upload ${files.length} files` : "Upload"}
            </Button>
          </div>
          {/* Announces batch progress to screen readers (the visible hint above is not a live region). */}
          <p className="sr-only" aria-live="polite">
            {progress ? `Uploading file ${progressStep} of ${progress.total}` : ""}
          </p>
          <ErrorAlert message={uploadError} />
          {uploadSummary && <UploadBatchSummary counts={uploadSummary} onDismiss={() => setUploadSummary(null)} />}
        </div>
      </Card>

      <section aria-labelledby="doc-import-documents" className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="doc-import-documents" className="text-base font-semibold text-foreground">
            Documents
          </h2>
        </div>

        <ErrorAlert message={list.isError ? `Couldn't load documents: ${formatUserError(list.error)}` : null} />

        {/* While another page/filter loads, the previous rows stay visible but dimmed. */}
        <div aria-busy={list.isPlaceholderData || undefined} className={cn("transition-opacity", list.isPlaceholderData && "opacity-60")}>
          <DataTable<KbDocumentOut>
            aria-label="Documents"
            columns={columns}
            data={documents}
            keyFn={(doc) => doc.id}
            loading={list.isLoading}
            itemLabel="documents"
            onRowClick={(doc) => setDetailsDoc(doc)}
            rowLabel={(doc) => doc.filename}
            pagination={{
              mode: "server",
              page: Math.floor(offset / PAGE_SIZE) + 1,
              pageSize: PAGE_SIZE,
              total,
              onPageChange: (page) => setOffset((page - 1) * PAGE_SIZE),
            }}
            empty={
              isFiltered
                ? {
                    title: "No documents match these filters",
                    action: (
                      <Button variant="outline" size="sm" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    ),
                  }
                : { icon: FileText, title: "No documents imported yet", description: "Upload PDF or DOCX files above to add them to a knowledge base." }
            }
            toolbarEnd={anyActive ? <AutoRefreshIndicator intervalMs={ACTIVE_REFRESH_MS} fetching={list.isFetching} /> : undefined}
            toolbar={
              <FilterBar
                filters={[
                  {
                    id: "doc-filter-account",
                    label: "Account",
                    value: accountFilter,
                    onChange: (v) => {
                      setAccountFilter(v);
                      setOffset(0);
                    },
                    className: "max-w-[22rem]",
                    options: [{ value: "ALL", label: "All" }, ...corpusAccounts.map((a) => ({ value: String(a.id), label: accountLabel(a) }))],
                  },
                  {
                    id: "doc-filter-status",
                    label: "Status",
                    value: statusFilter,
                    onChange: (v) => {
                      setStatusFilter(v);
                      setOffset(0);
                    },
                    options: [{ value: "ALL", label: "All" }, ...DOC_STATUSES.map((s) => ({ value: s, label: DOC_STATUS_LABELS[s] }))],
                  },
                ]}
                onClear={clearFilters}
              />
            }
          />
        </div>
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
        loadingLabel="Unpublishing…"
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
    </Page>
  );
}
