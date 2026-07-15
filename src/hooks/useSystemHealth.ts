import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { SystemHealth, SystemResources } from "@/types/api";

// Ops snapshot refresh cadence — frequent enough to feel live without hammering.
const HEALTH_REFETCH_MS = 5_000;

export function useSystemHealth(windowMinutes = 5, enabled = true) {
  return useQuery({
    queryKey: ["system", "health", windowMinutes],
    queryFn: () => apiGet<SystemHealth>(`/api/system/health?window_minutes=${windowMinutes}`),
    enabled,
    refetchInterval: enabled ? HEALTH_REFETCH_MS : false,
  });
}

export function useSystemResources(enabled = true) {
  return useQuery({
    queryKey: ["system", "resources"],
    queryFn: () => apiGet<SystemResources>("/api/system/resources"),
    enabled,
    refetchInterval: enabled ? HEALTH_REFETCH_MS : false,
  });
}
