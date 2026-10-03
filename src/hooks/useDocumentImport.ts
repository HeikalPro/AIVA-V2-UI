import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost, apiUpload } from "@/lib/api-client";
import { ApiError } from "@/lib/errors";
import {
  docIntelUnavailable,
  formatUploadError,
  isActiveDocStatus,
  isUploadRejected,
  retryUnlessUnavailable,
  uploadRejectionReason,
  type FileUploadState,
} from "@/lib/doc-intel";
import type {
  DocIntelStatusOut,
  DocStatus,
  KbDocumentListOut,
  KbDocumentOut,
  KbPreviewOut,
  KbQueuesUpdate,
  KbUploadOut,
} from "@/types/api";

const BASE = "/api/doc-intel";

/** Poll cadence while a shown document is still queued or processing; polling stops once all are done. */
const ACTIVE_REFETCH_MS = 3_000;

/** Characters of extracted text requested for the details preview. */
export const PREVIEW_MAX_CHARS = 20_000;

export type KbDocumentListParams = {
  account_id?: number;
  status?: DocStatus;
  batch_id?: string;
  limit: number;
  offset: number;
};

export type KbUploadBatchInput = {
  accountId: number;
  queueKeys: string[];
  files: File[];
  /** Called as each file moves waiting → uploading → accepted / rejected / failed. */
  onProgress?: (file: File, state: FileUploadState) => void;
};

export type KbUploadBatchResult = {
  accepted: File[];
  rejected: File[];
  failed: File[];
};

/** Sends one multipart request; injectable so the batch loop can be exercised without a server. */
export type KbUploadRequest = (form: FormData) => Promise<KbUploadOut>;

const postKbUpload: KbUploadRequest = (form) => apiUpload<KbUploadOut>(`${BASE}/kb-documents`, form);

const docKeys = {
  lists: ["doc-intel", "kb-documents", "list"] as const,
  list: (params: KbDocumentListParams) => ["doc-intel", "kb-documents", "list", params] as const,
  detail: (id: number | null) => ["doc-intel", "kb-documents", "detail", id] as const,
  previews: (id: number) => ["doc-intel", "kb-documents", "preview", id] as const,
};

function invalidateDocumentQueries(qc: QueryClient, id?: number) {
  qc.invalidateQueries({ queryKey: docKeys.lists });
  if (id != null) {
    qc.invalidateQueries({ queryKey: docKeys.detail(id) });
    qc.invalidateQueries({ queryKey: docKeys.previews(id) });
  }
}

/** Module status and upload limits. */
export function useDocIntelStatus(enabled = true) {
  return useQuery({
    queryKey: ["doc-intel", "status"],
    queryFn: () => apiGet<DocIntelStatusOut>(`${BASE}/status`),
    enabled,
    retry: retryUnlessUnavailable,
  });
}

export function useKbDocuments(params: KbDocumentListParams, enabled = true) {
  const search = new URLSearchParams();
  if (params.account_id != null) search.set("account_id", String(params.account_id));
  if (params.status) search.set("status", params.status);
  if (params.batch_id) search.set("batch_id", params.batch_id);
  search.set("limit", String(params.limit));
  search.set("offset", String(params.offset));
  return useQuery({
    queryKey: docKeys.list(params),
    queryFn: () => apiGet<KbDocumentListOut>(`${BASE}/kb-documents?${search.toString()}`),
    enabled,
    placeholderData: keepPreviousData,
    retry: retryUnlessUnavailable,
    refetchInterval: (query) =>
      query.state.data?.items.some((d) => isActiveDocStatus(d.status)) ? ACTIVE_REFETCH_MS : false,
  });
}

export function useKbDocument(id: number | null) {
  return useQuery({
    queryKey: docKeys.detail(id),
    queryFn: () => apiGet<KbDocumentOut>(`${BASE}/kb-documents/${id}`),
    enabled: id != null,
    refetchInterval: (query) =>
      query.state.data && isActiveDocStatus(query.state.data.status) ? ACTIVE_REFETCH_MS : false,
  });
}

/**
 * Extracted-text preview; pass `enabled` only once it is actually shown. `max_chars` caps the total
 * across all pages. The server answers 409 until extraction has completed, so that is not retried.
 */
export function useKbDocumentPreview(id: number | null, enabled = true, maxChars = PREVIEW_MAX_CHARS) {
  return useQuery({
    queryKey: [...docKeys.previews(id ?? -1), maxChars],
    queryFn: () => apiGet<KbPreviewOut>(`${BASE}/kb-documents/${id}/preview?max_chars=${maxChars}`),
    enabled: enabled && id != null,
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 409) && failureCount < 1,
  });
}

/**
 * A failure that every remaining file would hit too (sign-in, role, account/queue validation, module
 * missing), so the batch stops. File-level HTTP failures (413, 408, 429, 5xx, network) do not.
 */
function stopsBatch(error: unknown): boolean {
  if (docIntelUnavailable(error)) return true;
  if (!(error instanceof ApiError) || error.status == null) return false;
  return error.status >= 400 && error.status < 500 && ![408, 413, 429].includes(error.status);
}

/**
 * Uploads a batch one file per request (account_id + every queue_keys entry + exactly one `files`),
 * so no request comes near the proxy's body limit. A request that fails at the HTTP level marks that
 * file failed and the batch carries on; a request-wide rejection stops it (see stopsBatch).
 */
export async function uploadFilesSequentially(
  { accountId, queueKeys, files, onProgress }: KbUploadBatchInput,
  request: KbUploadRequest = postKbUpload,
): Promise<KbUploadBatchResult> {
  const result: KbUploadBatchResult = { accepted: [], rejected: [], failed: [] };
  const report = (file: File, state: FileUploadState) => onProgress?.(file, state);
  for (const file of files) report(file, { status: "waiting" });

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    report(file, { status: "uploading" });
    const form = new FormData();
    form.append("account_id", String(accountId));
    for (const key of queueKeys) form.append("queue_keys", key);
    form.append("files", file, file.name);
    try {
      const out = await request(form);
      if (!out || typeof out !== "object" || typeof out.accepted !== "number") {
        throw new Error("Unexpected response from the server.");
      }
      const doc = Array.isArray(out.documents) ? out.documents[0] : undefined;
      if (out.accepted > 0 && !(doc && isUploadRejected(doc))) {
        result.accepted.push(file);
        report(file, { status: "accepted" });
      } else {
        result.rejected.push(file);
        report(file, { status: "rejected", reason: (doc && uploadRejectionReason(doc)) || "Rejected by the server." });
      }
    } catch (error) {
      const reason = formatUploadError(error);
      result.failed.push(file);
      report(file, { status: "failed", reason });
      if (stopsBatch(error)) {
        for (const rest of files.slice(i + 1)) {
          result.failed.push(rest);
          report(rest, { status: "failed", reason: `Not uploaded — ${reason}` });
        }
        break;
      }
    }
  }
  return result;
}

/** Sequential batch upload; the documents list is invalidated once, when the whole batch has settled. */
export function useUploadKbDocuments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: KbUploadBatchInput) => uploadFilesSequentially(input),
    onSettled: () => invalidateDocumentQueries(qc),
  });
}

export function useRetryKbDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiPost<KbDocumentOut>(`${BASE}/kb-documents/${id}/retry`),
    onSettled: (_data, _error, id) => invalidateDocumentQueries(qc, id),
  });
}

export function useRepublishKbDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiPost<KbDocumentOut>(`${BASE}/kb-documents/${id}/republish`),
    onSettled: (_data, _error, id) => invalidateDocumentQueries(qc, id),
  });
}

export function useChangeKbDocumentQueues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, queueKeys }: { id: number; queueKeys: string[] }) => {
      const body: KbQueuesUpdate = { queue_keys: queueKeys };
      return apiPatch<KbDocumentOut>(`${BASE}/kb-documents/${id}/queues`, body);
    },
    onSettled: (_data, _error, variables) => invalidateDocumentQueries(qc, variables.id),
  });
}

/** DELETE = unpublish: the row is kept as UNPUBLISHED. */
export function useUnpublishKbDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete<KbDocumentOut>(`${BASE}/kb-documents/${id}`),
    onSettled: (_data, _error, id) => invalidateDocumentQueries(qc, id),
  });
}
