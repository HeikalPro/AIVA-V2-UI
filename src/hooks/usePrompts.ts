import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { DefaultPrompt, Prompt, PromptCreate, PromptUpdate } from "@/types/api";

export function useDefaultPrompt() {
  return useQuery({
    queryKey: ["prompts", "default"],
    queryFn: () => apiGet<DefaultPrompt>("/api/prompts/default"),
  });
}

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
