import { useMemo, useState } from "react";
import { RefreshCw, ScrollText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES, canAccess } from "@/lib/roles";
import { useHttpLogs } from "@/hooks/useHttpLogs";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { TableFilters } from "@/components/shared/TableFilters";
import { filterRows } from "@/lib/table-filters";
import { Button } from "@/components/ui/button";
import type { HttpRequestLog } from "@/types/api";

function pathDisplay(row: HttpRequestLog): string {
  if (row.query_string) return `${row.path}?${row.query_string}`;
  return row.path;
}

function statusClass(code: number): string {
  if (code >= 500) return "text-rose-700 font-semibold";
  if (code >= 400) return "text-amber-700 font-semibold";
  return "text-emerald-700 font-semibold";
}

export function HttpLogsPage() {
  const { user } = useAuth();
  const allowed =
    user != null &&
    canAccess(user.roles, [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.DEVELOPER]);

  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState("ALL");
  const [offset, setOffset] = useState(0);
  const limit = 100;

  const { data, isLoading, isFetching, refetch } = useHttpLogs(allowed, {
    limit,
    offset,
    method: methodFilter === "ALL" ? undefined : methodFilter,
  });

  const rows = data?.items ?? [];

  const filtered = useMemo(
    () =>
      filterRows(
        rows,
        search,
        (r) =>
          [
            r.summary ?? "",
            r.handler_name ?? "",
            r.http_method,
            pathDisplay(r),
            r.user_email ?? "",
            r.user_roles ?? "",
            r.client_ip ?? "",
            String(r.status_code),
          ].join(" "),
      ),
    [rows, search],
  );

  const columns: Column<HttpRequestLog>[] = [
    {
      key: "created_at",
      header: "Time",
      sortable: true,
      sortValue: (r) => r.created_at ?? "",
      render: (r) => (r.created_at ? new Date(r.created_at).toLocaleString() : "—"),
    },
    {
      key: "http_method",
      header: "Method",
      sortable: true,
      render: (r) => (
        <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-semibold text-slate-800">
          {r.http_method}
        </span>
      ),
    },
    {
      key: "handler_name",
      header: "Handler",
      sortable: true,
      render: (r) => (
        <span className="font-mono text-xs text-[#004080]" title={r.route_template ?? undefined}>
          {r.handler_name ?? "—"}
        </span>
      ),
    },
    {
      key: "path",
      header: "Path",
      render: (r) => (
        <span className="font-mono text-xs text-slate-700" title={pathDisplay(r)}>
          {pathDisplay(r).length > 48 ? `${pathDisplay(r).slice(0, 47)}…` : pathDisplay(r)}
        </span>
      ),
    },
    {
      key: "user_email",
      header: "User",
      sortable: true,
      sortValue: (r) => r.user_email ?? r.actor_label ?? "",
      render: (r) => (
        <div className="min-w-[10rem]">
          <div className="text-sm text-slate-900">{r.user_email ?? r.actor_label ?? "—"}</div>
          {r.user_roles && <div className="text-xs text-slate-500">{r.user_roles}</div>}
        </div>
      ),
    },
    {
      key: "client_ip",
      header: "IP",
      render: (r) => <span className="font-mono text-xs text-slate-600">{r.client_ip ?? "—"}</span>,
    },
    {
      key: "status_code",
      header: "Status",
      sortable: true,
      render: (r) => <span className={statusClass(r.status_code)}>{r.status_code}</span>,
    },
    {
      key: "duration_ms",
      header: "Ms",
      sortable: true,
      render: (r) => <span className="tabular-nums text-slate-700">{r.duration_ms}</span>,
    },
  ];

  if (!allowed) {
    return (
      <div className="p-6">
        <PageHeader
          icon={ScrollText}
          title="API activity"
          description="Admin and developer access only."
        />
        <p className="text-sm text-slate-600">You do not have permission to view API logs.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      <PageHeader
        icon={ScrollText}
        title="API activity"
        description="Human-readable handler logs: who called what, status, and duration."
        actions={
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search handler, path, user, IP…"
        filters={[
          {
            id: "http-method-filter",
            label: "Method",
            value: methodFilter,
            onChange: (v) => {
              setMethodFilter(v);
              setOffset(0);
            },
            options: [
              { value: "ALL", label: "All methods" },
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
          setOffset(0);
        }}
        totalCount={rows.length}
        filteredCount={filtered.length}
      />

      <DataTable<HttpRequestLog>
        columns={columns}
        data={filtered}
        keyFn={(r) => r.id}
        loading={isLoading}
        emptyMessage="No API activity logged yet. Use the app and refresh."
      />

      <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
        <span>
          Showing {rows.length} entries (offset {offset})
        </span>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0 || isLoading}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            Newer
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={rows.length < limit || isLoading}
            onClick={() => setOffset(offset + limit)}
          >
            Older
          </Button>
        </div>
      </div>
    </div>
  );
}
