import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { SystemComponents, SystemHealth, SystemResources } from "@/types/api";

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

// Components hit external services (LLM /models, chatbot), so poll more gently.
const COMPONENTS_REFETCH_MS = 15_000;

export function useSystemComponents(enabled = true) {
  return useQuery({
    queryKey: ["system", "components"],
    queryFn: () => apiGet<SystemComponents>("/api/system/components"),
    enabled,
    refetchInterval: enabled ? COMPONENTS_REFETCH_MS : false,
  });
}
