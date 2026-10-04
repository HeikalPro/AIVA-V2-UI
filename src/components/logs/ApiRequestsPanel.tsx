import { useMemo, useState } from "react";
import { AlertCircle, Globe, RefreshCw } from "lucide-react";
import { useApiLogs, useHttpLogStats } from "@/hooks/useLogs";
import { filterRows } from "@/lib/table-filters";
import { formatUserError } from "@/lib/errors";
import { formatDurationMs, formatNumber, formatPercent } from "@/lib/format";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterBar, type DateRangeValue } from "@/components/data/filter-bar";
import { Stat, StatGroup } from "@/components/data/stat";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AutoRefreshIndicator } from "@/components/system/AutoRefreshIndicator";
import { RelativeTime } from "@/components/doc-intel/RelativeTime";
import { HttpMethodBadge, HttpStatusCode, LogTime } from "./log-cells";
import type { HttpEndpointStat, HttpRequestLog, HttpUserStat } from "@/types/api";

/** Display only: mirrors LIVE_LOG_REFETCH_MS in hooks/useLogs (stats and the raw log poll every 10 s). */
const API_LOGS_REFRESH_MS = 10_000;

type ViewId = "endpoints" | "users" | "recent";

export function ApiRequestsPanel({ onRowClick }: { onRowClick?: (row: HttpRequestLog) => void }) {
  const [range, setRange] = useState<DateRangeValue>({ from: "", to: "" });
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [view, setView] = useState<ViewId>("endpoints");

  const {
    data: stats,
    isLoading: statsLoading,
    isError: statsError,
    error: statsLoadError,
    isFetching: statsFetching,
    refetch: refetchStats,
  } = useHttpLogStats({ start: range.from || undefined, end: range.to || undefined });
  const summary = stats?.summary;

  // Only poll the raw log while its view is open.
  const {
    data: logsData,
    isLoading: logsLoading,
    isFetching: logsFetching,
    refetch: refetchLogs,
  } = useApiLogs({ limit: 200, method: methodFilter === "ALL" ? undefined : methodFilter }, view === "recent");

  const logRows = useMemo(
    () =>
      filterRows(logsData?.items ?? [], search, (r) =>
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
    { key: "http_method", header: "Method", render: (r) => <HttpMethodBadge value={r.http_method} /> },
    {
      key: "endpoint",
      header: "Endpoint",
      sortable: true,
      truncate: true,
      maxWidth: "26rem",
      cellTitle: (r) => r.endpoint,
      render: (r) => <span className="font-mono text-xs">{r.endpoint}</span>,
    },
    { key: "count", header: "Requests", numeric: true, sortable: true, render: (r) => formatNumber(r.count) },
    { key: "unique_users", header: "Users", numeric: true, sortable: true, render: (r) => formatNumber(r.unique_users) },
    { key: "avg_duration_ms", header: "Avg latency", numeric: true, sortable: true, render: (r) => formatDurationMs(r.avg_duration_ms) },
    { key: "max_duration_ms", header: "Max latency", numeric: true, sortable: true, render: (r) => formatDurationMs(r.max_duration_ms) },
    {
      key: "error_rate",
      header: "Error rate",
      numeric: true,
      sortable: true,
      render: (r) => (
        <span className={r.error_rate && r.error_rate > 0.05 ? "font-medium text-danger" : undefined}>{formatPercent(r.error_rate)}</span>
      ),
    },
    { key: "last_called_at", header: "Last called", sortable: true, render: (r) => <RelativeTime value={r.last_called_at} /> },
  ];

  const userColumns: Column<HttpUserStat>[] = [
    { key: "actor", header: "User", sortable: true, truncate: true, maxWidth: "22rem" },
    { key: "count", header: "Requests", numeric: true, sortable: true, render: (r) => formatNumber(r.count) },
    { key: "unique_endpoints", header: "Endpoints used", numeric: true, sortable: true, render: (r) => formatNumber(r.unique_endpoints) },
    {
      key: "error_count",
      header: "Errors",
      numeric: true,
      sortable: true,
      render: (r) => <span className={r.error_count > 0 ? "font-medium text-danger" : undefined}>{formatNumber(r.error_count)}</span>,
    },
    { key: "last_seen_at", header: "Last seen", sortable: true, render: (r) => <RelativeTime value={r.last_seen_at} /> },
  ];

  const logColumns: Column<HttpRequestLog>[] = [
    { key: "created_at", header: "Time", sortable: true, render: (r) => <LogTime value={r.created_at} /> },
    { key: "http_method", header: "Method", render: (r) => <HttpMethodBadge value={r.http_method} /> },
    {
      key: "path",
      header: "Path",
      truncate: true,
      maxWidth: "26rem",
      cellTitle: (r) => r.path,
      render: (r) => <span className="font-mono text-xs">{r.path}</span>,
    },
    { key: "status_code", header: "Status", sortable: true, render: (r) => <HttpStatusCode value={r.status_code} /> },
    { key: "duration_ms", header: "Latency", numeric: true, sortable: true, render: (r) => formatDurationMs(r.duration_ms) },
    {
      key: "user",
      header: "User",
      truncate: true,
      maxWidth: "16rem",
      render: (r) => r.user_email ?? r.actor_label ?? "anonymous",
    },
    { key: "client_ip", header: "IP", render: (r) => <span className="font-mono text-xs">{r.client_ip ?? "—"}</span> },
  ];

  const statsBusy = statsFetching || (view === "recent" && logsFetching);
  const refreshControls = (
    <div className="flex items-center gap-2">
      <AutoRefreshIndicator intervalMs={API_LOGS_REFRESH_MS} fetching={statsBusy} />
      <IconButton
        label="Refresh API requests"
        icon={RefreshCw}
        variant="outline"
        size="sm"
        disabled={statsBusy}
        className={statsBusy ? "[&_svg]:motion-safe:animate-spin" : undefined}
        onClick={() => {
          void refetchStats();
          if (view === "recent") void refetchLogs();
        }}
      />
    </div>
  );

  const viewSwitcher = (
    <Tabs variant="segmented" value={view} onValueChange={(v) => setView(v as ViewId)}>
      <TabsList aria-label="API request views">
        <TabsTrigger value="endpoints" count={stats ? formatNumber(stats.by_endpoint.length) : undefined}>
          By endpoint
        </TabsTrigger>
        <TabsTrigger value="users" count={stats ? formatNumber(stats.by_user.length) : undefined}>
          By user
        </TabsTrigger>
        <TabsTrigger value="recent">Recent requests</TabsTrigger>
      </TabsList>
    </Tabs>
  );

  const statsEmpty = statsError
    ? { icon: AlertCircle, title: "Couldn't load request stats", description: formatUserError(statsLoadError) }
    : { icon: Globe, title: "No requests recorded in this range" };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">API request monitor</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Which endpoints are called, by whom and how often.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterBar
            dateRange={{ ...range, onChange: setRange, presets: true, label: "Period" }}
            onClear={() => setRange({ from: "", to: "" })}
          />
          {refreshControls}
        </div>
      </div>

      <ErrorAlert message={statsError ? formatUserError(statsLoadError) : null} />

      <StatGroup columns={6} variant="strip" aria-label="API request summary">
        <Stat emphasis="secondary" label="Total requests" loading={statsLoading} value={formatNumber(summary?.total_requests)} />
        <Stat emphasis="secondary" label="Unique users" loading={statsLoading} value={formatNumber(summary?.unique_users)} />
        <Stat emphasis="secondary" label="Endpoints hit" loading={statsLoading} value={formatNumber(summary?.unique_endpoints)} />
        <Stat emphasis="secondary" label="Avg latency" loading={statsLoading} value={formatDurationMs(summary?.avg_duration_ms)} />
        <Stat emphasis="secondary" label="Max latency" loading={statsLoading} value={formatDurationMs(summary?.max_duration_ms)} />
        <Stat emphasis="secondary" label="Error rate" loading={statsLoading} value={formatPercent(summary?.error_rate)} />
      </StatGroup>

      {view === "endpoints" && (
        <DataTable<HttpEndpointStat>
          aria-label="Requests by endpoint"
          columns={endpointColumns}
          data={stats?.by_endpoint ?? []}
          keyFn={(r) => `${r.http_method} ${r.endpoint}`}
          loading={statsLoading}
          density="compact"
          itemLabel="endpoints"
          defaultSort={{ key: "count", dir: "desc" }}
          empty={statsEmpty}
          toolbar={viewSwitcher}
        />
      )}

      {view === "users" && (
        <DataTable<HttpUserStat>
          aria-label="Requests by user"
          columns={userColumns}
          data={stats?.by_user ?? []}
          keyFn={(r) => r.actor}
          loading={statsLoading}
          density="compact"
          itemLabel="users"
          defaultSort={{ key: "count", dir: "desc" }}
          empty={statsEmpty}
          toolbar={viewSwitcher}
        />
      )}

      {view === "recent" && (
        <DataTable<HttpRequestLog>
          aria-label="Recent API requests"
          columns={logColumns}
          data={logRows}
          keyFn={(r) => r.id}
          loading={logsLoading}
          density="compact"
          itemLabel="requests"
          onRowClick={onRowClick}
          empty={
            search.trim() || methodFilter !== "ALL"
              ? {
                  title: "No requests match these filters",
                  action: (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearch("");
                        setMethodFilter("ALL");
                      }}
                    >
                      Clear filters
                    </Button>
                  ),
                }
              : { icon: Globe, title: "No API requests recorded yet" }
          }
          toolbar={
            <div className="flex flex-wrap items-center gap-2">
              {viewSwitcher}
              <FilterBar
                className="min-w-0 flex-1"
                search={search}
                onSearchChange={setSearch}
                searchPlaceholder="Search path, user, status…"
                filters={[
                  {
                    id: "api-method",
                    label: "Method",
                    value: methodFilter,
                    onChange: setMethodFilter,
                    options: [
                      { value: "ALL", label: "All" },
                      { value: "GET", label: "GET" },
                      { value: "POST", label: "POST" },
                      { value: "PUT", label: "PUT" },
                      { value: "PATCH", label: "PATCH" },
                      { value: "DELETE", label: "DELETE" },
                    ],
                  },
                ]}
                onClear={() => {
                  setSearch("");
                  setMethodFilter("ALL");
                }}
                totalCount={search.trim() ? (logsData?.items.length ?? 0) : undefined}
                filteredCount={logRows.length}
                itemLabel="requests"
              />
            </div>
          }
        />
      )}
    </div>
  );
}
