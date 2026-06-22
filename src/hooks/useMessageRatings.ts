import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { MessageRating } from "@/types/api";

export function useMessageRatings(enabled: boolean) {
  return useQuery({
    queryKey: ["chat-ratings"],
    queryFn: () => apiGet<MessageRating[]>("/api/chat/ratings"),
    enabled,
    staleTime: 30_000,
    refetchInterval: 120_000,
  });
}
