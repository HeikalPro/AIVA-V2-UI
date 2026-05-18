import { useMutation, useQuery } from "@tanstack/react-query";
import { apiGet, apiPost, apiStream } from "@/lib/api-client";
import type { ChatMessage, ChatSession } from "@/types/api";

export function useCreateSession() {
  return useMutation({
    mutationFn: (accountId: number) =>
      apiPost<ChatSession>("/api/chat/sessions", { account_id: accountId }),
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
  onEvent: (event: { type: string; text?: string; latency_ms?: number }) => void,
) {
  await apiStream(`/api/chat/sessions/${sessionId}/messages`, { message_text: messageText, top_k: topK }, onEvent);
}
