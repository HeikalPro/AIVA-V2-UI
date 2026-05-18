import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { Organization, OrganizationCreate, OrganizationUpdate } from "@/types/api";

export function useOrganizations(enabled = true) {
  return useQuery({
    queryKey: ["organizations"],
    queryFn: () => apiGet<Organization[]>("/api/organizations"),
    enabled,
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: OrganizationCreate) => apiPost<Organization>("/api/organizations", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["organizations"] }),
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: OrganizationUpdate }) =>
      apiPatch<Organization>(`/api/organizations/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["organizations"] }),
  });
}

export function useDeleteOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/organizations/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["organizations"] }),
  });
}
