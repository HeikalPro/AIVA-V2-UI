import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import type { IngestionRequest, IngestionRequestCreate, IngestionTrigger, JobOut } from "@/types/api";

export function useIngestionRequests() {
  return useQuery({
    queryKey: ["ingestion-requests"],
    queryFn: () => apiGet<IngestionRequest[]>("/api/ingestion/requests"),
  });
}

export function useCreateIngestionRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: IngestionRequestCreate) =>
      apiPost<IngestionRequest>("/api/ingestion/requests", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ingestion-requests"] }),
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
