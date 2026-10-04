import { useMemo, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, Send, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTable, type Column } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Status, type StatusTone } from "@/components/data/status";
import {
  CHART_MARGIN,
  ChartCard,
  ChartTooltip,
  alpha,
  chartAxisProps,
  chartCursor,
  chartGridProps,
  useChartTheme,
} from "@/components/data/chart";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { toast } from "@/components/ui/toast";
import { filterRows } from "@/lib/table-filters";
import { formatUserError } from "@/lib/errors";
import { formatDateTime, formatNumber } from "@/lib/format";
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
import { AutoRefreshIndicator } from "@/components/system/AutoRefreshIndicator";
import { HttpStatusCode, LogTime } from "./log-cells";

/** Display only: mirrors LIVE_LOG_REFETCH_MS in hooks/useLogs (the three error sources poll every 10 s). */
const ERROR_LOGS_REFRESH_MS = 10_000;
/** Bars shown in the by-type chart; every type stays reachable through the Type filter. */
const MAX_CHART_TYPES = 8;

const SEVERITY: Record<ErrorSeverity, { tone: StatusTone; label: string }> = {
  info: { tone: "info", label: "Info" },
  warning: { tone: "warning", label: "Warning" },
  error: { tone: "danger", label: "Error" },
  critical: { tone: "danger", label: "Critical" },
};

function SeverityStatus({ value }: { value: ErrorSeverity }) {
  const s = SEVERITY[value] ?? SEVERITY.error;
  return <Status tone={s.tone} label={s.label} />;
}

const SOURCE_LABEL: Record<ErrorSource, string> = {
  SERVER: "Server",
  WIDGET: "Widget",
  AI: "AI request",
  RAG: "Retrieval",
};

function SourceBadge({ value }: { value: ErrorSource }) {
  return <Badge variant={value === "WIDGET" ? "info" : "neutral"}>{SOURCE_LABEL[value] ?? value}</Badge>;
}

function contextValue(row: ErrorLogEntry): string {
  return row.endpoint ?? row.model ?? "—";
}

function truncateLabel(value: string, max = 22): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function DetailFact({ label, children, mono = false }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className={mono ? "mt-0.5 break-all font-mono text-xs text-foreground" : "mt-0.5 break-words text-ui text-foreground"}>{children}</dd>
    </div>
  );
}

function FailuresByType({
  typeCounts,
  typeFilter,
  onSelect,
}: {
  typeCounts: { type: string; count: number }[];
  typeFilter: string | null;
  onSelect: (type: string | null) => void;
}) {
  const theme = useChartTheme();
  const data = typeCounts.slice(0, MAX_CHART_TYPES);
  const more = typeCounts.length - data.length;
  const color = theme.series[0];
  const height = Math.max(120, data.length * 30 + 16);

  return (
    <ChartCard
      title="Failures by type"
      description={
        typeFilter ? (
          <>
            Table filtered to <span className="font-medium text-foreground">“{typeFilter}”</span>
          </>
        ) : (
          "Click a bar to filter the table by type."
        )
      }
      height={height}
      actions={
        typeFilter ? (
          <Button variant="ghost" size="sm" onClick={() => onSelect(null)}>
            <X aria-hidden="true" className="h-4 w-4" />
            Clear type filter
          </Button>
        ) : undefined
      }
      footer={
        more > 0 ? <p className="text-xs text-muted-foreground">+{more} more types: use the Type filter above the table.</p> : undefined
      }
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ ...CHART_MARGIN, right: 24 }} accessibilityLayer>
          <CartesianGrid {...chartGridProps(theme)} vertical horizontal={false} />
          <XAxis type="number" allowDecimals={false} {...chartAxisProps(theme)} />
          <YAxis
            type="category"
            dataKey="type"
            width={168}
            interval={0}
            {...chartAxisProps(theme)}
            tickFormatter={(value: string) => truncateLabel(String(value))}
          />
          <Tooltip
            cursor={chartCursor(theme, "bar")}
            isAnimationActive={false}
            content={<ChartTooltip valueFormatter={(v) => formatNumber(Number(v))} />}
          />
          <Bar
            dataKey="count"
            name="Failures"
            radius={[0, 4, 4, 0]}
            maxBarSize={20}
            cursor="pointer"
            isAnimationActive={false}
            onClick={(d: { type?: string }) => onSelect(d?.type && d.type !== typeFilter ? d.type : null)}
          >
            {data.map((t) => (
              <Cell key={t.type} fill={typeFilter && typeFilter !== t.type ? alpha(color, 0.25) : color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

export function ErrorLogsPanel() {
  const { entries, typeCounts, isLoading, isError, error, isFetching, refetch } = useErrorLogs(true);

  const { user } = useAuth();
  const canSendTest =
    (user?.roles.includes(ROLES.SUPER_ADMIN) ?? false) || (user?.roles.includes(ROLES.ORG_ADMIN) ?? false);
  const testAlert = useSendTestErrorAlert();

  function handleSendTest() {
    testAlert.mutate(undefined, {
      onSuccess: (data) => {
        const message = data?.message || "Test alert processed.";
        if (data?.status === "sent") toast.success("Test alert sent", { description: message });
        else if (data?.status === "failed") toast.error("Test alert failed", { description: message });
        else toast.warning("Test alert not sent", { description: message });
      },
      onError: (err) => toast.error("Couldn't send the test alert", { description: formatUserError(err) }),
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
          [r.type, r.exception, r.user ?? "", r.endpoint ?? "", r.model ?? "", r.requestId ?? "", String(r.conversationId ?? "")].join(" "),
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
      render: (r) => <SeverityStatus value={r.severity} />,
    },
    { key: "when", header: "Time", sortable: true, sortValue: (r) => r.when ?? "", render: (r) => <LogTime value={r.when} /> },
    {
      key: "type",
      header: "Type",
      sortable: true,
      sortValue: (r) => r.type,
      truncate: true,
      maxWidth: "14rem",
      render: (r) => <span className="font-medium text-foreground">{r.type}</span>,
      cellTitle: (r) => r.type,
    },
    { key: "source", header: "Source", render: (r) => <SourceBadge value={r.source} /> },
    {
      key: "context",
      header: "Endpoint / model",
      truncate: true,
      maxWidth: "16rem",
      cellTitle: (r) => contextValue(r),
      render: (r) => <span className="font-mono text-xs">{contextValue(r)}</span>,
    },
    { key: "status", header: "HTTP", render: (r) => <HttpStatusCode value={r.statusCode} /> },
    {
      key: "exception",
      header: "Message",
      truncate: true,
      maxWidth: "28rem",
      cellTitle: (r) => r.exception,
      render: (r) => <span dir="auto">{r.exception}</span>,
    },
  ];

  function clearFilters() {
    setSearch("");
    setSeverityFilter("ALL");
    setSourceFilter("ALL");
    setTypeFilter(null);
  }

  const isFiltered = search.trim() !== "" || severityFilter !== "ALL" || sourceFilter !== "ALL" || typeFilter != null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Server exceptions (with stack traces) plus failed AI requests and knowledge retrievals.</p>
        <div className="flex flex-wrap items-center gap-2">
          <AutoRefreshIndicator intervalMs={ERROR_LOGS_REFRESH_MS} fetching={isFetching} />
          {canSendTest && (
            <Button variant="outline" size="sm" onClick={handleSendTest} loading={testAlert.isPending}>
              {!testAlert.isPending && <Send aria-hidden="true" className="h-4 w-4" />}
              {testAlert.isPending ? "Sending…" : "Send test alert"}
            </Button>
          )}
          <IconButton
            label="Refresh error logs"
            icon={RefreshCw}
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className={isFetching ? "[&_svg]:motion-safe:animate-spin" : undefined}
          />
        </div>
      </div>

      <ErrorAlert message={isError ? formatUserError(error) : null} />

      {(isLoading || typeCounts.length > 0) && (
        isLoading ? (
          <ChartCard title="Failures by type" loading height={160} />
        ) : (
          <FailuresByType typeCounts={typeCounts} typeFilter={typeFilter} onSelect={setTypeFilter} />
        )
      )}

      <DataTable<ErrorLogEntry>
        aria-label="Error logs"
        columns={columns}
        data={rows}
        keyFn={(r) => r.id}
        loading={isLoading}
        density="compact"
        itemLabel="failures"
        onRowClick={(row) => setSelected(row)}
        empty={
          isFiltered
            ? {
                title: "No failures match these filters",
                action: (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                ),
              }
            : isError
              ? { icon: AlertCircle, title: "Couldn't load error logs", description: formatUserError(error) }
              : { icon: CheckCircle2, title: "No failures recorded", description: "Server exceptions and failed AI requests appear here." }
        }
        toolbar={
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search type, message, user, request ID…"
            filters={[
              {
                id: "error-severity",
                label: "Severity",
                value: severityFilter,
                onChange: setSeverityFilter,
                options: [
                  { value: "ALL", label: "All" },
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
                  { value: "ALL", label: "All" },
                  { value: "SERVER", label: "Server exception" },
                  { value: "WIDGET", label: "Widget" },
                  { value: "AI", label: "AI requests" },
                  { value: "RAG", label: "Knowledge retrieval" },
                ],
              },
              {
                id: "error-type",
                label: "Type",
                value: typeFilter ?? "ALL",
                onChange: (v) => setTypeFilter(v === "ALL" ? null : v),
                options: [{ value: "ALL", label: "All" }, ...typeCounts.map((t) => ({ value: t.type, label: `${t.type} (${t.count})` }))],
                hidden: typeCounts.length === 0,
              },
            ]}
            onClear={clearFilters}
            totalCount={isFiltered ? entries.length : undefined}
            filteredCount={rows.length}
            itemLabel="failures"
          />
        }
      />

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)} size="xl">
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="break-words">{selected?.type ?? "Error details"}</DialogTitle>
            <DialogDescription>Full context for the selected failure.</DialogDescription>
          </DialogHeader>
          {selected && (
            <DialogBody className="space-y-5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <SeverityStatus value={selected.severity} />
                <SourceBadge value={selected.source} />
                {selected.statusCode != null && (
                  <span className="inline-flex items-center gap-1.5 text-ui text-muted-foreground">
                    HTTP <HttpStatusCode value={selected.statusCode} />
                  </span>
                )}
                {selected.when && <span className="text-ui text-muted-foreground">{formatDateTime(selected.when, { dateStyle: "medium", timeStyle: "medium" })}</span>}
              </div>

              <section className="space-y-1.5">
                <h3 className="text-sm font-semibold text-foreground">Message</h3>
                <p dir="auto" className="whitespace-pre-wrap break-words rounded-md border border-border bg-surface-muted px-3 py-2 text-ui text-foreground">
                  {selected.exception}
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="text-sm font-semibold text-foreground">Stack trace</h3>
                {selected.stackTrace ? (
                  <pre className="max-h-[22rem] overflow-auto whitespace-pre rounded-md border border-border bg-surface-muted p-3 font-mono text-xs leading-relaxed text-foreground">
                    {selected.stackTrace}
                  </pre>
                ) : (
                  <p className="rounded-md border border-dashed border-border px-3 py-2 text-ui text-muted-foreground">
                    No stack trace: this failure was logged without one (AI / retrieval-level failure).
                  </p>
                )}
              </section>

              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-2 lg:grid-cols-4">
                <DetailFact label="Type">{selected.type}</DetailFact>
                <DetailFact label="API endpoint" mono>
                  {selected.endpoint ?? "—"}
                </DetailFact>
                <DetailFact label="Request ID" mono>
                  {selected.requestId ?? "—"}
                </DetailFact>
                <DetailFact label="User">{selected.user ?? "—"}</DetailFact>
                <DetailFact label="Conversation ID" mono>
                  {selected.conversationId != null ? `#${selected.conversationId}` : "—"}
                </DetailFact>
                <DetailFact label="Model" mono>
                  {selected.model ?? "—"}
                </DetailFact>
                <DetailFact label="Account">{selected.account ? <bdi>{selected.account}</bdi> : "—"}</DetailFact>
              </dl>
            </DialogBody>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
