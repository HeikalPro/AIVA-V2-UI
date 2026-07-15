import type { ReactNode } from "react";
import { Cpu, HardDrive, MemoryStick, Network, Activity, Gauge, Info, Database } from "lucide-react";
import { useSystemResources } from "@/hooks/useSystemHealth";
import type { SystemResources } from "@/types/api";

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
function count(v: number | null | undefined): string {
  return v == null ? "—" : v.toLocaleString();
}
function fmtUptime(seconds: number | null | undefined): string {
  if (seconds == null) return "—";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

type Tone = "good" | "warn" | "critical";
function usageTone(percent: number | null | undefined): Tone {
  if (percent == null) return "good";
  if (percent >= 90) return "critical";
  if (percent >= 75) return "warn";
  return "good";
}
const BAR_TONE: Record<Tone, string> = {
  good: "bg-emerald-500",
  warn: "bg-amber-500",
  critical: "bg-red-500",
};

/* ---------- primitives ---------- */

function Bar({ percent }: { percent: number | null | undefined }) {
  const p = percent ?? 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200/70">
      <div className={`h-full rounded-full ${BAR_TONE[usageTone(percent)]}`} style={{ width: `${Math.min(100, Math.max(1, p))}%` }} />
    </div>
  );
}

function Card({ title, subtitle, icon, right, children }: { title: string; subtitle?: string; icon?: ReactNode; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {icon}
            {title}
          </div>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}

function KpiCard({ icon, label, value, sub }: { icon: ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-5 py-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

function TriColumn({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 text-center">
      {items.map((it) => (
        <div key={it.label}>
          <p className="text-sm font-semibold tabular-nums text-foreground">{it.value}</p>
          <p className="text-xs text-muted-foreground">{it.label}</p>
        </div>
      ))}
    </div>
  );
}

/* ---------- section ---------- */

export function SystemResourcesSection() {
  const { data, isLoading } = useSystemResources();

  if (isLoading && !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
        Loading system resources…
      </div>
    );
  }
  if (!data) return null;

  const r: SystemResources = data;
  const { platform, cpu, memory, swap, disk, disk_io: io, network: net, process: proc } = r;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">System Resources</h2>
          <p className="text-xs text-muted-foreground">
            {platform.app_name} · {platform.os ?? "—"} · Python {platform.python_version ?? "—"}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-700">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-sky-500" />
          Live metrics — updates every 5s
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={<Cpu className="h-3.5 w-3.5" />}
          label="CPU Usage"
          value={pct(cpu.percent)}
          sub={cpu.cores != null ? `${cpu.cores} cores${cpu.freq_mhz ? ` @ ${cpu.freq_mhz} MHz` : ""}` : undefined}
        />
        <KpiCard
          icon={<MemoryStick className="h-3.5 w-3.5" />}
          label="Memory"
          value={`${gbFromMb(memory.used_mb)} / ${gbFromMb(memory.total_mb)}`.replace(/ GB \//, " /")}
          sub={memory.percent != null ? `${memory.percent}% used` : undefined}
        />
        <KpiCard
          icon={<HardDrive className="h-3.5 w-3.5" />}
          label="Disk"
          value={`${gb(disk.used_gb)} / ${gb(disk.total_gb)}`.replace(/ GB \//, " /")}
          sub={disk.percent != null ? `${disk.percent}% used` : undefined}
        />
        <KpiCard
          icon={<Activity className="h-3.5 w-3.5" />}
          label="Backend Process"
          value={proc.memory_mb != null ? `${proc.memory_mb} MB` : "—"}
          sub={proc.pid != null ? `PID ${proc.pid} · ${proc.num_threads ?? "?"} threads · ${pct(proc.cpu_percent)} CPU` : undefined}
        />
      </div>

      {/* Row: CPU · Memory & Disk · Advanced Memory */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card icon={<Cpu className="h-4 w-4 text-muted-foreground" />} title="CPU" subtitle="Overall load & per-core" right={<span className="text-sm font-semibold tabular-nums">{pct(cpu.percent)}</span>}>
          <Bar percent={cpu.percent} />
          <div className="mt-3 rounded-lg border border-slate-200 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">CPU time (system)</p>
            <StatRow label="User" value={pct(cpu.times.user)} />
            <StatRow label="System" value={pct(cpu.times.system)} />
            <StatRow label="Idle" value={pct(cpu.times.idle)} />
            <StatRow label="I/O wait" value={pct(cpu.times.iowait)} />
          </div>
          {cpu.per_core.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
              {cpu.per_core.map((c, i) => (
                <div key={i}>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Core {i}</span>
                    <span className="tabular-nums">{pct(c)}</span>
                  </div>
                  <Bar percent={c} />
                </div>
              ))}
            </div>
          )}
          {cpu.load_avg ? (
            <p className="mt-3 text-xs text-muted-foreground">
              Load avg: {cpu.load_avg.map((x) => x.toFixed(2)).join(" / ")}
            </p>
          ) : null}
        </Card>

        <Card icon={<Database className="h-4 w-4 text-muted-foreground" />} title="Memory & Disk" subtitle="RAM and primary volume">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Memory</span>
              <span className="tabular-nums text-muted-foreground">{pct(memory.percent)}</span>
            </div>
            <Bar percent={memory.percent} />
            <TriColumn
              items={[
                { label: "Used", value: gbFromMb(memory.used_mb) },
                { label: "Avail.", value: gbFromMb(memory.available_mb) },
                { label: "Total", value: gbFromMb(memory.total_mb) },
              ]}
            />
          </div>
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Disk</span>
              <span className="tabular-nums text-muted-foreground">{pct(disk.percent)}</span>
            </div>
            <Bar percent={disk.percent} />
            <TriColumn
              items={[
                { label: "Used", value: gb(disk.used_gb) },
                { label: "Free", value: gb(disk.free_gb) },
                { label: "Total", value: gb(disk.total_gb) },
              ]}
            />
          </div>
        </Card>

        <Card icon={<MemoryStick className="h-4 w-4 text-muted-foreground" />} title="Advanced Memory" subtitle="Cache, buffers & swap">
          <StatRow label="Available RAM" value={gbFromMb(memory.available_mb)} />
          <StatRow label="Cached" value={memory.cached_mb != null ? gbFromMb(memory.cached_mb) : "—"} />
          <StatRow label="Buffers" value={memory.buffers_mb != null ? gbFromMb(memory.buffers_mb) : "—"} />
          <p className="mt-3 text-xs text-muted-foreground">
            {swap ? `Swap: ${gbFromMb(swap.used_mb)} / ${gbFromMb(swap.total_mb)} (${pct(swap.percent)})` : "No swap configured (or 0 GB)."}
          </p>
        </Card>
      </div>

      {/* Row: Disk I/O · Network · System info */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card icon={<Gauge className="h-4 w-4 text-muted-foreground" />} title="Disk I/O" subtitle="Instantaneous read/write rates">
          <StatRow label="Read speed" value={rate(io.read_mbps)} />
          <StatRow label="Write speed" value={rate(io.write_mbps)} />
          <StatRow label="Read IOPS" value={io.read_iops != null ? `${io.read_iops}/s` : "—"} />
          <StatRow label="Write IOPS" value={io.write_iops != null ? `${io.write_iops}/s` : "—"} />
          <p className="mt-3 text-xs text-muted-foreground">
            Cumulative: {count(io.read_total)} read · {count(io.write_total)} write (bytes)
          </p>
        </Card>

        <Card icon={<Network className="h-4 w-4 text-muted-foreground" />} title="Network" subtitle="Totals since boot · current rates">
          <StatRow label="Sent (total)" value={gb(net.sent_total_gb)} />
          <StatRow label="Received (total)" value={gb(net.recv_total_gb)} />
          <StatRow label="Packets sent" value={count(net.packets_sent)} />
          <StatRow label="Packets recv" value={count(net.packets_recv)} />
          <StatRow label="Errors in/out" value={`${count(net.errin)} / ${count(net.errout)}`} />
          <StatRow label="Drops in/out" value={`${count(net.dropin)} / ${count(net.dropout)}`} />
          <StatRow label="↑ Rate" value={rate(net.sent_mbps)} />
          <StatRow label="↓ Rate" value={rate(net.recv_mbps)} />
        </Card>

        <Card icon={<Info className="h-4 w-4 text-muted-foreground" />} title="System info" subtitle="Host & OS">
          <StatRow label="Hostname" value={platform.hostname ?? "—"} />
          <StatRow label="OS" value={<span className="max-w-[60%] truncate" title={platform.os_detail ?? ""}>{platform.os_detail ?? platform.os ?? "—"}</span>} />
          <StatRow label="Uptime" value={fmtUptime(r.uptime_seconds)} />
          <StatRow label="Booted" value={r.boot_time ? new Date(r.boot_time).toLocaleString() : "—"} />
        </Card>
      </div>
    </section>
  );
}
