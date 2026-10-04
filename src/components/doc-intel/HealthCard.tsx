import { Cloud, Contact, Cpu, Database, RefreshCw, ScanText, Server, type LucideIcon } from "lucide-react";
import { Status, type StatusTone } from "@/components/data/status";
import type { HealthStatus } from "@/types/api";

/*
 * Document-intelligence health states on the shared <Status>:
 * healthy = green, failed = red, not configured = grey (never counted as a failure).
 */

const HEALTH: Record<HealthStatus, { label: string; tone: StatusTone }> = {
  HEALTHY: { label: "Healthy", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  NOT_CONFIGURED: { label: "Not configured", tone: "neutral" },
};

/** Icon per monitored component (falls back to a server icon). */
export const HEALTH_COMPONENT_ICONS: Record<string, LucideIcon> = {
  microsoft_graph: Cloud,
  crm: Contact,
  knowledge_sync: RefreshCw,
  extraction: ScanText,
  embedding: Cpu,
  database: Database,
};

export function healthComponentIcon(key: string): LucideIcon {
  return HEALTH_COMPONENT_ICONS[key] ?? Server;
}

export function healthStatusLabel(status: HealthStatus): string {
  return (HEALTH[status] ?? HEALTH.NOT_CONFIGURED).label;
}

export function healthStatusTone(status: HealthStatus): StatusTone {
  return (HEALTH[status] ?? HEALTH.NOT_CONFIGURED).tone;
}

/** Status dot + label for a health state. */
export function HealthStatusIndicator({
  status,
  className,
  variant,
}: {
  status: HealthStatus;
  className?: string;
  variant?: "dot" | "badge";
}) {
  const h = HEALTH[status] ?? HEALTH.NOT_CONFIGURED;
  return <Status tone={h.tone} label={h.label} variant={variant} className={className} />;
}
