import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { Ticket, TicketCreate, TicketCreateResponse, TicketUpdate } from "@/types/api";

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

/** Super admin only: open / in-progress tickets for nav badge */
export function useTicketOpenCount(enabled: boolean) {
  return useQuery({
    queryKey: ["tickets-open-count"],
    queryFn: () => apiGet<{ open_count: number }>("/api/tickets/open-count"),
    enabled,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}

function invalidateTicketsQueries(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ["tickets"] });
  qc.invalidateQueries({ queryKey: ["tickets-open-count"] });
}

export function useCreateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TicketCreate) => apiPost<TicketCreateResponse>("/api/tickets", body),
    onSuccess: () => invalidateTicketsQueries(qc),
  });
}

export function useUpdateTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: number; body: TicketUpdate }) =>
      apiPatch<Ticket>(`/api/tickets/${id}`, body),
    onSuccess: () => invalidateTicketsQueries(qc),
  });
}

export function useDeleteTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiDelete(`/api/tickets/${id}`),
    onSuccess: () => invalidateTicketsQueries(qc),
  });
}
