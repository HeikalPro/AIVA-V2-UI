import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { AgentMetric, AiTimeseriesPoint, DashboardStats } from "@/types/api";

export function useDashboardStats(accountId: number | null, enabled = true) {
  return useQuery({
    queryKey: ["analytics-dashboard", accountId],
    queryFn: () => apiGet<DashboardStats>(`/api/analytics/dashboard?account_id=${accountId}`),
    enabled: enabled && accountId != null,
  });
}

export function useAiTimeseries(accountId: number | null, days = 30, enabled = true) {
  return useQuery({
    queryKey: ["analytics-ai-timeseries", accountId, days],
    queryFn: () => apiGet<AiTimeseriesPoint[]>(`/api/analytics/ai-timeseries?account_id=${accountId}&days=${days}`),
    enabled: enabled && accountId != null,
  });
}

export function useAgentMetrics(accountId: number | null, enabled = true) {
  return useQuery({
    queryKey: ["analytics-agents", accountId],
    queryFn: () => apiGet<AgentMetric[]>(`/api/analytics/agents?account_id=${accountId}`),
    enabled: enabled && accountId != null,
  });
}
