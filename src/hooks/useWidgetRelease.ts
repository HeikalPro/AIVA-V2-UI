import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiDelete, apiGet, apiUpload } from "@/lib/api-client";
import type { WidgetRelease } from "@/types/api";

export function useWidgetRelease(enabled = true) {
  return useQuery({
    queryKey: ["widget-release"],
    queryFn: () => apiGet<WidgetRelease | null>("/api/widget-release"),
    enabled,
  });
}

export function useUploadWidgetRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (form: FormData) => apiUpload<WidgetRelease>("/api/widget-release", form),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["widget-release"] }),
  });
}

export function useDeleteWidgetRelease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiDelete("/api/widget-release"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["widget-release"] }),
  });
}
