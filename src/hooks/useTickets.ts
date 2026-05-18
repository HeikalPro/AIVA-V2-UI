import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { Ticket, TicketCreate, TicketUpdate } from "@/types/api";

export type TicketFilters = {
  organization_id?: number;
  account_id?: number;
  status?: string;
};

export function useTickets(filters: TicketFilters = {}) {
  const params = new URLSearchParams();
  if (filters.organization_id) params.set("organization_id", String(filters.organization_id));
  if (filters.account_id) params.set("account_id", String(filters.account_id));
  if (filters.status) params.set("status", filters.status);
  const qs = params.toString();
  return useQuery({
    queryKey: ["tickets", filters],
    queryFn: () => apiGet<Ticket[]>(`/api/tickets${qs ? `?${qs}` : ""}`),
  });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TicketCreate) => apiPost<Ticket>("/api/tickets", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: TicketUpdate }) =>
      apiPatch<Ticket>(`/api/tickets/${id}`, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}

export function useDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/tickets/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tickets"] }),
  });
}
