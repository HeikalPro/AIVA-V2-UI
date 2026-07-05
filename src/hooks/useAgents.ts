import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import type { TraineeCreate, User } from "@/types/api";

export function useAgents(accountId?: number | null) {
  const params = accountId != null ? `?account_id=${accountId}` : "";
  return useQuery({
    queryKey: ["agents", accountId ?? "all"],
    queryFn: () => apiGet<User[]>(`/api/agents${params}`),
  });
}

export function useCreateTrainee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TraineeCreate) => apiPost<User>("/api/agents/trainees", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["account-users"] });
    },
  });
}

export function usePromoteTrainee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, accountId }: { userId: number; accountId: number }) =>
      apiPost<User>(`/api/agents/${userId}/promote?account_id=${accountId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["agents"] });
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}
