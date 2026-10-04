import type { ReactNode } from "react";
import { Activity, Cpu, Gauge, HardDrive, Info, MemoryStick, Network, type LucideIcon } from "lucide-react";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useSystemResources } from "@/hooks/useSystemHealth";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AutoRefreshIndicator } from "./AutoRefreshIndicator";
import type { SystemResources } from "@/types/api";

/** Display only: mirrors HEALTH_REFETCH_MS in hooks/useSystemHealth. */
const RESOURCES_REFRESH_MS = 5_000;

/* ---------- formatting ---------- */

function pct(v: number | null | undefined): string {
  return v == null ? "—" : `${v.toFixed(1)}%`;
}
function gbFromMb(mb: number | null | undefined): string {
  return mb == null ? "—" : `${(mb / 1024).toFixed(2)} GB`;
}
function gb(v: number | null | undefined): string {
  return v == null ? "—" : `${v.toFixed(2)} GB`;
}
function rate(mbps: number | null | undefined): string {
  return mbps == null ? "—" : `${mbps.toFixed(2)} MB/s`;
}
function fmtUptime(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

/** Calm by default; amber from 75 %, red from 90 %. */
function usageTone(percent: number | null | undefined): "primary" | "warning" | "danger" {
  if (percent == null) return "primary";
  if (percent >= 90) return "danger";
  if (percent >= 75) return "warning";
  return "primary";
}

/* ---------- pieces ---------- */

function UsageCard({
  icon: Icon,
  label,
  value,
  percent,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  percent?: number | null;
  hint?: string;
}) {
  return (
    <Card className="min-w-0 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-subtle-foreground" />
      </div>
      <p className="mt-1 truncate text-lg font-semibold leading-7 tabular-nums text-foreground">{value}</p>
      {percent !== undefined && <Progress value={percent ?? null} tone={usageTone(percent)} size="sm" label={`${label} usage`} className="mt-1.5" />}
      {hint && <p className="mt-1.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

function Panel({ icon: Icon, title, subtitle, right, children }: { icon: LucideIcon; title: string; subtitle?: string; right?: ReactNode; children: ReactNode }) {
  return (
    <Card className="min-w-0 p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
            {title}
          </h3>
          {subtitle ? <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </Card>
  );
}

function MetricList({ rows }: { rows: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="divide-y divide-border">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-3 py-1.5 text-ui">
          <dt className="text-muted-foreground">{r.label}</dt>
          <dd className="min-w-0 truncate text-right font-medium tabular-nums text-foreground">{r.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function UsageBlock({ label, percent, items }: { label: string; percent: number | null | undefined; items: { label: string; value: string }[] }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-ui font-medium text-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-muted-foreground">{pct(percent)}</span>
      </div>
      <Progress value={percent ?? null} tone={usageTone(percent)} label={`${label} usage`} />
      <div className="grid grid-cols-3 gap-2 text-center">
        {items.map((it) => (
          <div key={it.label}>
            <p className="text-ui font-semibold tabular-nums text-foreground">{it.value}</p>
            <p className="text-xs text-muted-foreground">{it.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- section ---------- */

/** Host resources of the backend server (CPU, memory, disk, I/O, network), refreshed every 5 s. */
export function SystemResourcesSection() {
  const { data, isLoading, isFetching } = useSystemResources();

  const heading = (subtitle?: string) => (
    <div className="flex flex-wrap items-end justify-between gap-2">
      <div>
        <h2 className="text-base font-semibold text-foreground">Resources</h2>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      <AutoRefreshIndicator intervalMs={RESOURCES_REFRESH_MS} fetching={isFetching} />
    </div>
  );

  if (isLoading && !data) {
    return (
      <section className="space-y-3" aria-busy="true">
        {heading()}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[92px]" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      </section>
    );
  }
  if (!data) return null;

  const r: SystemResources = data;
  const { platform, cpu, memory, swap, disk, disk_io: io, network: net, process: proc } = r;

  return (
    <section className="space-y-3">
      {heading(`${platform.app_name} · ${platform.os ?? "—"} · Python ${platform.python_version ?? "—"}`)}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <UsageCard
          icon={Cpu}
          label="CPU"
          value={pct(cpu.percent)}
          percent={cpu.percent}
          hint={cpu.cores != null ? `${cpu.cores} cores${cpu.freq_mhz ? ` @ ${formatNumber(cpu.freq_mhz)} MHz` : ""}` : undefined}
        />
        <UsageCard
          icon={MemoryStick}
          label="Memory"
          value={`${gbFromMb(memory.used_mb)} / ${gbFromMb(memory.total_mb)}`.replace(/ GB \//, " /")}
          percent={memory.percent}
          hint={memory.percent != null ? `${pct(memory.percent)} used` : undefined}
        />
        <UsageCard
          icon={HardDrive}
          label="Disk"
          value={`${gb(disk.used_gb)} / ${gb(disk.total_gb)}`.replace(/ GB \//, " /")}
          percent={disk.percent}
          hint={disk.percent != null ? `${pct(disk.percent)} used` : undefined}
        />
        <UsageCard
          icon={Activity}
          label="Backend process"
          value={proc.memory_mb != null ? `${formatNumber(proc.memory_mb)} MB` : "—"}
          hint={proc.pid != null ? `PID ${proc.pid} · ${proc.num_threads ?? "?"} threads · ${pct(proc.cpu_percent)} CPU` : undefined}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel icon={Cpu} title="CPU" subtitle="Overall load and per core" right={<span className="text-sm font-semibold tabular-nums">{pct(cpu.percent)}</span>}>
          <Progress value={cpu.percent ?? null} tone={usageTone(cpu.percent)} label="CPU usage" />
          {cpu.per_core.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 lg:grid-cols-2 2xl:grid-cols-4">
              {cpu.per_core.map((c, i) => (
                <div key={i} className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Core {i}</span>
                    <span className="tabular-nums">{pct(c)}</span>
                  </div>
                  <Progress value={c} tone={usageTone(c)} size="sm" label={`Core ${i} usage`} />
                </div>
              ))}
            </div>
          )}
          <div className="mt-3 border-t border-border pt-2">
            <MetricList
              rows={[
                { label: "User time", value: pct(cpu.times.user) },
                { label: "System time", value: pct(cpu.times.system) },
                { label: "Idle", value: pct(cpu.times.idle) },
                { label: "I/O wait", value: pct(cpu.times.iowait) },
              ]}
            />
          </div>
          {cpu.load_avg ? (
            <p className="mt-2 text-xs text-muted-foreground">Load average: {cpu.load_avg.map((x) => x.toFixed(2)).join(" / ")}</p>
          ) : null}
        </Panel>

        <Panel icon={HardDrive} title="Memory and disk" subtitle="RAM and primary volume">
          <div className="space-y-5">
            <UsageBlock
              label="Memory"
              percent={memory.percent}
              items={[
                { label: "Used", value: gbFromMb(memory.used_mb) },
                { label: "Available", value: gbFromMb(memory.available_mb) },
                { label: "Total", value: gbFromMb(memory.total_mb) },
              ]}
            />
            <UsageBlock
              label="Disk"
              percent={disk.percent}
              items={[
                { label: "Used", value: gb(disk.used_gb) },
                { label: "Free", value: gb(disk.free_gb) },
                { label: "Total", value: gb(disk.total_gb) },
              ]}
            />
          </div>
        </Panel>

        <Panel icon={MemoryStick} title="Advanced memory" subtitle="Cache, buffers and swap">
          <MetricList
            rows={[
              { label: "Available RAM", value: gbFromMb(memory.available_mb) },
              { label: "Cached", value: memory.cached_mb != null ? gbFromMb(memory.cached_mb) : "—" },
              { label: "Buffers", value: memory.buffers_mb != null ? gbFromMb(memory.buffers_mb) : "—" },
              { label: "Swap", value: swap ? `${gbFromMb(swap.used_mb)} / ${gbFromMb(swap.total_mb)} (${pct(swap.percent)})` : "None" },
            ]}
          />
          {swap && <Progress value={swap.percent ?? null} tone={usageTone(swap.percent)} size="sm" label="Swap usage" className="mt-2" />}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel icon={Gauge} title="Disk I/O" subtitle="Instantaneous read and write rates">
          <MetricList
            rows={[
              { label: "Read speed", value: rate(io.read_mbps) },
              { label: "Write speed", value: rate(io.write_mbps) },
              { label: "Read IOPS", value: io.read_iops != null ? `${formatNumber(io.read_iops)}/s` : "—" },
              { label: "Write IOPS", value: io.write_iops != null ? `${formatNumber(io.write_iops)}/s` : "—" },
            ]}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Cumulative: {formatNumber(io.read_total)} read · {formatNumber(io.write_total)} write (bytes)
          </p>
        </Panel>

        <Panel icon={Network} title="Network" subtitle="Totals since boot and current rates">
          <MetricList
            rows={[
              { label: "Sent (total)", value: gb(net.sent_total_gb) },
              { label: "Received (total)", value: gb(net.recv_total_gb) },
              { label: "Packets sent / received", value: `${formatNumber(net.packets_sent)} / ${formatNumber(net.packets_recv)}` },
              { label: "Errors in / out", value: `${formatNumber(net.errin)} / ${formatNumber(net.errout)}` },
              { label: "Drops in / out", value: `${formatNumber(net.dropin)} / ${formatNumber(net.dropout)}` },
              { label: "Upload rate", value: rate(net.sent_mbps) },
              { label: "Download rate", value: rate(net.recv_mbps) },
            ]}
          />
        </Panel>

        <Panel icon={Info} title="System info" subtitle="Host and OS">
          <MetricList
            rows={[
              { label: "Hostname", value: <span className="font-mono text-xs">{platform.hostname ?? "—"}</span> },
              {
                label: "OS",
                value: <span title={platform.os_detail ?? ""}>{platform.os_detail ?? platform.os ?? "—"}</span>,
              },
              { label: "Uptime", value: fmtUptime(r.uptime_seconds) },
              { label: "Booted", value: r.boot_time ? formatDateTime(r.boot_time) : "—" },
            ]}
          />
        </Panel>
      </div>
    </section>
  );
}
