import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { AiRequestList, AuditLogList, HttpRequestLogList, RagRetrievalList, SignInLogList } from "@/types/api";

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
  });
}
