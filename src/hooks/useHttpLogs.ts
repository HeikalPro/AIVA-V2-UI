import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { HttpRequestLogList } from "@/types/api";

type Params = {
  limit?: number;
  offset?: number;
  method?: string;
};

export function useHttpLogs(enabled: boolean, params: Params = {}) {
  const limit = params.limit ?? 100;
  const offset = params.offset ?? 0;
  const method = params.method?.trim().toUpperCase();

  const qs = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  if (method) qs.set("method", method);

  return useQuery({
    queryKey: ["http-logs", limit, offset, method ?? ""],
    queryFn: () => apiGet<HttpRequestLogList>(`/api/http-logs?${qs.toString()}`),
    enabled,
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}
