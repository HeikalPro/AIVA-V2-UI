import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import { retryUnlessUnavailable } from "@/lib/doc-intel";
import { isActiveRun } from "@/lib/sharepoint-sync";
import type {
  ConnectionTestOut,
  CrmEntityListOut,
  CrmEntityOut,
  EntityStatus,
  FileState,
  FileStatus,
  SourceCreate,
  SourceFileListOut,
  SourceFileOut,
  SourceOut,
  SourceUpdate,
  SyncRunListOut,
  SyncRunOut,
} from "@/types/api";

const BASE = "/api/doc-intel";

/** Poll cadence while a sync is queued or running; polling stops once nothing is active. */
export const SYNC_REFETCH_MS = 3_000;

export type PageParams = { limit: number; offset: number };

export type SourceFilesParams = PageParams & { state?: FileState; status?: FileStatus };

export type CrmEntitiesParams = PageParams & {
  source_id?: number;
  entity_type?: string;
  status?: EntityStatus;
  q?: string;
};

const syncKeys = {
  sources: ["doc-intel", "sharepoint", "sources"] as const,
  runsOf: (sourceId: number) => ["doc-intel", "sharepoint", "runs", sourceId] as const,
  runs: (sourceId: number, params: PageParams) => ["doc-intel", "sharepoint", "runs", sourceId, params] as const,
  filesOf: (sourceId: number) => ["doc-intel", "sharepoint", "files", sourceId] as const,
  files: (sourceId: number, params: SourceFilesParams) => ["doc-intel", "sharepoint", "files", sourceId, params] as const,
  entitiesAll: ["doc-intel", "sharepoint", "entities"] as const,
  entities: (params: CrmEntitiesParams) => ["doc-intel", "sharepoint", "entities", params] as const,
  entity: (id: number | null) => ["doc-intel", "sharepoint", "entity", id] as const,
};

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  return search.toString();
}

/** Keep the previous page on screen while the next one loads, but never another source's rows. */
function sameSourcePlaceholder<T>(sourceId: number) {
  return (previous: T | undefined, previousQuery: { queryKey: readonly unknown[] } | undefined) =>
    previousQuery?.queryKey[3] === sourceId ? previous : undefined;
}

function invalidateSourceData(qc: QueryClient, sourceId: number) {
  qc.invalidateQueries({ queryKey: syncKeys.runsOf(sourceId) });
  qc.invalidateQueries({ queryKey: syncKeys.filesOf(sourceId) });
  qc.invalidateQueries({ queryKey: syncKeys.entitiesAll });
}

// ---- Queries ---------------------------------------------------------------------------------

/** Every source (secret never included). Polls while any source has a queued or running sync. */
export function useSyncSources(enabled = true) {
  return useQuery({
    queryKey: syncKeys.sources,
    queryFn: () => apiGet<SourceOut[]>(`${BASE}/sources`),
    enabled,
    retry: retryUnlessUnavailable,
    refetchInterval: (q) => (q.state.data?.some((s) => isActiveRun(s.active_run)) ? SYNC_REFETCH_MS : false),
  });
}

/** Sync history of one source; `active` = the source has a queued/running run (from the sources list). */
export function useSyncRuns(sourceId: number, params: PageParams, active: boolean) {
  return useQuery({
    queryKey: syncKeys.runs(sourceId, params),
    queryFn: () => apiGet<SyncRunListOut>(`${BASE}/sources/${sourceId}/runs?${query(params)}`),
    placeholderData: sameSourcePlaceholder<SyncRunListOut>(sourceId),
    refetchInterval: (q) => (active || q.state.data?.items.some(isActiveRun) ? SYNC_REFETCH_MS : false),
  });
}

/** Files of one source with their stages. Polls while a run is active or a shown file is being processed. */
export function useSourceFiles(sourceId: number, params: SourceFilesParams, active: boolean) {
  return useQuery({
    queryKey: syncKeys.files(sourceId, params),
    queryFn: () => apiGet<SourceFileListOut>(`${BASE}/sources/${sourceId}/files?${query(params)}`),
    placeholderData: sameSourcePlaceholder<SourceFileListOut>(sourceId),
    refetchInterval: (q) =>
      active || q.state.data?.items.some((f) => f.status === "PROCESSING") ? SYNC_REFETCH_MS : false,
  });
}

/** CRM entities (Super Admin only). */
export function useCrmEntities(params: CrmEntitiesParams, enabled = true) {
  return useQuery({
    queryKey: syncKeys.entities(params),
    queryFn: () => apiGet<CrmEntityListOut>(`${BASE}/crm/entities?${query(params)}`),
    enabled,
    placeholderData: (previous, previousQuery) =>
      (previousQuery?.queryKey[3] as CrmEntitiesParams | undefined)?.source_id === params.source_id ? previous : undefined,
  });
}

export function useCrmEntity(id: number | null) {
  return useQuery({
    queryKey: syncKeys.entity(id),
    queryFn: () => apiGet<CrmEntityOut>(`${BASE}/crm/entities/${id}`),
    enabled: id != null,
  });
}

/**
 * When a source's active run finishes, refresh what is shown for it: the last poll of the runs,
 * files and entities may predate the finish.
 */
export function useRefreshWhenSyncsFinish(sources: SourceOut[] | undefined) {
  const qc = useQueryClient();
  const activeBefore = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!sources) return;
    const activeNow = new Set(sources.filter((s) => isActiveRun(s.active_run)).map((s) => s.id));
    for (const sourceId of activeBefore.current) {
      if (!activeNow.has(sourceId)) invalidateSourceData(qc, sourceId);
    }
    activeBefore.current = activeNow;
  }, [sources, qc]);
}

// ---- Mutations -------------------------------------------------------------------------------
// Create and update carry the client secret in their variables: gcTime 0 drops the mutation from
// the mutation cache as soon as its dialog stops observing it, and nothing they send or receive is
// written into a query cache (the sources list is refetched instead).

export function useCreateSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SourceCreate) => apiPost<SourceOut>(`${BASE}/sources`, body),
    gcTime: 0,
    onSuccess: () => qc.invalidateQueries({ queryKey: syncKeys.sources }),
  });
}

export function useUpdateSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: SourceUpdate }) => apiPatch<SourceOut>(`${BASE}/sources/${id}`, body),
    gcTime: 0,
    onSettled: () => qc.invalidateQueries({ queryKey: syncKeys.sources }),
  });
}

/** Soft delete (204): the source stops syncing; its files and entities are kept as withdrawn history. */
export function useDeleteSource() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete<unknown>(`${BASE}/sources/${id}`),
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: syncKeys.runsOf(id) });
      qc.removeQueries({ queryKey: syncKeys.filesOf(id) });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: syncKeys.sources });
      qc.invalidateQueries({ queryKey: syncKeys.entitiesAll });
    },
  });
}

/** Step-by-step connection diagnostics (Super Admin + Developer). */
export function useTestSourceConnection() {
  return useMutation({
    mutationFn: (id: number) => apiPost<ConnectionTestOut>(`${BASE}/sources/${id}/test`),
  });
}

/** "Sync now": 202 with the queued run, which is shown on the source at once; 409 = one is already active. */
export function useSyncSourceNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiPost<SyncRunOut>(`${BASE}/sources/${id}/sync`),
    onSuccess: (run, id) => {
      qc.setQueryData<SourceOut[]>(syncKeys.sources, (prev) =>
        prev?.map((s) => (s.id === id && run && typeof run === "object" ? { ...s, active_run: run } : s)),
      );
    },
    onSettled: (_data, _error, id) => {
      qc.invalidateQueries({ queryKey: syncKeys.sources });
      qc.invalidateQueries({ queryKey: syncKeys.runsOf(id) });
    },
  });
}

/** A FAILED file goes back to PENDING with a fresh retry budget; the source's next sync processes it. */
export function useRetrySourceFile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId }: { fileId: number; sourceId: number }) =>
      apiPost<SourceFileOut>(`${BASE}/source-files/${fileId}/retry`),
    onSettled: (_data, _error, { sourceId }) => {
      qc.invalidateQueries({ queryKey: syncKeys.filesOf(sourceId) });
      qc.invalidateQueries({ queryKey: syncKeys.sources });
    },
  });
}
