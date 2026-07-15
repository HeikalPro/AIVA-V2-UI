import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type {
  AiMetrics,
  AiRequestList,
  AuditLogList,
  ErrorLogList,
  HttpRequestLogList,
  RagRetrievalList,
  SignInLogList,
} from "@/types/api";

// Poll the live AI logs while their tab is open so new rows appear without a manual reload.
const LIVE_LOG_REFETCH_MS = 10_000;

type ActivityParams = {
  limit?: number;
  offset?: number;
  action_type?: string;
  entity_type?: string;
  account_id?: number | null;
};

export function useActivityLogs(params: ActivityParams = {}, enabled = true) {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 100));
  search.set("offset", String(params.offset ?? 0));
  if (params.action_type) search.set("action_type", params.action_type);
  if (params.entity_type) search.set("entity_type", params.entity_type);
  if (params.account_id != null) search.set("account_id", String(params.account_id));

  return useQuery({
    queryKey: ["logs", "activity", params],
    queryFn: () => apiGet<AuditLogList>(`/api/logs/activity?${search.toString()}`),
    enabled,
  });
}

type SignInParams = {
  limit?: number;
  offset?: number;
  event_type?: string;
};

export function useSignInLogs(params: SignInParams = {}, enabled = true) {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 100));
  search.set("offset", String(params.offset ?? 0));
  if (params.event_type) search.set("event_type", params.event_type);

  return useQuery({
    queryKey: ["logs", "sign-in", params],
    queryFn: () => apiGet<SignInLogList>(`/api/logs/sign-in?${search.toString()}`),
    enabled,
  });
}

type ApiLogParams = {
  limit?: number;
  offset?: number;
  method?: string;
};

export function useApiLogs(params: ApiLogParams = {}, enabled = true) {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 100));
  search.set("offset", String(params.offset ?? 0));
  if (params.method) search.set("method", params.method);

  return useQuery({
    queryKey: ["logs", "api", params],
    queryFn: () => apiGet<HttpRequestLogList>(`/api/http-logs?${search.toString()}`),
    enabled,
  });
}

type RagLogParams = {
  limit?: number;
  offset?: number;
  account_id?: number | null;
  status?: string;
};

export function useRagLogs(params: RagLogParams = {}, enabled = true) {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 100));
  search.set("offset", String(params.offset ?? 0));
  if (params.account_id != null) search.set("account_id", String(params.account_id));
  if (params.status) search.set("status", params.status);

  return useQuery({
    queryKey: ["logs", "rag", params],
    queryFn: () => apiGet<RagRetrievalList>(`/api/logs/rag?${search.toString()}`),
    enabled,
    refetchInterval: enabled ? LIVE_LOG_REFETCH_MS : false,
  });
}

type ErrorEventParams = {
  limit?: number;
  offset?: number;
  exception_type?: string;
  start?: string;
  end?: string;
};

export function useErrorEvents(params: ErrorEventParams = {}, enabled = true) {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 200));
  search.set("offset", String(params.offset ?? 0));
  if (params.exception_type) search.set("exception_type", params.exception_type);
  if (params.start) search.set("start", params.start);
  if (params.end) search.set("end", params.end);

  return useQuery({
    queryKey: ["logs", "errors", params],
    queryFn: () => apiGet<ErrorLogList>(`/api/logs/errors?${search.toString()}`),
    enabled,
    refetchInterval: enabled ? LIVE_LOG_REFETCH_MS : false,
  });
}

type AiMetricsParams = {
  account_id?: number | null;
  status?: string;
  start?: string;
  end?: string;
};

export function useAiMetrics(params: AiMetricsParams = {}, enabled = true) {
  const search = new URLSearchParams();
  if (params.account_id != null) search.set("account_id", String(params.account_id));
  if (params.status) search.set("status", params.status);
  if (params.start) search.set("start", params.start);
  if (params.end) search.set("end", params.end);

  return useQuery({
    queryKey: ["logs", "ai-metrics", params],
    queryFn: () => apiGet<AiMetrics>(`/api/logs/ai-metrics?${search.toString()}`),
    enabled,
    refetchInterval: enabled ? LIVE_LOG_REFETCH_MS : false,
  });
}

type AiRequestLogParams = {
  limit?: number;
  offset?: number;
  account_id?: number | null;
  status?: string;
};

export function useAiRequestLogs(params: AiRequestLogParams = {}, enabled = true) {
  const search = new URLSearchParams();
  search.set("limit", String(params.limit ?? 100));
  search.set("offset", String(params.offset ?? 0));
  if (params.account_id != null) search.set("account_id", String(params.account_id));
  if (params.status) search.set("status", params.status);

  return useQuery({
    queryKey: ["logs", "ai-requests", params],
    queryFn: () => apiGet<AiRequestList>(`/api/logs/ai-requests?${search.toString()}`),
    enabled,
    refetchInterval: enabled ? LIVE_LOG_REFETCH_MS : false,
  });
}
