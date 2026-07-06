import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPatch, apiPut } from "@/lib/api-client";
import type { AgentQueueAccess, AgentQueueSummary, ChatQueueAccess, ChatSession } from "@/types/api";

export function useChatQueueAccess(accountId: number | null) {
  return useQuery({
    queryKey: ["chat-queue-access", accountId],
    queryFn: () => apiGet<ChatQueueAccess>(`/api/chat/queue-access?account_id=${accountId}`),
    enabled: accountId != null,
  });
}

export function useUpdateSessionQueues() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, activeQueues }: { sessionId: number; activeQueues: string[] }) =>
      apiPatch<ChatSession>(`/api/chat/sessions/${sessionId}/queues`, {
        active_queues: activeQueues,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["chat-sessions"] });
      qc.invalidateQueries({ queryKey: ["chat-messages", vars.sessionId] });
    },
  });
}

export function useAgentsQueueSummary(accountId: number | null) {
  return useQuery({
    queryKey: ["agents-queue-summary", accountId],
    queryFn: () =>
      apiGet<AgentQueueSummary>(`/api/agents/queue-access/bulk?account_id=${accountId}`),
    enabled: accountId != null,
  });
}

export function useAgentQueueAccess(accountId: number | null, userId: number | null) {
  return useQuery({
    queryKey: ["agent-queue-access", accountId, userId],
    queryFn: () =>
      apiGet<AgentQueueAccess>(
        `/api/agents/${userId}/queue-access?account_id=${accountId}`,
      ),
    enabled: accountId != null && userId != null,
  });
}

export function useUpdateAgentQueueAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      userId,
      accountId,
      queueKeys,
    }: {
      userId: number;
      accountId: number;
      queueKeys: string[];
    }) =>
      apiPut<AgentQueueAccess>(
        `/api/agents/${userId}/queue-access?account_id=${accountId}`,
        { queue_keys: queueKeys },
      ),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({
        queryKey: ["agent-queue-access", vars.accountId, vars.userId],
      });
      qc.invalidateQueries({ queryKey: ["agents-queue-summary", vars.accountId] });
      qc.invalidateQueries({ queryKey: ["chat-queue-access", vars.accountId] });
    },
  });
}
