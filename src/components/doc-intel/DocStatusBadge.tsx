import type { ComponentProps } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DOC_STATUS_LABELS } from "@/lib/doc-intel";
import type { DocStatus } from "@/types/api";

type BadgeVariant = NonNullable<ComponentProps<typeof Badge>["variant"]>;

/** Green = published, red = failed, amber = still in the pipeline, muted = unpublished. */
const VARIANT: Record<DocStatus, BadgeVariant> = {
  QUEUED: "warning",
  PROCESSING: "warning",
  PUBLISHED: "success",
  FAILED: "destructive",
  UNPUBLISHED: "muted",
};

export function DocStatusBadge({ status }: { status: DocStatus }) {
  return (
    <Badge variant={VARIANT[status] ?? "muted"} className="whitespace-nowrap">
      {status === "PROCESSING" && <Loader2 aria-hidden="true" className="mr-1 h-3 w-3 animate-spin" />}
      {DOC_STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
