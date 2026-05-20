import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type {
  IngestionRequest,
  IngestionRequestCreate,
  IngestionRequestCreateResponse,
  IngestionRequestUpdate,
  IngestionTrigger,
  JobOut,
} from "@/types/api";

function invalidateIngestionQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["ingestion-requests"] });
  qc.invalidateQueries({ queryKey: ["ingestion-pending-count"] });
}

export function useIngestionRequests() {
  return useQuery({
    queryKey: ["ingestion-requests"],
    queryFn: () => apiGet<IngestionRequest[]>("/api/ingestion/requests"),
  });
}

/** Super admin only: pending ingestion requests for nav badge */
export function useIngestionPendingCount(enabled: boolean) {
  return useQuery({
    queryKey: ["ingestion-pending-count"],
    queryFn: () => apiGet<{ pending_count: number }>("/api/ingestion/requests/pending-count"),
    enabled,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

export function useCreateIngestionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: IngestionRequestCreate) =>
      apiPost<IngestionRequestCreateResponse>("/api/ingestion/requests", body),
    onSuccess: () => invalidateIngestionQueries(qc),
  });
}

export function useUpdateIngestionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: IngestionRequestUpdate }) =>
      apiPatch<IngestionRequest>(`/api/ingestion/requests/${id}`, body),
    onSuccess: () => invalidateIngestionQueries(qc),
  });
}

export function useTriggerIngestion() {
  return useMutation({
    mutationFn: (body: IngestionTrigger) => apiPost<JobOut>("/api/ingestion/trigger", body),
  });
}

export function useJobStatus(jobId: string | null) {
  return useQuery({
    queryKey: ["ingestion-job", jobId],
    queryFn: () => apiGet<JobOut>(`/api/ingestion/jobs/${jobId}`),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status?.toUpperCase();
      if (!status || status === "COMPLETED" || status === "FAILED") return false;
      return 3000;
    },
  });
}
