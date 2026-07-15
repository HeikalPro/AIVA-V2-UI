import { Cpu, Database, MessageSquare, Server, type LucideIcon } from "lucide-react";
import { useSystemComponents } from "@/hooks/useSystemHealth";
import type { ComponentHealth } from "@/types/api";

const ICONS: Record<string, LucideIcon> = {
  database: Database,
  llm: Cpu,
  redis: Server,
  chatbot: MessageSquare,
};

type Tone = "good" | "warn" | "critical" | "neutral";

function tone(status: string): Tone {
  switch (status) {
    case "up":
      return "good";
    case "degraded":
      return "warn";
    case "down":
      return "critical";
    default:
      return "neutral";
  }
}

const STATUS_TEXT: Record<Tone, string> = {
  good: "text-emerald-600",
  warn: "text-amber-600",
  critical: "text-red-600",
  neutral: "text-slate-500",
};
const DOT: Record<Tone, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  critical: "bg-red-500",
  neutral: "bg-slate-400",
};

function statusLabel(status: string): string {
  if (status === "up") return "OK";
  if (status === "not_configured") return "Not configured";
  return status.toUpperCase();
}

function ComponentCard({ c, when }: { c: ComponentHealth; when: string }) {
  const t = tone(c.status);
  const Icon = ICONS[c.key] ?? Server;
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Icon className="h-4 w-4" />
        </div>
        <span className={`h-2 w-2 rounded-full ${DOT[t]}`} title={c.status} />
      </div>
      <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{c.label}</p>
      <p className={`text-xl font-bold ${STATUS_TEXT[t]}`}>{statusLabel(c.status)}</p>
      {c.latency_ms != null ? <p className="text-xs text-muted-foreground">{c.latency_ms} ms</p> : null}
      {c.info ? (
        <p className="mt-1 max-w-full truncate text-xs text-muted-foreground" title={c.info}>
          {c.info}
        </p>
      ) : null}
      {c.detail ? (
        <p className="mt-1 max-w-full truncate text-xs text-red-500" title={c.detail}>
          {c.detail}
        </p>
      ) : null}
      <p className="mt-1 text-xs text-muted-foreground">{when}</p>
    </div>
  );
}

export function SystemComponentsSection() {
  const { data, isLoading } = useSystemComponents();

  if (isLoading && !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Checking components…
      </div>
    );
  }
  if (!data) return null;

  const when = new Date(data.generated_at).toLocaleTimeString();

  return (
    <section className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Components</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.components.map((c) => (
          <ComponentCard key={c.key} c={c} when={when} />
        ))}
      </div>
    </section>
  );
}
