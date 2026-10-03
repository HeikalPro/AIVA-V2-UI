import { useEffect, useRef, useState, type ReactNode } from "react";
import { Activity, AlertTriangle, CheckCircle2, Info, Loader2, PlugZap, RefreshCw, XCircle, type LucideIcon } from "lucide-react";
import { formatUserError } from "@/lib/errors";
import { docIntelUnavailable, formatWhen, stageLabel } from "@/lib/doc-intel";
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
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ErrorLogsPanel } from "@/components/logs/ErrorLogsPanel";
import { Button } from "@/components/ui/button";
import { ConnectionTestResult } from "@/components/doc-intel/ConnectionTestResult";
import { HealthCard, HealthStatusIndicator } from "@/components/doc-intel/HealthCard";
import { KeyValueTable } from "@/components/doc-intel/KeyValueTable";
import { Notice } from "@/components/doc-intel/Notice";
import { LastSyncSummary, SourceStatusBadge } from "@/components/doc-intel/SyncBadges";
import type { ActivityItemOut, FailureItemOut, HealthEventOut, HealthOverviewOut, SourceOut } from "@/types/api";

type TabId = "health" | "failures" | "logs" | "diagnostics";

const TABS: { id: TabId; label: string }[] = [
  { id: "health", label: "Health" },
  { id: "failures", label: "Failures" },
  { id: "logs", label: "Logs" },
  { id: "diagnostics", label: "Diagnostics" },
];

const FAILURE_WINDOWS = [1, 7, 30] as const;
type FailureWindow = (typeof FAILURE_WINDOWS)[number];

const EVENTS_LIMIT = 20;
const ACTIVITY_LIMIT = 100;

function windowLabel(days: number): string {
  return days === 1 ? "1 day" : `${days} days`;
}

function SectionTitle({ children }: { children: string }) {
  return <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{children}</h2>;
}

function Placeholder({ children }: { children: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{children}</div>
  );
}

// ---- Overall banner --------------------------------------------------------------------------

function OverallBanner({ overview, running }: { overview: HealthOverviewOut; running: boolean }) {
  const failing = overview.components.filter((c) => c.status === "FAILED").length;
  const notConfigured = overview.components.filter((c) => c.status === "NOT_CONFIGURED").length;
  const healthy = overview.overall === "HEALTHY";
  const title = healthy
    ? "All systems healthy"
    : failing > 0
      ? `${failing} ${failing === 1 ? "component" : "components"} failing`
      : "Some checks are failing";
  const facts = [overview.checked_at ? `Last checked ${formatWhen(overview.checked_at)}` : "Not checked yet"];
  if (notConfigured > 0) facts.push(`${notConfigured} not configured (not counted as failures)`);
  if (running) facts.push("running checks…");
  else if (overview.stale) facts.push("results are out of date");

  return (
    <div
      role="status"
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
        healthy ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {healthy ? (
        <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
      ) : (
        <XCircle aria-hidden="true" className="h-5 w-5 shrink-0" />
      )}
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        <p className="text-xs opacity-90">{facts.join(" · ")}</p>
      </div>
    </div>
  );
}

// ---- Health tab ------------------------------------------------------------------------------

function RecentStatusChanges() {
  const events = useHealthEvents(EVENTS_LIMIT);
  const columns: Column<HealthEventOut>[] = [
    { key: "component", header: "Component", render: (e) => <span className="font-medium text-foreground">{e.label}</span> },
    {
      key: "change",
      header: "Change",
      render: (e) => (
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {e.old_status ? (
            <HealthStatusIndicator status={e.old_status} className="text-xs" />
          ) : (
            <span className="text-xs text-muted-foreground">First check</span>
          )}
          <span aria-hidden="true" className="text-muted-foreground">→</span>
          <span className="sr-only">changed to</span>
          <HealthStatusIndicator status={e.new_status} className="text-xs" />
        </span>
      ),
    },
    {
      key: "reason",
      header: "Reason",
      render: (e) => <span className="block min-w-[12rem] max-w-md break-words">{e.reason ?? "—"}</span>,
    },
    { key: "when", header: "When", render: (e) => <span className="whitespace-nowrap">{formatWhen(e.created_at)}</span> },
  ];

  return (
    <section className="space-y-3">
      <SectionTitle>Recent status changes</SectionTitle>
      <ErrorAlert message={events.isError ? formatUserError(events.error) : null} />
      <DataTable
        columns={columns}
        data={events.data ?? []}
        keyFn={(e) => e.id}
        loading={events.isLoading}
        emptyMessage="No status changes recorded yet."
      />
    </section>
  );
}

function HealthTab({ overview, loading }: { overview: HealthOverviewOut | undefined; loading: boolean }) {
  return (
    <div className="space-y-8">
      {overview ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {overview.components.map((c) => (
            <HealthCard key={c.key} component={c} />
          ))}
        </div>
      ) : (
        <Placeholder>{loading ? "Loading health status…" : "Health status is not available."}</Placeholder>
      )}
      <RecentStatusChanges />
    </div>
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
  const columns: Column<FailureItemOut>[] = [
    {
      key: "title",
      header: "Item",
      sortable: true,
      sortValue: (r) => r.title,
      render: (r) => (
        <div className="min-w-[10rem] max-w-xs">
          <span className="block break-words font-medium text-foreground">{r.title}</span>
          <span className="block text-xs text-muted-foreground">{FAILURE_KIND_LABEL[r.kind] ?? r.kind}</span>
        </div>
      ),
    },
    { key: "account", header: "Account", sortable: true, sortValue: (r) => r.account_name ?? "", render: (r) => r.account_name ?? "—" },
    { key: "stage", header: "Stage", render: (r) => failureStageLabel(r) },
    {
      key: "reason",
      header: "Reason",
      render: (r) => <span className="block min-w-[14rem] max-w-md break-words text-red-700">{r.reason ?? "—"}</span>,
    },
    {
      key: "when",
      header: "Time",
      sortable: true,
      sortValue: (r) => r.occurred_at ?? "",
      render: (r) => <span className="whitespace-nowrap">{formatWhen(r.occurred_at)}</span>,
    },
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Document imports, SharePoint files and SharePoint sync runs that failed in the selected period.
        </p>
        <div role="group" aria-label="Time window" className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Last</span>
          {FAILURE_WINDOWS.map((d) => (
            <Button
              key={d}
              size="sm"
              variant={d === days ? "default" : "outline"}
              aria-pressed={d === days}
              onClick={() => onDaysChange(d)}
            >
              {windowLabel(d)}
            </Button>
          ))}
        </div>
      </div>
      <ErrorAlert message={failures.isError ? formatUserError(failures.error) : null} />
      <DataTable
        columns={columns}
        data={failures.data?.items ?? []}
        keyFn={(r) => `${r.kind}-${r.id}`}
        loading={failures.isLoading}
        emptyMessage={`No failures in the last ${windowLabel(days)}.`}
      />
    </section>
  );
}

// ---- Logs tab --------------------------------------------------------------------------------

const LEVEL_META: Record<ActivityItemOut["level"], { icon: LucideIcon; className: string; label: string }> = {
  info: { icon: Info, className: "text-primary", label: "Info" },
  warning: { icon: AlertTriangle, className: "text-amber-600", label: "Warning" },
  error: { icon: XCircle, className: "text-red-600", label: "Error" },
};

const KIND_LABEL: Record<ActivityItemOut["kind"], string> = {
  kb_document: "Document import",
  health: "Health check",
  crm_file: "SharePoint file",
  sync_run: "SharePoint sync run",
};

function LogsTab() {
  const activity = useDocIntelActivity(ACTIVITY_LIMIT);
  const items = activity.data?.items ?? [];

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SectionTitle>Document intelligence activity</SectionTitle>
          <Button variant="outline" size="sm" onClick={() => activity.refetch()} disabled={activity.isFetching}>
            <RefreshCw aria-hidden="true" className={`mr-1.5 h-3.5 w-3.5 ${activity.isFetching ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <ErrorAlert message={activity.isError ? formatUserError(activity.error) : null} />
        {activity.isLoading ? (
          <Placeholder>Loading activity…</Placeholder>
        ) : items.length === 0 ? (
          <Placeholder>No activity recorded yet.</Placeholder>
        ) : (
          <ul className="max-h-[32rem] divide-y divide-border overflow-y-auto rounded-xl border border-border bg-card">
            {items.map((item, i) => {
              const meta = LEVEL_META[item.level] ?? LEVEL_META.info;
              const Icon = meta.icon;
              return (
                <li key={`${item.kind}-${item.ref_id ?? "none"}-${item.occurred_at ?? ""}-${i}`} className="flex items-start gap-3 px-4 py-3">
                  <Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${meta.className}`} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm text-foreground">
                      <span className="sr-only">{meta.label}: </span>
                      {item.message}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {KIND_LABEL[item.kind] ?? item.kind}
                      {item.kind !== "health" && item.ref_id != null ? ` #${item.ref_id}` : ""} ·{" "}
                      {formatWhen(item.occurred_at)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle>Error logs</SectionTitle>
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
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          The raw details each check reported: latency, versions and configuration.
        </p>
        <Button variant="outline" size="sm" onClick={onRun} disabled={running}>
          <RefreshCw aria-hidden="true" className={`mr-1.5 h-3.5 w-3.5 ${running ? "animate-spin" : ""}`} />
          {running ? "Running…" : "Run diagnostics"}
        </Button>
      </div>
      {!overview ? (
        <Placeholder>{loading ? "Loading diagnostics…" : "Diagnostics are not available."}</Placeholder>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {overview.components.map((c) => (
            <section
              key={c.key}
              aria-labelledby={`diag-${c.key}`}
              className="min-w-0 rounded-xl border border-border bg-card p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id={`diag-${c.key}`} className="text-sm font-semibold text-foreground">
                  {c.label}
                </h3>
                <HealthStatusIndicator status={c.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Checked {c.checked_at ? formatWhen(c.checked_at) : "not yet"}
                {c.latency_ms != null ? ` · ${c.latency_ms.toLocaleString()} ms` : ""}
                {c.consecutive_failures > 0 ? ` · ${c.consecutive_failures} consecutive failures` : ""}
              </p>
              <div className="mt-3">
                <KeyValueTable data={c.details} emptyMessage="No diagnostic details reported." />
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

// ---- Diagnostics: SharePoint connections (read-only) ----------------------------------------

function ConnectionFact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="mt-2 text-xs font-medium text-muted-foreground first:mt-0 sm:mt-0 sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
    </>
  );
}

/** One source for Super Admins and Developers: identifiers only (never the secret) and a step-by-step test. */
function ConnectionCard({ source }: { source: SourceOut }) {
  const test = useTestSourceConnection();
  const problem = test.isError ? describeActionError(test.error, "The connection test") : null;
  const secret = source.client_secret_set
    ? `Set${source.secret_updated_at ? ` · updated ${formatWhen(source.secret_updated_at)}` : ""}`
    : "Not set";

  return (
    <article aria-labelledby={`diag-source-${source.id}`} className="min-w-0 rounded-xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 id={`diag-source-${source.id}`} className="break-words text-sm font-semibold text-foreground">
            {source.name}
          </h3>
          <p className="text-xs text-muted-foreground">
            {scheduleSummary(source)}
            {source.sync_enabled ? ` (${SCHEDULE_TIME_ZONE_LABEL})` : ""}
          </p>
        </div>
        <SourceStatusBadge status={source.status} />
      </div>
      <dl className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[6.5rem_minmax(0,1fr)] sm:gap-y-1.5">
        <ConnectionFact label="Site">
          <span className="[overflow-wrap:anywhere]">{source.site_url || "—"}</span>
        </ConnectionFact>
        <ConnectionFact label="Folder">
          <span className="[overflow-wrap:anywhere]">
            {libraryLabel(source.drive_name)} · {folderLabel(source.folder_path)}
          </span>
        </ConnectionFact>
        <ConnectionFact label="Tenant ID">
          <span className="font-mono text-xs [overflow-wrap:anywhere]">{source.tenant_id || "—"}</span>
        </ConnectionFact>
        <ConnectionFact label="Client ID">
          <span className="font-mono text-xs [overflow-wrap:anywhere]">{source.client_id || "—"}</span>
        </ConnectionFact>
        <ConnectionFact label="Secret">
          {secret}
          {source.credentials_readable === false && <span className="text-red-700"> · can't be decrypted</span>}
        </ConnectionFact>
        <ConnectionFact label="Last sync">
          <LastSyncSummary source={source} showActive />
        </ConnectionFact>
      </dl>
      <div className="mt-4">
        <Button variant="outline" size="sm" onClick={() => test.mutate(source.id)} disabled={test.isPending}>
          {test.isPending ? (
            <Loader2 aria-hidden="true" className="mr-1.5 h-3.5 w-3.5 animate-spin" />
          ) : (
            <PlugZap aria-hidden="true" className="mr-1.5 h-3.5 w-3.5" />
          )}
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
    </article>
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
    <section aria-label="Connections" className="space-y-3">
      <div>
        <SectionTitle>Connections</SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground">
          SharePoint and OneDrive folders. Test connection checks the credentials, token, site, library, folder and file
          listing step by step. Secrets are never shown.
          {anyActive ? " Refreshing every 3 s while a sync runs." : ""}
        </p>
      </div>
      <ErrorAlert message={sources.isError ? `Couldn't load the connections: ${formatUserError(sources.error)}` : null} />
      {sources.isPending ? (
        <Placeholder>Loading connections…</Placeholder>
      ) : sources.isError ? null : list.length === 0 ? (
        <Placeholder>No SharePoint or OneDrive folders are connected.</Placeholder>
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
  // The overview drives the page banner, so it loads on every tab; everything else loads only on its own tab.
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

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        title="Monitoring"
        description="Health of the document intelligence services, recent import failures, logs and diagnostics."
        actions={
          unavailable ? undefined : (
            <Button onClick={() => runHealthChecks()} disabled={running}>
              <RefreshCw aria-hidden="true" className={`mr-2 h-4 w-4 ${running ? "animate-spin" : ""}`} />
              {running ? "Running checks…" : "Run checks now"}
            </Button>
          )
        }
      />

      {unavailable ? (
        <Notice tone="danger" title={unavailable.title}>
          {unavailable.message}
        </Notice>
      ) : (
        <>
          {overview && <OverallBanner overview={overview} running={running} />}
          {!running && runChecks.data?.throttled && (
            <Notice tone="info" title="Checks ran moments ago">
              The server returned the latest stored results instead of running every check again. Try again in about
              30 seconds.
            </Notice>
          )}
          <ErrorAlert message={runChecks.isError ? `Couldn't run the checks: ${formatUserError(runChecks.error)}` : null} />
          <ErrorAlert message={health.isError ? `Couldn't load health status: ${formatUserError(health.error)}` : null} />

          <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
            {TABS.map((t) => (
              <Button
                key={t.id}
                variant={tab === t.id ? "default" : "outline"}
                size="sm"
                aria-pressed={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </Button>
            ))}
          </div>

          {tab === "health" && <HealthTab overview={overview} loading={health.isLoading} />}
          {tab === "failures" && <FailuresTab days={failureDays} onDaysChange={setFailureDays} />}
          {tab === "logs" && <LogsTab />}
          {tab === "diagnostics" && (
            <>
              <DiagnosticsTab overview={overview} loading={health.isLoading} running={running} onRun={() => runHealthChecks()} />
              <ConnectionsSection />
            </>
          )}
        </>
      )}
    </div>
  );
}
