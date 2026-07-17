import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api-client";
import type { WidgetRelease } from "@/types/api";

export function useWidgetRelease(enabled = true) {
  return useQuery({
    queryKey: ["widget-release"],
    queryFn: () => apiGet<WidgetRelease | null>("/api/widget-release"),
    enabled,
  });
}
