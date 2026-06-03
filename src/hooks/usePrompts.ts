import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { Prompt, PromptCreate, PromptUpdate, SystemPrompt, SystemPromptUpdate } from "@/types/api";

export function usePrompts(accountId?: number | null) {
  const params = accountId ? `?account_id=${accountId}` : "";
  return useQuery({
    queryKey: ["prompts", accountId ?? "all"],
    queryFn: () => apiGet<Prompt[]>(`/api/prompts${params}`),
    enabled: accountId != null,
  });
}

export function useCreatePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PromptCreate) => apiPost<Prompt>("/api/prompts", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompts"] }),
  });
}

export function useUpdatePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: PromptUpdate }) =>
      apiPatch<Prompt>(`/api/prompts/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompts"] }),
  });
}

export function useDeletePrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/prompts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompts"] }),
  });
}

export function useSystemPrompt() {
  return useQuery({
    queryKey: ["prompts", "system"],
    queryFn: () => apiGet<SystemPrompt>("/api/prompts/system"),
  });
}

export function useUpdateSystemPrompt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SystemPromptUpdate) => apiPatch<SystemPrompt>("/api/prompts/system", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["prompts", "system"] }),
  });
}
