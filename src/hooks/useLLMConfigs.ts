import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { LLMConfig, LLMConfigCreate, LLMConfigUpdate } from "@/types/api";

export function useLLMConfigs(enabled = true) {
  return useQuery({
    queryKey: ["llm-configs"],
    queryFn: () => apiGet<LLMConfig[]>("/api/llm-configs"),
    enabled,
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
