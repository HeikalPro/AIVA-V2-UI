import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { LLMConfig, LLMConfigCreate, LLMConfigUpdate, ModelCatalogOut } from "@/types/api";

export function useLLMConfigs(enabled = true) {
  return useQuery({
    queryKey: ["llm-configs"],
    queryFn: () => apiGet<LLMConfig[]>("/api/llm-configs"),
    enabled,
  });
}

/** SovereignEG model catalog with live per-model pricing (EGP per 1M tokens) + fetch status. */
export function useModelCatalog(enabled = true) {
  return useQuery({
    queryKey: ["model-catalog"],
    queryFn: () => apiGet<ModelCatalogOut>("/api/llm-configs/model-catalog"),
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}

/** Force a live refetch from SovereignEG (bypasses the backend cache) and updates the query. */
export function useRefreshModelCatalog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiGet<ModelCatalogOut>("/api/llm-configs/model-catalog?refresh=true"),
    onSuccess: (data) => qc.setQueryData(["model-catalog"], data),
  });
}

export function useCreateLLMConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: LLMConfigCreate) => apiPost<LLMConfig>("/api/llm-configs", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["llm-configs"] }),
  });
}

export function useUpdateLLMConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: LLMConfigUpdate }) =>
      apiPatch<LLMConfig>(`/api/llm-configs/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["llm-configs"] }),
  });
}

export function useDeleteLLMConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/llm-configs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["llm-configs"] }),
  });
}
