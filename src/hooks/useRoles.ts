import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDownload, apiGet, apiPut } from "@/lib/api-client";
import type { NavPermissionCatalogItem, RoleDefinition, RoleNavPermissionsUpdate } from "@/types/api";

export function useRoles(enabled = true) {
  return useQuery({
    queryKey: ["roles"],
    queryFn: () => apiGet<RoleDefinition[]>("/api/roles"),
    enabled,
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
    mutationFn: ({ roleId, body }: { roleId: number; body: RoleNavPermissionsUpdate }) =>
      apiPut<RoleDefinition>(`/api/roles/${roleId}/nav-permissions`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles"] });
    },
  });
}

export function useDownloadRoleReportPdf() {
  return useMutation({
    mutationFn: async (organizationId?: number | null) => {
      const query = organizationId != null ? `?organization_id=${organizationId}` : "";
      const stamp = new Date().toISOString().slice(0, 10);
      await apiDownload(`/api/roles/reports/pdf${query}`, `gochat247-role-report-${stamp}.pdf`);
    },
  });
}
