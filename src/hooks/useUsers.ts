import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api-client";
import type { AccountUserAssign, User, UserCreate, UserNavPermissionsUpdate, UserRoleAssign, UserUpdate } from "@/types/api";

export function useUsers(organizationId?: number | null) {
  const params = organizationId ? `?organization_id=${organizationId}` : "";
  return useQuery({
    queryKey: ["users", organizationId ?? "all"],
    queryFn: () => apiGet<User[]>(`/api/users${params}`),
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UserCreate) => apiPost<User>("/api/users", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: UserUpdate }) => apiPatch<User>(`/api/users/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useSetUserRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: number; body: UserRoleAssign }) =>
      apiPut<User>(`/api/users/${userId}/role`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/users/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useAssignRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: number; body: UserRoleAssign }) =>
      apiPost<User>(`/api/users/${userId}/roles`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });
}

export function useAssignAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: number; body: AccountUserAssign }) =>
      apiPost<User>(`/api/users/${userId}/accounts`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["account-users"] });
    },
  });
}

export function useUnassignAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, accountId }: { userId: number; accountId: number }) =>
      apiDelete<User>(`/api/users/${userId}/accounts/${accountId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["account-users"] });
    },
  });
}

export function useSetUserNavPermissions() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, body }: { userId: number; body: UserNavPermissionsUpdate }) =>
      apiPut<User>(`/api/users/${userId}/nav-permissions`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
    },
  });
}

export function useAccountUsers(accountId: number | null) {
  return useQuery({
    queryKey: ["account-users", accountId],
    queryFn: () => apiGet<User[]>(`/api/accounts/${accountId}/users`),
    enabled: accountId != null,
  });
}
