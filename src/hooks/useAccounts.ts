import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { Account, AccountCreate, AccountUpdate, KbQueueGroup } from "@/types/api";

/** KB queue buttons available for an account's corpus (widget-customization editor). */
export function useAccountKbQueues(accountId: number | null, enabled = true) {
  return useQuery({
    queryKey: ["accounts", accountId, "kb-queues"],
    queryFn: () => apiGet<KbQueueGroup[]>(`/api/accounts/${accountId}/kb-queues`),
    enabled: enabled && accountId != null,
  });
}

export function useAccounts(organizationId?: number | null, enabled = true) {
  const params = organizationId ? `?organization_id=${organizationId}` : "";
  return useQuery({
    queryKey: ["accounts", organizationId ?? "all"],
    queryFn: () => apiGet<Account[]>(`/api/accounts${params}`),
    enabled,
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AccountCreate) => apiPost<Account>("/api/accounts", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: AccountUpdate }) =>
      apiPatch<Account>(`/api/accounts/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/accounts/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
}
