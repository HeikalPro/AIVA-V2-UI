import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Activity, AlertCircle, Clock, Globe, Search, Timer, Users, X } from "lucide-react";
import { useApiLogs, useHttpLogStats } from "@/hooks/useLogs";
import { KPIStatCard } from "@/components/shared/KPIStatCard";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { filterRows } from "@/lib/table-filters";
import { formatUserError } from "@/lib/errors";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { HttpEndpointStat, HttpRequestLog, HttpUserStat } from "@/types/api";

/** Below this the table is too short to be useful, so we let the page scroll a little instead. */
const MIN_TABLE_HEIGHT = 240;
/** Row-count footer + the page container's bottom padding. */
const TABLE_CHROME = 64;

/**
 * Size the table to the space actually left in the app's scroll container, so the
 * page itself never scrolls no matter how the KPI cards above it wrap.
 * Measured relative to the container's content box, making it scroll-invariant.
 */
function useAvailableHeight<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T>(null);
  const [height, setHeight] = useState<number | null>(null);

  const measure = useCallback(() => {
    const el = ref.current;
    const container = el?.closest("main");
    if (!el || !container) return;
    const top = el.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    setHeight(Math.max(MIN_TABLE_HEIGHT, container.clientHeight - top - TABLE_CHROME));
  }, []);

  useLayoutEffect(measure, [measure, ...deps]);

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return { ref, maxHeight: height != null ? `${height}px` : undefined };
}

function fmtLatency(ms: number | null | undefined): string {
  if (ms == null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s`;
  return `${Math.round(ms)}ms`;
}

function fmtPct(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `${(rate * 100).toFixed(1)}%`;
}

function fmtWhen(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

const METHOD_TONES: Record<string, string> = {
  GET: "bg-sky-100 text-sky-700",
  POST: "bg-emerald-100 text-emerald-700",
  PUT: "bg-amber-100 text-amber-700",
  PATCH: "bg-amber-100 text-amber-700",
  DELETE: "bg-red-100 text-red-700",
};

function MethodBadge({ value }: { value: string | null | undefined }) {
  const v = (value ?? "?").toUpperCase();
  const tone = METHOD_TONES[v] ?? "bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{v}</span>;
}

function StatusCodeBadge({ value }: { value: number }) {
  const tone =
    value >= 500
      ? "bg-red-100 text-red-700"
      : value >= 400
        ? "bg-amber-100 text-amber-700"
        : "bg-emerald-100 text-emerald-700";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{value}</span>;
}

type ViewId = "endpoints" | "users" | "recent";

/** Only one table is mounted at a time — three stacked tables made the page unusably long. */
function ViewSwitcher({
  view,
  onChange,
  counts,
}: {
  view: ViewId;
  onChange: (v: ViewId) => void;
  counts: Record<ViewId, number | null>;
}) {
  const views: { id: ViewId; label: string }[] = [
    { id: "endpoints", label: "By endpoint" },
    { id: "users", label: "By user" },
    { id: "recent", label: "Recent requests" },
  ];
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-1">
      {views.map((v) => {
        const active = view === v.id;
        const count = counts[v.id];
        return (
          <button
            key={v.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(v.id)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {v.label}
            {count != null && (
              <span className={`ml-1.5 text-xs ${active ? "text-slate-500" : "text-slate-400"}`}>{count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ApiRequestsPanel({ onRowClick }: { onRowClick?: (row: HttpRequestLog) => void }) {
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [applied, setApplied] = useState<{ start?: string; end?: string }>({});
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [view, setView] = useState<ViewId>("endpoints");
  const { ref: tableAreaRef, maxHeight } = useAvailableHeight<HTMLDivElement>([view]);

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    error: statsLoadError,
  } = useHttpLogStats({ start: applied.start, end: applied.end });
  const summary = stats?.summary;

  // Only poll the raw log while its view is open.
  const { data: logsData, isLoading: logsLoading } = useApiLogs(
    { limit: 200, method: methodFilter === "ALL" ? undefined : methodFilter },
    view === "recent",
  );

  const logRows = useMemo(
    () =>
      filterRows(
        logsData?.items ?? [],
        search,
        (r) =>
          [
            r.http_method,
            r.path,
            r.route_template ?? "",
            r.handler_name ?? "",
            r.user_email ?? "",
            r.actor_label ?? "",
            String(r.status_code),
            r.client_ip ?? "",
          ].join(" "),
      ),
    [logsData, search],
  );

  const endpointColumns: Column<HttpEndpointStat>[] = [
    { key: "method", header: "Method", render: (r) => <MethodBadge value={r.http_method} /> },
    { key: "endpoint", header: "Endpoint", sortable: true, sortValue: (r) => r.endpoint, render: (r) => <span className="font-mono text-xs">{r.endpoint}</span> },
    { key: "count", header: "Requests", sortable: true, sortValue: (r) => r.count, render: (r) => r.count.toLocaleString() },
    { key: "users", header: "Unique users", sortable: true, sortValue: (r) => r.unique_users, render: (r) => r.unique_users.toLocaleString() },
    { key: "avg", header: "Avg latency", sortable: true, sortValue: (r) => r.avg_duration_ms ?? 0, render: (r) => fmtLatency(r.avg_duration_ms) },
    { key: "max", header: "Max latency", render: (r) => fmtLatency(r.max_duration_ms) },
    {
      key: "err",
      header: "Error rate",
      sortable: true,
      sortValue: (r) => r.error_rate ?? 0,
      render: (r) => (
        <span className={r.error_rate && r.error_rate > 0.05 ? "font-semibold text-red-600" : ""}>{fmtPct(r.error_rate)}</span>
      ),
    },
    { key: "last", header: "Last called", sortable: true, sortValue: (r) => r.last_called_at ?? "", render: (r) => fmtWhen(r.last_called_at) },
  ];

  const userColumns: Column<HttpUserStat>[] = [
    { key: "actor", header: "User", sortable: true, sortValue: (r) => r.actor, render: (r) => r.actor },
    { key: "count", header: "Requests", sortable: true, sortValue: (r) => r.count, render: (r) => r.count.toLocaleString() },
    { key: "endpoints", header: "Endpoints used", sortable: true, sortValue: (r) => r.unique_endpoints, render: (r) => r.unique_endpoints.toLocaleString() },
    {
      key: "errors",
      header: "Errors",
      sortable: true,
      sortValue: (r) => r.error_count,
      render: (r) => <span className={r.error_count > 0 ? "font-semibold text-red-600" : ""}>{r.error_count.toLocaleString()}</span>,
    },
    { key: "last", header: "Last seen", sortable: true, sortValue: (r) => r.last_seen_at ?? "", render: (r) => fmtWhen(r.last_seen_at) },
  ];

  const logColumns: Column<HttpRequestLog>[] = [
    { key: "when", header: "When", sortable: true, sortValue: (r) => r.created_at ?? "", render: (r) => fmtWhen(r.created_at) },
    { key: "method", header: "Method", render: (r) => <MethodBadge value={r.http_method} /> },
    { key: "path", header: "Path", render: (r) => <span className="font-mono text-xs">{r.path}</span> },
    { key: "status", header: "Status", sortable: true, sortValue: (r) => r.status_code, render: (r) => <StatusCodeBadge value={r.status_code} /> },
    { key: "ms", header: "Latency", sortable: true, sortValue: (r) => r.duration_ms, render: (r) => fmtLatency(r.duration_ms) },
    { key: "user", header: "User", render: (r) => r.user_email ?? r.actor_label ?? "anonymous" },
    { key: "ip", header: "IP", render: (r) => r.client_ip ?? "—" },
  ];

  return (
    <div className="space-y-4">
      <ErrorAlert message={statsError ? formatUserError(statsLoadError) : null} />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">API request monitor</h3>
          <p className="text-xs text-muted-foreground">
            What endpoints are being called, by whom, and how often. Filter by date to scope the window.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div className="w-40">
            <Label htmlFor="api-start">From</Label>
            <Input id="api-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1" />
          </div>
          <div className="w-40">
            <Label htmlFor="api-end">To</Label>
            <Input id="api-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1" />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mb-0.5"
            onClick={() => setApplied({ start: start || undefined, end: end || undefined })}
          >
            Apply
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <KPIStatCard label="Total requests" value={summary ? summary.total_requests.toLocaleString() : "—"} icon={<Activity className="h-4 w-4" />} />
        <KPIStatCard label="Unique users" value={summary ? summary.unique_users.toLocaleString() : "—"} icon={<Users className="h-4 w-4" />} />
        <KPIStatCard label="Endpoints hit" value={summary ? summary.unique_endpoints.toLocaleString() : "—"} icon={<Globe className="h-4 w-4" />} />
        <KPIStatCard label="Avg latency" value={fmtLatency(summary?.avg_duration_ms)} icon={<Clock className="h-4 w-4" />} />
        <KPIStatCard label="Max latency" value={fmtLatency(summary?.max_duration_ms)} icon={<Timer className="h-4 w-4" />} />
        <KPIStatCard
          label="Error rate"
          value={fmtPct(summary?.error_rate)}
          icon={<AlertCircle className="h-4 w-4" />}
          iconColor="bg-red-100 text-red-700"
        />
      </div>

      <ViewSwitcher
        view={view}
        onChange={setView}
        counts={{
          endpoints: stats?.by_endpoint.length ?? null,
          users: stats?.by_user.length ?? null,
          recent: null,
        }}
      />

      {view === "endpoints" && (
        <div ref={tableAreaRef}>
          <DataTable
            columns={endpointColumns}
            data={stats?.by_endpoint ?? []}
            keyFn={(r) => `${r.http_method} ${r.endpoint}`}
            loading={statsLoading}
            emptyMessage="No requests recorded in this range."
            maxHeight={maxHeight}
          />
        </div>
      )}

      {view === "users" && (
        <div ref={tableAreaRef}>
          <DataTable
            columns={userColumns}
            data={stats?.by_user ?? []}
            keyFn={(r) => r.actor}
            loading={statsLoading}
            emptyMessage="No requests recorded in this range."
            maxHeight={maxHeight}
          />
        </div>
      )}

      {view === "recent" && (
        <div className="space-y-2">
          {/* Slim inline controls — a full TableFilters card costs ~120px of table height here. */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search path, user, status…"
                className="pl-9"
                aria-label="Search requests"
              />
            </div>
            {/* Select's base class is w-full, so the width has to come from a wrapper. */}
            <div className="w-40">
              <Select
                value={methodFilter}
                onChange={(e) => setMethodFilter(e.target.value)}
                aria-label="Filter by method"
              >
                <option value="ALL">All methods</option>
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
                <option value="DELETE">DELETE</option>
              </Select>
            </div>
            {(search.trim() || methodFilter !== "ALL") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setMethodFilter("ALL");
                }}
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Clear
              </Button>
            )}
          </div>
          <div ref={tableAreaRef}>
            <DataTable
              columns={logColumns}
              data={logRows}
              keyFn={(r) => r.id}
              loading={logsLoading}
              emptyMessage="No API requests recorded yet."
              onRowClick={onRowClick}
              maxHeight={maxHeight}
            />
          </div>
        </div>
      )}
    </div>
  );
}
