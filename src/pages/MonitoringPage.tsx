import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, History, Info, Lightbulb, PlugZap, RefreshCw, ShieldCheck } from "lucide-react";
import { formatUserError } from "@/lib/errors";
import { formatDurationMs, formatNumber } from "@/lib/format";
import { docIntelUnavailable, stageLabel } from "@/lib/doc-intel";
import {
  SCHEDULE_TIME_ZONE_LABEL,
  crmStageLabel,
  describeActionError,
  folderLabel,
  isActiveRun,
  libraryLabel,
  scheduleSummary,
} from "@/lib/sharepoint-sync";
import { useDocIntelStatus } from "@/hooks/useDocumentImport";
import {
  useDocIntelActivity,
  useDocIntelFailures,
  useDocIntelHealth,
  useHealthEvents,
  useRunHealthChecks,
} from "@/hooks/useMonitoring";
import { useSyncSources, useTestSourceConnection } from "@/hooks/useSharePointSync";
import { Page, PageHeading } from "@/components/shell/page";
import { DataTable, type Column, type DataTableEmpty } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { EmptyState } from "@/components/data/empty-state";
import { Status, type StatusTone } from "@/components/data/status";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ErrorLogsPanel } from "@/components/logs/ErrorLogsPanel";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { ConnectionTestResult } from "@/components/doc-intel/ConnectionTestResult";
import { HealthStatusIndicator, healthComponentIcon } from "@/components/doc-intel/HealthCard";
import { KeyValueTable } from "@/components/doc-intel/KeyValueTable";
import { Notice } from "@/components/doc-intel/Notice";
import { RelativeTime } from "@/components/doc-intel/RelativeTime";
import { LastSyncSummary, SourceStatusBadge } from "@/components/doc-intel/SyncBadges";
import { AutoRefreshIndicator } from "@/components/system/AutoRefreshIndicator";
import type { ActivityItemOut, FailureItemOut, HealthComponentOut, HealthEventOut, HealthOverviewOut, SourceOut } from "@/types/api";

type TabId = "health" | "failures" | "logs" | "diagnostics";

const FAILURE_WINDOWS = [1, 7, 30] as const;
type FailureWindow = (typeof FAILURE_WINDOWS)[number];

const EVENTS_LIMIT = 20;
const ACTIVITY_LIMIT = 100;
/** Display only: mirrors MONITORING_REFETCH_MS in hooks/useMonitoring (stored results, never live checks). */
const MONITORING_REFRESH_MS = 30_000;

function windowLabel(days: number): string {
  return days === 1 ? "24 hours" : `${days} days`;
}

function SectionHeading({
  id,
  title,
  description,
  actions,
}: {
  id?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 id={id} className="text-base font-semibold text-foreground">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

function loadError(title: string, error: unknown, retry: () => void): DataTableEmpty {
  return {
    icon: AlertCircle,
    title,
    description: formatUserError(error),
    action: (
      <Button variant="outline" size="sm" onClick={retry}>
        Try again
      </Button>
    ),
  };
}

// ---- Overall status line ---------------------------------------------------------------------

function OverallStatus({
  overview,
  loading,
  running,
  onRun,
}: {
  overview: HealthOverviewOut | undefined;
  loading: boolean;
  running: boolean;
  onRun: () => void;
}) {
  let status: ReactNode;
  const facts: ReactNode[] = [];
  if (!overview) {
    status = loading ? <Skeleton className="h-5 w-56" /> : <Status tone="neutral" label="Health status is not available" />;
  } else {
    const failing = overview.components.filter((c) => c.status === "FAILED").length;
    const notConfigured = overview.components.filter((c) => c.status === "NOT_CONFIGURED").length;
    const healthy = overview.overall === "HEALTHY";
    const label = healthy
      ? "All systems operational"
      : failing > 0
        ? `${failing} ${failing === 1 ? "component" : "components"} failing`
        : "Some checks are failing";
    status = <Status tone={healthy ? "success" : "danger"} label={label} className="text-sm font-semibold" />;
    facts.push(
      overview.checked_at ? (
        <span key="checked">
          Last check <RelativeTime value={overview.checked_at} />
        </span>
      ) : (
        <span key="checked">Not checked yet</span>
      ),
    );
    facts.push(
      <span key="count">
        {formatNumber(overview.components.length - failing - notConfigured)} of {formatNumber(overview.components.length)} healthy
      </span>,
    );
    if (notConfigured > 0) facts.push(<span key="nc">{notConfigured} not configured (not counted as failures)</span>);
    if (running) facts.push(<span key="run">Running checks…</span>);
    else if (overview.stale) facts.push(<span key="stale" className="text-warning">Results are out of date</span>);
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-lg border border-border bg-card px-4 py-3"
    >
      <div className="min-w-0 space-y-1">
        {status}
        {facts.length > 0 && (
          <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            {facts.map((fact, i) => (
              <span key={i} className="inline-flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true">·</span>}
                {fact}
              </span>
            ))}
          </p>
        )}
      </div>
      <Button onClick={onRun} loading={running}>
        {!running && <RefreshCw aria-hidden="true" className="h-4 w-4" />}
        {running ? "Running checks…" : "Run checks"}
      </Button>
    </div>
  );
}

// ---- Health tab ------------------------------------------------------------------------------

function ComponentCell({ c }: { c: HealthComponentOut }) {
  const Icon = healthComponentIcon(c.key);
  const failed = c.status === "FAILED";
  return (
    <div className="flex min-w-[14rem] max-w-[36rem] items-start gap-2.5 py-0.5">
      <Icon aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 space-y-1">
        <p className="font-medium text-foreground">{c.label}</p>
        {c.reason && (
          <p className={failed ? "break-words text-xs text-danger" : "break-words text-xs text-muted-foreground"}>{c.reason}</p>
        )}
        {failed && c.suggested_action && (
          <p className="flex items-start gap-1.5 text-xs text-foreground">
            <Lightbulb aria-hidden="true" className="mt-px h-3.5 w-3.5 shrink-0 text-warning" />
            <span className="min-w-0 break-words">
              <span className="font-medium">Suggested action: </span>
              {c.suggested_action}
            </span>
          </p>
        )}
      </div>
    </div>
  );
}

const STATUS_ORDER: Record<string, number> = { FAILED: 0, HEALTHY: 1, NOT_CONFIGURED: 2 };

function ComponentsTable({ overview, loading }: { overview: HealthOverviewOut | undefined; loading: boolean }) {
  const columns: Column<HealthComponentOut>[] = [
    { key: "label", header: "Component", sortable: true, sortValue: (c) => c.label.toLowerCase(), render: (c) => <ComponentCell c={c} /> },
    {
      key: "status",
      header: "Status",
      sortable: true,
      sortValue: (c) => STATUS_ORDER[c.status] ?? 3,
      render: (c) => <HealthStatusIndicator status={c.status} />,
    },
    { key: "latency_ms", header: "Latency", numeric: true, sortable: true, render: (c) => formatDurationMs(c.latency_ms) },
    { key: "checked_at", header: "Last check", sortable: true, render: (c) => <RelativeTime value={c.checked_at} fallback="Not yet" /> },
    {
      key: "last_success_at",
      header: "Last success",
      sortable: true,
      render: (c) => <RelativeTime value={c.last_success_at} fallback="Never" />,
    },
    {
      key: "last_failure_at",
      header: "Last failure",
      sortable: true,
      render: (c) => <RelativeTime value={c.last_failure_at} />,
    },
    {
      key: "consecutive_failures",
      header: "Failures in a row",
      numeric: true,
      sortable: true,
      render: (c) =>
        c.consecutive_failures > 0 ? (
          <span className="font-medium text-danger">{formatNumber(c.consecutive_failures)}</span>
        ) : (
          <span className="text-muted-foreground">0</span>
        ),
    },
  ];

  return (
    <DataTable<HealthComponentOut>
      aria-label="Component health"
      columns={columns}
      data={overview?.components ?? []}
      keyFn={(c) => c.key}
      loading={loading && !overview}
      skeletonRows={6}
      pagination={false}
      itemLabel="components"
      defaultSort={{ key: "status", dir: "asc" }}
      rowClassName={(c) => (c.status === "FAILED" ? "bg-danger-muted/40 hover:bg-danger-muted/60" : undefined)}
      empty={{ icon: ShieldCheck, title: "Health status is not available", description: "Run the checks to record the first results." }}
    />
  );
}

function RecentStatusChanges() {
  const events = useHealthEvents(EVENTS_LIMIT);
  const columns: Column<HealthEventOut>[] = [
    { key: "label", header: "Component", render: (e) => <span className="font-medium text-foreground">{e.label}</span> },
    {
      key: "change",
      header: "Change",
      render: (e) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {e.old_status ? (
            <HealthStatusIndicator status={e.old_status} />
          ) : (
            <span className="text-ui text-muted-foreground">First check</span>
          )}
          <span aria-hidden="true" className="text-muted-foreground">
            →
          </span>
          <span className="sr-only">changed to</span>
          <HealthStatusIndicator status={e.new_status} />
        </span>
      ),
    },
    { key: "reason", header: "Reason", truncate: true, maxWidth: "32rem", render: (e) => e.reason ?? "—" },
    { key: "created_at", header: "When", render: (e) => <RelativeTime value={e.created_at} /> },
  ];

  return (
    <section className="space-y-3" aria-labelledby="monitoring-events-heading">
      <h2 id="monitoring-events-heading" className="text-base font-semibold text-foreground">
        Recent status changes
      </h2>
      <DataTable<HealthEventOut>
        aria-label="Recent status changes"
        columns={columns}
        data={events.isError ? [] : (events.data ?? [])}
        keyFn={(e) => e.id}
        loading={events.isLoading}
        skeletonRows={4}
        pagination={false}
        itemLabel="changes"
        empty={
          events.isError
            ? loadError("Couldn't load status changes", events.error, () => void events.refetch())
            : { icon: History, title: "No status changes recorded yet", description: "Changes appear when a component turns healthy or failed." }
        }
      />
    </section>
  );
}

// ---- Failures tab ----------------------------------------------------------------------------

const FAILURE_KIND_LABEL: Record<FailureItemOut["kind"], string> = {
  kb_document: "Document import",
  crm_file: "SharePoint file",
  sync_run: "SharePoint sync run",
};

/** Knowledge-import stages for documents; SharePoint stages (download … save to CRM) for files and runs. */
function failureStageLabel(item: FailureItemOut): string {
  return item.kind === "kb_document" ? stageLabel(item.stage) : crmStageLabel(item.stage);
}

function FailuresTab({ days, onDaysChange }: { days: FailureWindow; onDaysChange: (days: FailureWindow) => void }) {
  const failures = useDocIntelFailures(days);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("ALL");
  const items = useMemo(() => failures.data?.items ?? [], [failures.data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (r) =>
        (kind === "ALL" || r.kind === kind) &&
        (!q || [r.title, r.account_name ?? "", r.reason ?? "", failureStageLabel(r)].join(" ").toLowerCase().includes(q)),
    );
  }, [items, search, kind]);
  const isFiltered = search.trim() !== "" || kind !== "ALL";

  const columns: Column<FailureItemOut>[] = [
    {
      key: "title",
      header: "Item",
      sortable: true,
      sortValue: (r) => r.title.toLowerCase(),
      render: (r) => (
        <div className="min-w-[12rem] max-w-[22rem]">
          <p className="truncate font-medium text-foreground" title={r.title}>
            <bdi>{r.title}</bdi>
          </p>
          <p className="text-xs text-muted-foreground">{FAILURE_KIND_LABEL[r.kind] ?? r.kind}</p>
        </div>
      ),
    },
    {
      key: "account",
      header: "Account",
      sortable: true,
      sortValue: (r) => r.account_name ?? "",
      render: (r) => (r.account_name ? <bdi>{r.account_name}</bdi> : "—"),
    },
    { key: "stage", header: "Stage", sortable: true, sortValue: (r) => failureStageLabel(r), render: (r) => failureStageLabel(r) },
    {
      key: "reason",
      header: "Reason",
      truncate: true,
      maxWidth: "30rem",
      cellTitle: (r) => r.reason ?? undefined,
      render: (r) => <span dir="auto">{r.reason ?? "—"}</span>,
    },
    {
      key: "occurred_at",
      header: "Time",
      sortable: true,
      sortValue: (r) => r.occurred_at ?? "",
      render: (r) => <RelativeTime value={r.occurred_at} />,
    },
  ];

  return (
    <DataTable<FailureItemOut>
      aria-label="Failures"
      columns={columns}
      data={failures.isError ? [] : filtered}
      keyFn={(r) => `${r.kind}-${r.id}`}
      loading={failures.isLoading}
      itemLabel="failures"
      defaultSort={{ key: "occurred_at", dir: "desc" }}
      empty={
        failures.isError
          ? loadError("Couldn't load failures", failures.error, () => void failures.refetch())
          : isFiltered
            ? {
                title: "No failures match these filters",
                action: (
                  <Button variant="outline" size="sm" onClick={() => (setSearch(""), setKind("ALL"))}>
                    Clear filters
                  </Button>
                ),
              }
            : {
                icon: CheckCircle2,
                title: `No failures in the last ${windowLabel(days)}`,
                description: "Document imports, SharePoint files and sync runs that fail appear here.",
              }
      }
      toolbar={
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search item, account or reason…"
          filters={[
            {
              id: "failure-kind",
              label: "Type",
              value: kind,
              onChange: setKind,
              options: [
                { value: "ALL", label: "All" },
                { value: "kb_document", label: FAILURE_KIND_LABEL.kb_document },
                { value: "crm_file", label: FAILURE_KIND_LABEL.crm_file },
                { value: "sync_run", label: FAILURE_KIND_LABEL.sync_run },
              ],
            },
          ]}
          onClear={() => {
            setSearch("");
            setKind("ALL");
          }}
          totalCount={isFiltered ? items.length : undefined}
          filteredCount={filtered.length}
          itemLabel="failures"
          actions={
            <Tabs variant="segmented" value={String(days)} onValueChange={(v) => onDaysChange(Number(v) as FailureWindow)}>
              <TabsList aria-label="Time window">
                {FAILURE_WINDOWS.map((d) => (
                  <TabsTrigger key={d} value={String(d)}>
                    {windowLabel(d)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          }
        />
      }
    />
  );
}

// ---- Logs tab --------------------------------------------------------------------------------

const LEVEL_META: Record<ActivityItemOut["level"], { tone: StatusTone; label: string }> = {
  info: { tone: "info", label: "Info" },
  warning: { tone: "warning", label: "Warning" },
  error: { tone: "danger", label: "Error" },
};

const KIND_LABEL: Record<ActivityItemOut["kind"], string> = {
  kb_document: "Document import",
  health: "Health check",
  crm_file: "SharePoint file",
  sync_run: "SharePoint sync run",
};

function ActivityFeed() {
  const activity = useDocIntelActivity(ACTIVITY_LIMIT);
  const items = activity.data?.items ?? [];

  return (
    <section className="space-y-3" aria-labelledby="monitoring-activity-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="monitoring-activity-heading" className="text-base font-semibold text-foreground">
            Document intelligence activity
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Imports, health checks and SharePoint syncs, newest first.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => activity.refetch()} disabled={activity.isFetching}>
          <RefreshCw aria-hidden="true" className={activity.isFetching ? "h-4 w-4 motion-safe:animate-spin" : "h-4 w-4"} />
          Refresh
        </Button>
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        {activity.isLoading ? (
          <ul aria-busy="true" className="divide-y divide-border">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
              </li>
            ))}
          </ul>
        ) : activity.isError ? (
          <EmptyState
            size="sm"
            icon={AlertCircle}
            title="Couldn't load activity"
            description={formatUserError(activity.error)}
            action={
              <Button variant="outline" size="sm" onClick={() => void activity.refetch()}>
                Try again
              </Button>
            }
          />
        ) : items.length === 0 ? (
          <EmptyState size="sm" icon={Info} title="No activity recorded yet" />
        ) : (
          <ul className="max-h-[28rem] divide-y divide-border overflow-y-auto">
            {items.map((item, i) => {
              const meta = LEVEL_META[item.level] ?? LEVEL_META.info;
              return (
                <li
                  key={`${item.kind}-${item.ref_id ?? "none"}-${item.occurred_at ?? ""}-${i}`}
                  className="grid grid-cols-[5.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 px-4 py-2.5 sm:grid-cols-[5.5rem_minmax(0,1fr)_auto]"
                >
                  <Status tone={meta.tone} label={meta.label} className="pt-px" />
                  <div className="min-w-0">
                    <p className="break-words text-ui text-foreground">
                      <span dir="auto">{item.message}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {KIND_LABEL[item.kind] ?? item.kind}
                      {item.kind !== "health" && item.ref_id != null && <span className="font-mono"> #{item.ref_id}</span>}
                    </p>
                  </div>
                  <RelativeTime value={item.occurred_at} className="col-start-2 text-xs text-muted-foreground sm:col-start-3 sm:pt-0.5" />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

function LogsTab() {
  return (
    <div className="space-y-8">
      <ActivityFeed />
      <section className="space-y-3" aria-labelledby="monitoring-errors-heading">
        <div>
          <h2 id="monitoring-errors-heading" className="text-base font-semibold text-foreground">
            Error logs
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Application errors recorded by the backend and the widget.</p>
        </div>
        <ErrorLogsPanel />
      </section>
    </div>
  );
}

// ---- Diagnostics tab -------------------------------------------------------------------------

function DiagnosticsTab({
  overview,
  loading,
  running,
  onRun,
}: {
  overview: HealthOverviewOut | undefined;
  loading: boolean;
  running: boolean;
  onRun: () => void;
}) {
  return (
    <section className="space-y-3" aria-labelledby="monitoring-diagnostics-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="monitoring-diagnostics-heading" className="text-base font-semibold text-foreground">
            Check details
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">The raw details each check reported: latency, versions and configuration.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRun} loading={running}>
          {!running && <RefreshCw aria-hidden="true" className="h-4 w-4" />}
          {running ? "Running…" : "Run diagnostics"}
        </Button>
      </div>
      {!overview ? (
        loading ? (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" aria-busy="true">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState size="sm" icon={ShieldCheck} title="Diagnostics are not available" />
          </Card>
        )
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {overview.components.map((c) => {
            const Icon = healthComponentIcon(c.key);
            return (
              <Card key={c.key} className="min-w-0 p-4" aria-labelledby={`diag-${c.key}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 id={`diag-${c.key}`} className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Icon aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                    {c.label}
                  </h3>
                  <HealthStatusIndicator status={c.status} />
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Checked <RelativeTime value={c.checked_at} fallback="not yet" />
                  {c.latency_ms != null ? ` · ${formatDurationMs(c.latency_ms)}` : ""}
                  {c.consecutive_failures > 0 ? ` · ${c.consecutive_failures} consecutive failures` : ""}
                </p>
                <div className="mt-3 border-t border-border pt-3">
                  <KeyValueTable data={c.details} emptyMessage="No diagnostic details reported." />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ---- Diagnostics: SharePoint connections (read-only) ----------------------------------------

function ConnectionFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-4 gap-y-0.5 py-1.5 first:pt-0 last:pb-0 sm:grid-cols-[6.5rem_minmax(0,1fr)]">
      <dt className="text-xs font-medium leading-5 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-ui text-foreground [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

/** One source for Super Admins and Developers: identifiers only (never the secret) and a step-by-step test. */
function ConnectionCard({ source }: { source: SourceOut }) {
  const test = useTestSourceConnection();
  const problem = test.isError ? describeActionError(test.error, "The connection test") : null;

  return (
    <Card className="min-w-0 p-4" aria-labelledby={`diag-source-${source.id}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`diag-source-${source.id}`} className="break-words text-sm font-semibold text-foreground">
            <bdi>{source.name}</bdi>
          </h3>
          <p className="text-xs text-muted-foreground">
            {scheduleSummary(source)}
            {source.sync_enabled ? ` (${SCHEDULE_TIME_ZONE_LABEL})` : ""}
          </p>
        </div>
        <SourceStatusBadge status={source.status} />
      </div>
      <dl className="mt-3 divide-y divide-border border-t border-border pt-3">
        <ConnectionFact label="Site">
          <span className="font-mono text-xs">{source.site_url || "—"}</span>
        </ConnectionFact>
        <ConnectionFact label="Folder">
          <span className="font-mono text-xs">
            {libraryLabel(source.drive_name)} · {folderLabel(source.folder_path)}
          </span>
        </ConnectionFact>
        <ConnectionFact label="Tenant ID">
          <span className="font-mono text-xs">{source.tenant_id || "—"}</span>
        </ConnectionFact>
        <ConnectionFact label="Client ID">
          <span className="font-mono text-xs">{source.client_id || "—"}</span>
        </ConnectionFact>
        <ConnectionFact label="Secret">
          {source.client_secret_set ? (
            <>
              Set
              {source.secret_updated_at && (
                <span className="text-muted-foreground">
                  {" "}
                  · updated <RelativeTime value={source.secret_updated_at} />
                </span>
              )}
            </>
          ) : (
            "Not set"
          )}
          {source.credentials_readable === false && <span className="text-danger"> · can't be decrypted</span>}
        </ConnectionFact>
        <ConnectionFact label="Last sync">
          <LastSyncSummary source={source} showActive />
        </ConnectionFact>
      </dl>
      <div className="mt-4">
        <Button variant="outline" size="sm" onClick={() => test.mutate(source.id)} loading={test.isPending}>
          {!test.isPending && <PlugZap aria-hidden="true" className="h-4 w-4" />}
          {test.isPending ? "Testing…" : "Test connection"}
        </Button>
      </div>
      {(problem || test.data) && (
        <div className="mt-3 space-y-3">
          {problem && (
            <Notice tone={problem.tone} title={problem.title} onDismiss={() => test.reset()}>
              {problem.message}
            </Notice>
          )}
          {test.data && <ConnectionTestResult result={test.data} onDismiss={() => test.reset()} />}
        </div>
      )}
    </Card>
  );
}

/** Shown once SharePoint sync is installed (migration V002); Developers get it here instead of the SharePoint Sync page. */
function ConnectionsSection() {
  const status = useDocIntelStatus();
  const installed = status.data?.crm_installed === true;
  const sources = useSyncSources(installed);
  if (!installed) return null;
  const list = (sources.data ?? []).filter((s) => s.status !== "DELETED");
  const anyActive = list.some((s) => isActiveRun(s.active_run));

  return (
    <section aria-labelledby="monitoring-connections-heading" className="space-y-3">
      <div>
        <h2 id="monitoring-connections-heading" className="text-base font-semibold text-foreground">
          SharePoint connections
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Test connection checks the credentials, token, site, library, folder and file listing step by step. Secrets are never
          shown.
          {anyActive ? " Refreshing every 3 s while a sync runs." : ""}
        </p>
      </div>
      <ErrorAlert message={sources.isError ? `Couldn't load the connections: ${formatUserError(sources.error)}` : null} />
      {sources.isPending ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2" aria-busy="true">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : sources.isError ? null : list.length === 0 ? (
        <Card>
          <EmptyState size="sm" icon={PlugZap} title="No SharePoint or OneDrive folders are connected" />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {list.map((s) => (
            <ConnectionCard key={s.id} source={s} />
          ))}
        </div>
      )}
    </section>
  );
}

// ---- Page ------------------------------------------------------------------------------------

export function MonitoringPage() {
  const [tab, setTab] = useState<TabId>("health");
  const [failureDays, setFailureDays] = useState<FailureWindow>(7);
  // The overview drives the status line, so it loads on every tab; everything else loads only on its own tab.
  const health = useDocIntelHealth();
  const runChecks = useRunHealthChecks();
  const { mutate: runHealthChecks } = runChecks;
  const unavailable = docIntelUnavailable(health.error);
  const overview = health.data;
  const running = runChecks.isPending;

  // Stored results older than the stale window: refresh them once, on first load.
  const staleHandled = useRef(false);
  useEffect(() => {
    if (staleHandled.current || !health.data) return;
    staleHandled.current = true;
    if (health.data.stale) runHealthChecks();
  }, [health.data, runHealthChecks]);

  /** "Run checks" / "Run diagnostics": same mutation, with transient feedback. */
  function runNow() {
    runHealthChecks(undefined, {
      onSuccess: (data) => {
        if (data?.throttled) {
          toast.info("Checks ran moments ago", {
            description:
              "The server returned the latest stored results instead of running every check again. Try again in about 30 seconds.",
          });
          return;
        }
        const failing = (data?.components ?? []).filter((c) => c.status === "FAILED");
        if (failing.length === 0) toast.success("Health checks finished", { description: "All systems operational." });
        else
          toast.warning("Health checks finished", {
            description: `Failing: ${failing.map((c) => c.label).join(", ")}.`,
          });
      },
    });
  }

  return (
    <Page width="wide">
      <PageHeading
        title="Monitoring"
        meta={unavailable ? undefined : <AutoRefreshIndicator intervalMs={MONITORING_REFRESH_MS} fetching={health.isFetching} />}
        description="Health of the document intelligence services, recent import failures, logs and diagnostics."
      />

      {unavailable ? (
        <Notice tone="danger" title={unavailable.title}>
          {unavailable.message}
        </Notice>
      ) : (
        <>
          <OverallStatus overview={overview} loading={health.isLoading} running={running} onRun={runNow} />
          <ErrorAlert message={runChecks.isError ? `Couldn't run the checks: ${formatUserError(runChecks.error)}` : null} />
          <ErrorAlert message={health.isError ? `Couldn't load health status: ${formatUserError(health.error)}` : null} />

          <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
            <TabsList aria-label="Monitoring views">
              <TabsTrigger value="health">Health</TabsTrigger>
              <TabsTrigger value="failures">Failures</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
              <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
            </TabsList>

            <TabsContent value="health" className="space-y-8">
              <section className="space-y-3" aria-labelledby="monitoring-components-heading">
                <SectionHeading
                  id="monitoring-components-heading"
                  title="Components"
                  description="Stored results of the last check. Polling never triggers live checks; use Run checks for that."
                />
                <ComponentsTable overview={overview} loading={health.isLoading} />
              </section>
              <RecentStatusChanges />
            </TabsContent>

            <TabsContent value="failures" className="space-y-3">
              <SectionHeading
                title="Failures"
                description="Document imports, SharePoint files and SharePoint sync runs that failed in the selected period."
              />
              <FailuresTab days={failureDays} onDaysChange={setFailureDays} />
            </TabsContent>

            <TabsContent value="logs">
              <LogsTab />
            </TabsContent>

            <TabsContent value="diagnostics" className="space-y-8">
              <DiagnosticsTab overview={overview} loading={health.isLoading} running={running} onRun={runNow} />
              <ConnectionsSection />
            </TabsContent>
          </Tabs>
        </>
      )}
    </Page>
  );
}
