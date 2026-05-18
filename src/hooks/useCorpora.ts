import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { CorpusSummary } from "@/types/api";

export function useCorpora(enabled = true) {
  return useQuery({
    queryKey: ["corpora"],
    queryFn: () => apiGet<CorpusSummary[]>("/api/corpora"),
    enabled,
    staleTime: 60_000,
  });
}
