import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPut } from "@/lib/api-client";
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
