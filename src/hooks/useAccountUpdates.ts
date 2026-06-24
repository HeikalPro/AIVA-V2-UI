import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { AccountAnnouncement, AccountAnnouncementCreate, AccountAnnouncementUpdate } from "@/types/api";

export type AccountUpdateFilters = {
  organization_id?: number;
  account_id?: number;
  active_only?: boolean;
};

export function useAccountUpdates(filters: AccountUpdateFilters = {}) {
  const params = new URLSearchParams();
  if (filters.organization_id) params.set("organization_id", String(filters.organization_id));
  if (filters.account_id) params.set("account_id", String(filters.account_id));
  if (filters.active_only === true) params.set("active_only", "true");
  if (filters.active_only === false) params.set("active_only", "false");
  const qs = params.toString();
  return useQuery({
    queryKey: ["account-updates", filters],
    queryFn: () => apiGet<AccountAnnouncement[]>(`/api/account-updates${qs ? `?${qs}` : ""}`),
  });
}

function invalidateAccountUpdatesQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["account-updates"] });
}

export function useCreateAccountUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: AccountAnnouncementCreate) => apiPost<AccountAnnouncement>("/api/account-updates", body),
    onSuccess: () => invalidateAccountUpdatesQueries(qc),
  });
}

export function useUpdateAccountUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: AccountAnnouncementUpdate }) =>
      apiPatch<AccountAnnouncement>(`/api/account-updates/${id}`, body),
    onSuccess: () => invalidateAccountUpdatesQueries(qc),
  });
}

export function useDeleteAccountUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/account-updates/${id}`),
    onSuccess: () => invalidateAccountUpdatesQueries(qc),
  });
}
