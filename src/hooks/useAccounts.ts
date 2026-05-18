import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { Account, AccountCreate, AccountUpdate } from "@/types/api";

export function useAccounts(organizationId?: number | null) {
  const params = organizationId ? `?organization_id=${organizationId}` : "";
  return useQuery({
    queryKey: ["accounts", organizationId ?? "all"],
    queryFn: () => apiGet<Account[]>(`/api/accounts${params}`),
  });
}

export function useCreateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AccountCreate) => apiPost<Account>("/api/accounts", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useUpdateAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: AccountUpdate }) =>
      apiPatch<Account>(`/api/accounts/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}

export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/accounts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["accounts"] }),
  });
}
