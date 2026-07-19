import { useMemo, useState } from "react";
import { RefreshCw, Send } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { TableFilters } from "@/components/shared/TableFilters";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { filterRows } from "@/lib/table-filters";
import { formatUserError } from "@/lib/errors";
import {
  SEVERITY_RANK,
  useErrorLogs,
  useSendTestErrorAlert,
  type ErrorLogEntry,
  type ErrorSeverity,
  type ErrorSource,
} from "@/hooks/useErrorLogs";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/roles";
import type { DeveloperNotify } from "@/types/api";

function formatWhen(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function snippet(text: string | null | undefined, max = 80): string {
  if (!text) return "—";
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

const SEVERITY_TONE: Record<ErrorSeverity, string> = {
  info: "bg-slate-100 text-slate-600",
  warning: "bg-amber-100 text-amber-700",
  error: "bg-red-100 text-red-700",
  critical: "bg-rose-200 text-rose-800",
};

function SeverityBadge({ value }: { value: ErrorSeverity }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${SEVERITY_TONE[value]}`}>
      {value}
    </span>
  );
}

const SOURCE_TONE: Record<ErrorSource, string> = {
  SERVER: "bg-red-100 text-red-700",
  WIDGET: "bg-fuchsia-100 text-fuchsia-700",
  AI: "bg-sky-100 text-sky-700",
  RAG: "bg-violet-100 text-violet-700",
};

function SourceBadge({ value }: { value: ErrorSource }) {
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${SOURCE_TONE[value]}`}>{value}</span>
  );
}

function contextValue(row: ErrorLogEntry): string {
  return row.endpoint ?? row.model ?? "—";
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</div>
      <div className="whitespace-pre-wrap break-words text-sm text-slate-900">{value}</div>
    </div>
  );
}

const TEST_TONE: Record<DeveloperNotify["status"], string> = {
  sent: "border-emerald-200 bg-emerald-50 text-emerald-700",
  no_recipients: "border-amber-200 bg-amber-50 text-amber-700",
  disabled: "border-amber-200 bg-amber-50 text-amber-700",
  failed: "border-red-200 bg-red-50 text-red-700",
};

export function ErrorLogsPanel() {
  const { entries, typeCounts, isLoading, isError, error, isFetching, refetch } = useErrorLogs(true);

  const { user } = useAuth();
  const canSendTest =
    (user?.roles.includes(ROLES.SUPER_ADMIN) ?? false) || (user?.roles.includes(ROLES.ORG_ADMIN) ?? false);
  const testAlert = useSendTestErrorAlert();
  const [testResult, setTestResult] = useState<DeveloperNotify | null>(null);
  const [testError, setTestError] = useState<string | null>(null);

  function handleSendTest() {
    setTestResult(null);
    setTestError(null);
    testAlert.mutate(undefined, {
      onSuccess: (data) => setTestResult(data),
      onError: (err) => setTestError(formatUserError(err)),
    });
  }

  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<ErrorLogEntry | null>(null);

  const rows = useMemo(
    () =>
      filterRows(
        entries,
        search,
        (r) =>
          [r.type, r.exception, r.user ?? "", r.endpoint ?? "", r.model ?? "", r.requestId ?? "", String(r.conversationId ?? "")].join(
            " ",
          ),
        [
          (r) => severityFilter === "ALL" || r.severity === severityFilter,
          (r) => sourceFilter === "ALL" || r.source === sourceFilter,
          (r) => typeFilter == null || r.type === typeFilter,
        ],
      ),
    [entries, search, severityFilter, sourceFilter, typeFilter],
  );

  const columns: Column<ErrorLogEntry>[] = [
    {
      key: "severity",
      header: "Severity",
      sortable: true,
      sortValue: (r) => SEVERITY_RANK[r.severity],
      render: (r) => <SeverityBadge value={r.severity} />,
    },
    { key: "type", header: "Type", sortable: true, sortValue: (r) => r.type, render: (r) => <span className="font-medium">{r.type}</span> },
    { key: "when", header: "When", sortable: true, sortValue: (r) => r.when ?? "", render: (r) => formatWhen(r.when) },
    { key: "source", header: "Source", render: (r) => <SourceBadge value={r.source} /> },
    { key: "context", header: "Endpoint / Model", render: (r) => snippet(contextValue(r), 42) },
    { key: "status", header: "Status", render: (r) => (r.statusCode != null ? r.statusCode : "—") },
    { key: "exception", header: "Message", render: (r) => snippet(r.exception, 70) },
  ];

  function clearFilters() {
    setSearch("");
    setSeverityFilter("ALL");
    setSourceFilter("ALL");
    setTypeFilter(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Server exceptions (with stack traces) plus failed AI requests and RAG retrievals.
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Auto-refreshes every 10s</span>
          {canSendTest && (
            <Button variant="outline" size="sm" onClick={handleSendTest} disabled={testAlert.isPending}>
              <Send className={`mr-1.5 h-3.5 w-3.5 ${testAlert.isPending ? "animate-pulse" : ""}`} />
              {testAlert.isPending ? "Sending…" : "Send test alert"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {testResult && (
        <div className={`rounded-lg border px-3 py-2 text-sm ${TEST_TONE[testResult.status]}`}>
          {testResult.message}
        </div>
      )}
      <ErrorAlert message={testError} />

      <ErrorAlert message={isError ? formatUserError(error) : null} />

      {typeCounts.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Failures by type</h4>
            {typeFilter && (
              <button type="button" className="text-xs text-primary hover:underline" onClick={() => setTypeFilter(null)}>
                Clear “{typeFilter}” filter
              </button>
            )}
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={typeCounts} margin={{ top: 16, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="type" tick={{ fontSize: 11, fill: "#64748b" }} interval={0} angle={-12} textAnchor="end" height={50} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} width={32} />
              <Tooltip cursor={{ fill: "rgba(148,163,184,0.12)" }} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} onClick={(d: { type?: string }) => setTypeFilter(d?.type ?? null)} cursor="pointer">
                {typeCounts.map((t) => (
                  <Cell key={t.type} fill={typeFilter && typeFilter !== t.type ? "#cbd5e1" : "#3b82f6"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="mt-1 text-center text-xs text-muted-foreground">Click a bar to filter the table by type.</p>
        </div>
      )}

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search errors…"
        filters={[
          {
            id: "error-severity",
            label: "Severity",
            value: severityFilter,
            onChange: setSeverityFilter,
            options: [
              { value: "ALL", label: "All severities" },
              { value: "info", label: "Info" },
              { value: "warning", label: "Warning" },
              { value: "error", label: "Error" },
              { value: "critical", label: "Critical" },
            ],
          },
          {
            id: "error-source",
            label: "Source",
            value: sourceFilter,
            onChange: setSourceFilter,
            options: [
              { value: "ALL", label: "All sources" },
              { value: "SERVER", label: "Server exception" },
              { value: "WIDGET", label: "Widget" },
              { value: "AI", label: "AI requests" },
              { value: "RAG", label: "RAG retrieval" },
            ],
          },
        ]}
        onClear={clearFilters}
        totalCount={entries.length}
        filteredCount={rows.length}
      />

      <DataTable
        columns={columns}
        data={rows}
        keyFn={(r) => r.id}
        loading={isLoading}
        emptyMessage="No failures recorded. 🎉"
        onRowClick={(row) => setSelected(row)}
      />

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>{selected?.type ?? "Error details"}</DialogTitle>
              <p className="mt-1 text-sm text-slate-500">Full context for the selected failure.</p>
            </div>
            <DialogClose onClose={() => setSelected(null)} />
          </DialogHeader>
          {selected ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <SeverityBadge value={selected.severity} />
                <SourceBadge value={selected.source} />
                {selected.statusCode != null && (
                  <span className="text-xs font-medium text-slate-500">HTTP {selected.statusCode}</span>
                )}
              </div>
              <DetailRow label="Message" value={selected.exception} />
              <div className="rounded-lg border border-slate-200 bg-slate-900 p-3">
                <div className="mb-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Stack trace</div>
                <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-100">
                  {selected.stackTrace ?? "No stack trace — this failure was logged without one (AI/RAG-level failure)."}
                </pre>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailRow label="When" value={formatWhen(selected.when)} />
                <DetailRow label="Type" value={selected.type} />
                <DetailRow label="API endpoint" value={selected.endpoint ?? "—"} />
                <DetailRow label="Request ID" value={selected.requestId ?? "—"} />
                <DetailRow label="User" value={selected.user ?? "—"} />
                <DetailRow
                  label="Conversation ID"
                  value={selected.conversationId != null ? `#${selected.conversationId}` : "—"}
                />
                <DetailRow label="Model" value={selected.model ?? "—"} />
                <DetailRow label="Account" value={selected.account ?? "—"} />
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
