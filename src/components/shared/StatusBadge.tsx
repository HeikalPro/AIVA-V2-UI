import { Badge } from "@/components/ui/badge";

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "").toUpperCase();
  if (s === "ACTIVE" || s === "COMPLETED" || s === "RESOLVED" || s === "CLOSED") {
    return <Badge variant="success">{status}</Badge>;
  }
  if (s === "INACTIVE" || s === "CANCELLED" || s === "FAILED") {
    return <Badge variant="destructive">{status}</Badge>;
  }
  if (s === "PENDING" || s === "IN_PROGRESS" || s === "OPEN") {
    return <Badge variant="warning">{status}</Badge>;
  }
  return <Badge variant="muted">{status ?? "—"}</Badge>;
}
