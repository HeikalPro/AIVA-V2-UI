import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDownload, apiGet, apiPost, apiPut } from "@/lib/api-client";
import type { NavPermissionCatalogItem, RoleDefinition, RoleNavPermissionsUpdate } from "@/types/api";

export function useRoles(accountId?: number | null, enabled = true) {
  const canFetch = enabled && accountId != null;
  return useQuery({
    queryKey: ["roles", accountId],
    queryFn: () => apiGet<RoleDefinition[]>(`/api/roles?account_id=${accountId}`),
    enabled: canFetch,
  });
}

export function useNavPermissionCatalog(enabled = true) {
  return useQuery({
    queryKey: ["roles", "nav-catalog"],
    queryFn: () => apiGet<NavPermissionCatalogItem[]>("/api/roles/nav-catalog"),
    enabled,
  });
}

export function useUpdateRoleNavPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      roleId,
      accountId,
      body,
    }: {
      roleId: number;
      accountId: number;
      body: RoleNavPermissionsUpdate;
    }) => apiPut<RoleDefinition>(`/api/roles/${roleId}/nav-permissions?account_id=${accountId}`, body),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["roles", variables.accountId] });
    },
  });
}

export function useResetRoleNavPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, accountId }: { roleId: number; accountId: number }) =>
      apiPost<RoleDefinition>(`/api/roles/${roleId}/nav-permissions/reset?account_id=${accountId}`),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["roles", variables.accountId] });
    },
  });
}

export function useDownloadRoleReportPdf() {
  return useMutation({
    mutationFn: async ({
      organizationId,
      accountId,
    }: {
      organizationId?: number | null;
      accountId?: number | null;
    } = {}) => {
      const params = new URLSearchParams();
      if (organizationId != null) params.set("organization_id", String(organizationId));
      if (accountId != null) params.set("account_id", String(accountId));
      const query = params.toString() ? `?${params.toString()}` : "";
      const stamp = new Date().toISOString().slice(0, 10);
      const suffix = accountId != null ? `-account-${accountId}` : "";
      await apiDownload(`/api/roles/reports/pdf${query}`, `gochat247-role-report${suffix}-${stamp}.pdf`);
    },
  });
}
