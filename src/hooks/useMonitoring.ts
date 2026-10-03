import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost } from "@/lib/api-client";
import { retryUnlessUnavailable } from "@/lib/doc-intel";
import type { ActivityOut, FailuresOut, HealthEventOut, HealthOverviewOut } from "@/types/api";

const BASE = "/api/doc-intel/monitoring";

/** Reads stored results only; polling never triggers live checks. */
const MONITORING_REFETCH_MS = 30_000;

const monitoringKeys = {
  health: ["doc-intel", "monitoring", "health"] as const,
  events: (limit: number) => ["doc-intel", "monitoring", "events", limit] as const,
  failures: (days: number) => ["doc-intel", "monitoring", "failures", days] as const,
  activity: (limit: number) => ["doc-intel", "monitoring", "activity", limit] as const,
};

export function useDocIntelHealth(enabled = true) {
  return useQuery({
    queryKey: monitoringKeys.health,
    queryFn: () => apiGet<HealthOverviewOut>(`${BASE}/health`),
    enabled,
    refetchInterval: enabled ? MONITORING_REFETCH_MS : false,
    retry: retryUnlessUnavailable,
  });
}

/** Runs every check now (the server throttles to one run per ~30 s) and stores the result as the health data. */
export function useRunHealthChecks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<HealthOverviewOut>(`${BASE}/health/run`),
    onSuccess: async (data) => {
      // Drop any in-flight poll so an older stored result can't overwrite the fresh one.
      await qc.cancelQueries({ queryKey: monitoringKeys.health });
      qc.setQueryData(monitoringKeys.health, data);
      qc.invalidateQueries({ queryKey: ["doc-intel", "monitoring", "events"] });
      qc.invalidateQueries({ queryKey: ["doc-intel", "monitoring", "activity"] });
    },
  });
}

export function useHealthEvents(limit = 20, enabled = true) {
  return useQuery({
    queryKey: monitoringKeys.events(limit),
    queryFn: () => apiGet<HealthEventOut[]>(`${BASE}/events?limit=${limit}`),
    enabled,
    refetchInterval: enabled ? MONITORING_REFETCH_MS : false,
  });
}

export function useDocIntelFailures(days = 7, enabled = true) {
  return useQuery({
    queryKey: monitoringKeys.failures(days),
    queryFn: () => apiGet<FailuresOut>(`${BASE}/failures?days=${days}`),
    enabled,
    refetchInterval: enabled ? MONITORING_REFETCH_MS : false,
  });
}

export function useDocIntelActivity(limit = 100, enabled = true) {
  return useQuery({
    queryKey: monitoringKeys.activity(limit),
    queryFn: () => apiGet<ActivityOut>(`${BASE}/activity?limit=${limit}`),
    enabled,
    refetchInterval: enabled ? MONITORING_REFETCH_MS : false,
  });
}
