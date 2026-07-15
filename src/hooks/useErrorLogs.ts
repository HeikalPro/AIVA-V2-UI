import { useMemo } from "react";
import { useAiRequestLogs, useErrorEvents, useRagLogs } from "@/hooks/useLogs";
import type { AiRequest, ErrorLogRecord, RagRetrieval } from "@/types/api";

/**
 * Unified "Errors & Failures" stream.
 *
 * Three sources, merged and normalized:
 *  - Server exceptions from AIVA_error_logs (real exception type + full stack
 *    trace + HTTP status), captured by the request middleware.
 *  - FAILED AI requests (LLM-level failures logged as status=FAILED).
 *  - FAILED RAG retrievals.
 *
 * HTTP access logs are NOT a source here: unhandled 500s are already captured as
 * server exceptions (with tracebacks), so pulling them from the access log too
 * would double-count.
 */

export type ErrorSeverity = "info" | "warning" | "error" | "critical";
export type ErrorSource = "SERVER" | "WIDGET" | "AI" | "RAG";

export type ErrorLogEntry = {
  /** Composite id, unique across sources (e.g. "srv-123", "ai-45"). */
  id: string;
  source: ErrorSource;
  severity: ErrorSeverity;
  /** Grouping label for the by-type chart: exception class or a source label. */
  type: string;
  /** ISO timestamp, or null when the source row carries none. */
  when: string | null;
  /** Best available exception / failure message. */
  exception: string;
  /** Full traceback for server exceptions; null for AI/RAG failures. */
  stackTrace: string | null;
  conversationId: number | null;
  user: string | null;
  /** "METHOD /path" for server errors, else null. */
  endpoint: string | null;
  requestId: string | null;
  model: string | null;
  statusCode: number | null;
  retryStatus: string | null;
  account: string | null;
  /** Original row, shown verbatim in the detail dialog. */
  raw: ErrorLogRecord | AiRequest | RagRetrieval;
};

export const SEVERITY_RANK: Record<ErrorSeverity, number> = {
  info: 0,
  warning: 1,
  error: 2,
  critical: 3,
};

function mapServerError(r: ErrorLogRecord): ErrorLogEntry {
  const endpoint = r.path ? `${r.http_method ?? ""} ${r.route_template || r.path}`.trim() : null;
  return {
    id: `srv-${r.id}`,
    source: r.source === "WIDGET" ? "WIDGET" : "SERVER",
    severity: r.status_code != null && r.status_code >= 500 ? "critical" : "error",
    type: r.exception_type || "Error",
    when: r.created_at ?? null,
    exception: r.exception_message ?? r.exception_type,
    stackTrace: r.stack_trace ?? null,
    conversationId: null,
    user: r.user_email ?? null,
    endpoint,
    requestId: r.request_id ?? null,
    model: null,
    statusCode: r.status_code ?? null,
    retryStatus: null,
    account: null,
    raw: r,
  };
}

function mapAiRequest(r: AiRequest): ErrorLogEntry {
  return {
    id: `ai-${r.id}`,
    source: "AI",
    severity: "error",
    type: "LLM request",
    when: r.created_at ?? null,
    exception: r.error_message ?? r.summary ?? "AI request failed",
    stackTrace: null,
    conversationId: r.session_id ?? null,
    user: r.user_email ?? null,
    endpoint: null,
    requestId: null,
    model: r.model_name ?? null,
    statusCode: null,
    retryStatus: null,
    account: r.account_name ?? (r.account_id != null ? `#${r.account_id}` : null),
    raw: r,
  };
}

function mapRagRetrieval(r: RagRetrieval): ErrorLogEntry {
  return {
    id: `rag-${r.id}`,
    source: "RAG",
    severity: "error",
    type: "RAG retrieval",
    when: r.created_at ?? null,
    exception: r.error_message ?? r.summary ?? "RAG retrieval failed",
    stackTrace: null,
    conversationId: r.session_id ?? null,
    user: null,
    endpoint: null,
    requestId: null,
    model: null,
    statusCode: null,
    retryStatus: null,
    account: r.account_name ?? (r.account_id != null ? `#${r.account_id}` : null),
    raw: r,
  };
}

function recency(entry: ErrorLogEntry): number {
  return entry.when ? new Date(entry.when).getTime() : 0;
}

export function useErrorLogs(enabled = true) {
  const server = useErrorEvents({}, enabled);
  const ai = useAiRequestLogs({ status: "FAILED" }, enabled);
  const rag = useRagLogs({ status: "FAILED" }, enabled);

  const entries = useMemo<ErrorLogEntry[]>(() => {
    const merged: ErrorLogEntry[] = [
      ...(server.data?.items ?? []).map(mapServerError),
      ...(ai.data?.items ?? []).map(mapAiRequest),
      ...(rag.data?.items ?? []).map(mapRagRetrieval),
    ];
    merged.sort((a, b) => recency(b) - recency(a));
    return merged;
  }, [server.data, ai.data, rag.data]);

  // Counts by type across the merged set (drives the by-type bar chart).
  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.type, (counts.get(e.type) ?? 0) + 1);
    return [...counts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
  }, [entries]);

  return {
    entries,
    typeCounts,
    isLoading: server.isLoading || ai.isLoading || rag.isLoading,
    isError: server.isError || ai.isError || rag.isError,
    error: server.error ?? ai.error ?? rag.error,
    isFetching: server.isFetching || ai.isFetching || rag.isFetching,
    refetch: () => {
      void server.refetch();
      void ai.refetch();
      void rag.refetch();
    },
  };
}
