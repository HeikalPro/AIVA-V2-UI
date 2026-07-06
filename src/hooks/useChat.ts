import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiGet, apiPost, apiStream, type ChatStreamEvent } from "@/lib/api-client";
import type { ChatMessage, ChatSession } from "@/types/api";

export function useChatSessions(accountId: number | null) {
  return useQuery({
    queryKey: ["chat-sessions", accountId],
    queryFn: () => apiGet<ChatSession[]>(`/api/chat/sessions?account_id=${accountId}`),
    enabled: accountId != null,
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      accountId,
      activeQueues,
    }: {
      accountId: number;
      activeQueues?: string[];
    }) =>
      apiPost<ChatSession>("/api/chat/sessions", {
        account_id: accountId,
        active_queues: activeQueues?.length ? activeQueues : undefined,
      }),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["chat-sessions", vars.accountId] });
    },
  });
}

export function useSessionMessages(sessionId: number | null) {
  return useQuery({
    queryKey: ["chat-messages", sessionId],
    queryFn: () => apiGet<ChatMessage[]>(`/api/chat/sessions/${sessionId}`),
    enabled: sessionId != null,
  });
}

export async function sendMessageStream(
  sessionId: number,
  messageText: string,
  topK = 10,
  onEvent: (event: ChatStreamEvent) => void,
) {
  await apiStream(`/api/chat/sessions/${sessionId}/messages`, { message_text: messageText, top_k: topK }, onEvent);
}
