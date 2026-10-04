import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ExternalLink, FolderSync, Pencil, PlugZap, Plus, Power, PowerOff, RefreshCw, Trash2 } from "lucide-react";
import { formatUserError } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { docIntelUnavailable, notInstalled, type DocIntelUnavailable } from "@/lib/doc-intel";
import {
  FILE_STATES,
  FILE_STATE_LABELS,
  FILE_STATUSES,
  FILE_STATUS_LABELS,
  SCHEDULE_TIME_ZONE_LABEL,
  describeActionError,
  fileTypesLabel,
  folderLabel,
  isActiveRun,
  libraryLabel,
  safeExternalUrl,
  scheduleSummary,
  sharePointNotInstalled,
  sharePointUnavailable,
  sourceCount,
  type ActionProblem,
  type SourceCountKey,
} from "@/lib/sharepoint-sync";
import { useDocIntelStatus } from "@/hooks/useDocumentImport";
import {
  SYNC_REFETCH_MS,
  useCrmEntities,
  useDeleteSource,
  useRefreshWhenSyncsFinish,
  useRetrySourceFile,
  useSourceFiles,
  useSyncRuns,
  useSyncSourceNow,
  useSyncSources,
  useTestSourceConnection,
  useUpdateSource,
} from "@/hooks/useSharePointSync";
import { Page, PageHeading } from "@/components/shell/page";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import { Stat, StatGroup } from "@/components/data/stat";
import { Status } from "@/components/data/status";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { RowActionsMenu } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { ConnectionTestResult } from "@/components/doc-intel/ConnectionTestResult";
import { CrmEntitiesTable, EMPTY_ENTITY_FILTERS, type CrmEntityFilters } from "@/components/doc-intel/CrmEntitiesTable";
import { Notice } from "@/components/doc-intel/Notice";
import { RelativeTime } from "@/components/doc-intel/RelativeTime";
import { SourceDialog } from "@/components/doc-intel/SourceDialog";
import { SourceFilesTable } from "@/components/doc-intel/SourceFilesTable";
import { LastSyncSummary, SecretBadge, SourceStatusBadge } from "@/components/doc-intel/SyncBadges";
import { SyncRunsTable } from "@/components/doc-intel/SyncRunsTable";
import { AutoRefreshIndicator } from "@/components/system/AutoRefreshIndicator";
import type { DocIntelStatusOut, FileState, FileStatus, SourceOut } from "@/types/api";

const RUNS_PAGE_SIZE = 20;
const FILES_PAGE_SIZE = 25;
const ENTITIES_PAGE_SIZE = 25;
const DETAILS_ID = "sharepoint-sync-details";

type TabId = "runs" | "files" | "entities";

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString()} ${n === 1 ? one : many}`;
}

/** The module or the Flow 2 tables are missing, from /status (before any sources call). */
function moduleUnavailable(status: DocIntelStatusOut | undefined, error: unknown): DocIntelUnavailable | null {
  const fromError = docIntelUnavailable(error);
  if (fromError) return fromError;
  if (!status) return null;
  if (!status.installed) return notInstalled(status.detail);
  if (!status.enabled) {
    return {
      title: "Document intelligence is turned off",
      message: status.detail || "Set DOC_INTEL_ENABLED=true on the backend and restart it.",
    };
  }
  if (typeof status.crm_installed !== "boolean") {
    return {
      title: "SharePoint sync is not available",
      message: "This server's backend does not include SharePoint sync yet (its /status reports no crm_installed flag).",
    };
  }
  return status.crm_installed ? null : sharePointNotInstalled();
}

function ProblemNotice({ problem, onDismiss }: { problem: ActionProblem; onDismiss?: () => void }) {
  return (
    <Notice tone={problem.tone} title={problem.title} onDismiss={onDismiss}>
      {problem.message}
    </Notice>
  );
}

// ---- Source card -----------------------------------------------------------------------------

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-x-3 gap-y-0.5 py-1.5 first:pt-0 last:pb-0 sm:grid-cols-[7rem_minmax(0,1fr)]">
      <dt className="text-xs font-medium leading-5 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-ui text-foreground [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

const COUNT_TILES: { key: SourceCountKey; label: string; danger?: boolean }[] = [
  { key: "files_active", label: "Files" },
  { key: "files_failed", label: "Failed files", danger: true },
  { key: "files_deleted", label: "Deleted files" },
  { key: "entities_active", label: "CRM entities" },
];

function ActiveRunRow({ source }: { source: SourceOut }) {
  const run = source.active_run;
  if (!run || !isActiveRun(run)) return null;
  const queued = run.status === "QUEUED";
  const facts = queued
    ? []
    : [
        `${plural(run.files_seen, "file")} seen`,
        `${run.files_new.toLocaleString()} new`,
        `${run.files_changed.toLocaleString()} changed`,
        `${run.files_deleted.toLocaleString()} deleted`,
        run.files_failed > 0 ? `${run.files_failed.toLocaleString()} failed` : null,
      ].filter(Boolean);
  return (
    <div className="space-y-1.5 rounded-md border border-border bg-surface-muted px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Status
          tone={queued ? "neutral" : "warning"}
          pulse={!queued}
          label={queued ? "Sync queued, waiting for the sync worker" : "Sync running"}
        />
        <span className="text-xs text-muted-foreground">
          {queued ? (
            <>
              queued <RelativeTime value={run.created_at} />
            </>
          ) : run.started_at ? (
            <>
              started <RelativeTime value={run.started_at} />
            </>
          ) : null}
        </span>
      </div>
      <Progress label={queued ? "Sync queued" : "Sync progress"} size="sm" tone={queued ? "info" : "warning"} />
      {facts.length > 0 && <p className="text-xs tabular-nums text-muted-foreground">{facts.join(" · ")}</p>}
    </div>
  );
}

type SourceCardProps = {
  source: SourceOut;
  selected: boolean;
  showSelect: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

function SourceCard({ source, selected, showSelect, onSelect, onEdit, onDelete }: SourceCardProps) {
  const syncNow = useSyncSourceNow();
  const test = useTestSourceConnection();
  const toggle = useUpdateSource();
  const active = isActiveRun(source.active_run);
  const syncing = active || syncNow.isPending;
  const disabled = source.status !== "ACTIVE";
  const siteHref = safeExternalUrl(source.site_url);
  const titleId = `sharepoint-source-${source.id}`;

  const syncProblem = syncNow.isError ? describeActionError(syncNow.error, "Sync now", { syncConflict: true }) : null;
  const testProblem = test.isError ? describeActionError(test.error, "The connection test") : null;
  const toggleProblem = toggle.isError ? describeActionError(toggle.error, disabled ? "Enabling the source" : "Disabling the source") : null;
  const highlighted = selected && showSelect;

  return (
    <Card
      aria-labelledby={titleId}
      aria-current={highlighted ? "true" : undefined}
      className={cn("min-w-0 p-4", highlighted && "border-primary/60 shadow-[inset_3px_0_0_hsl(var(--primary))]")}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span aria-hidden="true" className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-muted text-muted-foreground">
            <FolderSync className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 id={titleId} className="break-words text-sm font-semibold text-foreground">
                <bdi>{source.name}</bdi>
              </h3>
              <SourceStatusBadge status={source.status} />
            </div>
            <p className="mt-0.5 break-words text-ui text-muted-foreground">
              <bdi>{source.account_name ?? (source.account_id != null ? `Account #${source.account_id}` : "No account")}</bdi>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            onClick={() =>
              syncNow.mutate(source.id, {
                onSuccess: () => toast.success("Sync queued", { description: source.name }),
              })
            }
            disabled={syncing || disabled}
            title={disabled ? "Enable the source to sync it" : undefined}
            loading={syncNow.isPending}
          >
            {!syncNow.isPending && <RefreshCw aria-hidden="true" className={cn("h-4 w-4", active && "motion-safe:animate-spin")} />}
            {syncing ? "Syncing…" : "Sync now"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => test.mutate(source.id)} loading={test.isPending}>
            {!test.isPending && <PlugZap aria-hidden="true" className="h-4 w-4" />}
            {test.isPending ? "Testing…" : "Test connection"}
          </Button>
          <RowActionsMenu
            label={`More actions for ${source.name}`}
            items={[
              { label: "Edit", icon: Pencil, onSelect: onEdit },
              {
                label: disabled ? "Enable" : "Disable",
                icon: disabled ? Power : PowerOff,
                disabled: toggle.isPending,
                onSelect: () =>
                  toggle.mutate(
                    { id: source.id, body: { status: disabled ? "ACTIVE" : "DISABLED" } },
                    { onSuccess: () => toast.success(disabled ? "Source enabled" : "Source disabled", { description: source.name }) },
                  ),
              },
              { label: "Delete", icon: Trash2, destructive: true, separatorBefore: true, onSelect: onDelete },
            ]}
          />
        </div>
      </div>

      {!source.credentials_readable && (
        <Notice tone="danger" title="The stored credentials can't be decrypted" className="mt-3">
          The server's encryption key is missing or was rotated. Edit the source and enter the Tenant ID, Client ID and client secret
          again.
        </Notice>
      )}

      <div className="mt-4 grid gap-x-8 gap-y-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <dl className="divide-y divide-border">
          <Fact label="Site">
            {siteHref ? (
              <a href={siteHref} target="_blank" rel="noreferrer noopener" className="font-mono text-xs text-primary underline-offset-2 hover:underline">
                {source.site_url}
                <ExternalLink aria-hidden="true" className="ml-1 inline h-3 w-3 align-[-1px]" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <span className="font-mono text-xs">{source.site_url || "—"}</span>
            )}
          </Fact>
          <Fact label="Folder">
            <span className="font-mono text-xs">
              {libraryLabel(source.drive_name)} · {folderLabel(source.folder_path)}
            </span>
            <span className="text-muted-foreground">{source.recursive ? " · with subfolders" : " · this folder only"}</span>
          </Fact>
          <Fact label="File types">{fileTypesLabel(source.file_extensions)}</Fact>
          <Fact label="Tenant ID">
            <span className="font-mono text-xs">{source.tenant_id || "—"}</span>
          </Fact>
          <Fact label="Client ID">
            <span className="font-mono text-xs">{source.client_id || "—"}</span>
          </Fact>
          <Fact label="Client secret">
            <SecretBadge source={source} />
          </Fact>
          <Fact label="Intelligence">
            {source.use_intelligence ? "LLM intelligence on" : "Local pattern rules (no document text leaves the server)"}
          </Fact>
        </dl>

        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Schedule</p>
            <p className="mt-0.5 break-words text-ui text-foreground">
              {scheduleSummary(source)}
              {source.sync_enabled && <span className="text-muted-foreground"> ({SCHEDULE_TIME_ZONE_LABEL})</span>}
            </p>
            {source.sync_enabled && disabled && <p className="text-xs text-muted-foreground">Paused while the source is disabled.</p>}
          </div>
          <div aria-live="polite">
            <ActiveRunRow source={source} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Last sync</p>
            <div className="mt-0.5">
              <LastSyncSummary source={source} />
            </div>
          </div>
          <StatGroup columns={4} variant="strip" aria-label={`${source.name} counts`}>
            {COUNT_TILES.map(({ key, label, danger }) => {
              const value = sourceCount(source, key);
              return (
                <Stat
                  key={key}
                  emphasis="secondary"
                  label={label}
                  value={<span className={danger && value ? "text-danger" : undefined}>{value == null ? "—" : formatNumber(value)}</span>}
                />
              );
            })}
          </StatGroup>
        </div>
      </div>

      {showSelect && (
        <div className="mt-3 flex justify-end border-t border-border pt-3">
          <Button variant="link" size="sm" className="h-7 px-0" aria-pressed={selected} onClick={onSelect}>
            {selected ? "Details shown below" : "View history, files and entities"}
          </Button>
        </div>
      )}

      {(syncProblem || testProblem || toggleProblem || test.data) && (
        <div className="mt-3 space-y-3">
          {syncProblem && <ProblemNotice problem={syncProblem} onDismiss={() => syncNow.reset()} />}
          {toggleProblem && <ProblemNotice problem={toggleProblem} onDismiss={() => toggle.reset()} />}
          {testProblem && <ProblemNotice problem={testProblem} onDismiss={() => test.reset()} />}
          {test.data && <ConnectionTestResult result={test.data} onDismiss={() => test.reset()} />}
        </div>
      )}
    </Card>
  );
}

// ---- Tabs ------------------------------------------------------------------------------------

function RunsTab({ source }: { source: SourceOut }) {
  const [offset, setOffset] = useState(0);
  const runs = useSyncRuns(source.id, { limit: RUNS_PAGE_SIZE, offset }, isActiveRun(source.active_run));
  return (
    <section aria-label="Sync history" className="space-y-3">
      <ErrorAlert message={runs.isError ? `Couldn't load the sync history: ${formatUserError(runs.error)}` : null} />
      <div aria-busy={runs.isPlaceholderData || undefined} className={cn("transition-opacity", runs.isPlaceholderData && "opacity-60")}>
        <SyncRunsTable
          runs={runs.data?.items ?? []}
          loading={runs.isLoading}
          pagination={{
            mode: "server",
            page: Math.floor(offset / RUNS_PAGE_SIZE) + 1,
            pageSize: RUNS_PAGE_SIZE,
            total: runs.data?.total ?? 0,
            onPageChange: (page) => setOffset((page - 1) * RUNS_PAGE_SIZE),
          }}
        />
      </div>
    </section>
  );
}

function FilesTab({ source }: { source: SourceOut }) {
  const [state, setState] = useState<"ALL" | FileState>("ALL");
  const [status, setStatus] = useState<"ALL" | FileStatus>("ALL");
  const [offset, setOffset] = useState(0);
  const active = isActiveRun(source.active_run);
  const files = useSourceFiles(
    source.id,
    {
      state: state === "ALL" ? undefined : state,
      status: status === "ALL" ? undefined : status,
      limit: FILES_PAGE_SIZE,
      offset,
    },
    active,
  );
  const retry = useRetrySourceFile();
  const retryProblem = retry.isError ? describeActionError(retry.error, "Retry") : null;
  const filtered = state !== "ALL" || status !== "ALL";
  const total = files.data?.total ?? 0;
  const anyProcessing = active || (files.data?.items ?? []).some((f) => f.status === "PROCESSING");

  function clearFilters() {
    setState("ALL");
    setStatus("ALL");
    setOffset(0);
  }

  return (
    <section aria-label="Files" className="space-y-3">
      {retryProblem && <ProblemNotice problem={retryProblem} onDismiss={() => retry.reset()} />}
      <ErrorAlert message={files.isError ? `Couldn't load the files: ${formatUserError(files.error)}` : null} />
      <div aria-busy={files.isPlaceholderData || undefined} className={cn("transition-opacity", files.isPlaceholderData && "opacity-60")}>
        <SourceFilesTable
          files={files.data?.items ?? []}
          loading={files.isLoading}
          pagination={{
            mode: "server",
            page: Math.floor(offset / FILES_PAGE_SIZE) + 1,
            pageSize: FILES_PAGE_SIZE,
            total,
            onPageChange: (page) => setOffset((page - 1) * FILES_PAGE_SIZE),
          }}
          empty={
            filtered
              ? {
                  title: "No files match these filters",
                  action: (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ),
                }
              : { title: "No files found yet", description: "Press Sync now to list the folder." }
          }
          toolbarEnd={anyProcessing ? <AutoRefreshIndicator intervalMs={SYNC_REFETCH_MS} fetching={files.isFetching} /> : undefined}
          toolbar={
            <FilterBar
              filters={[
                {
                  id: "sp-files-state",
                  label: "State",
                  value: state,
                  onChange: (v) => {
                    setState(v as "ALL" | FileState);
                    setOffset(0);
                  },
                  options: [{ value: "ALL", label: "All" }, ...FILE_STATES.map((s) => ({ value: s, label: FILE_STATE_LABELS[s] }))],
                },
                {
                  id: "sp-files-status",
                  label: "Status",
                  value: status,
                  onChange: (v) => {
                    setStatus(v as "ALL" | FileStatus);
                    setOffset(0);
                  },
                  options: [{ value: "ALL", label: "All" }, ...FILE_STATUSES.map((s) => ({ value: s, label: FILE_STATUS_LABELS[s] }))],
                },
              ]}
              onClear={clearFilters}
            />
          }
          onRetry={(file) => {
            const name = file.name?.trim() || `File #${file.id}`;
            retry.mutate(
              { fileId: file.id, sourceId: source.id },
              {
                // Retry only re-queues the file (PENDING); the source's next sync processes it.
                onSuccess: () =>
                  toast.info(`“${name}” is queued again`, {
                    description: `The next sync of this source processes it${active ? " (a sync is running now)" : ". Press Sync now to run one right away"}.`,
                  }),
              },
            );
          }}
          retryingId={retry.isPending ? retry.variables?.fileId : null}
        />
      </div>
    </section>
  );
}

function EntitiesTab({ source }: { source: SourceOut }) {
  const [filters, setFilters] = useState<CrmEntityFilters>(EMPTY_ENTITY_FILTERS);
  const [offset, setOffset] = useState(0);
  const entities = useCrmEntities({
    source_id: source.id,
    entity_type: filters.entityType || undefined,
    status: filters.status === "ALL" ? undefined : filters.status,
    q: filters.q || undefined,
    limit: ENTITIES_PAGE_SIZE,
    offset,
  });
  const onFiltersChange = useCallback((next: CrmEntityFilters) => {
    setFilters(next);
    setOffset(0);
  }, []);
  const total = entities.data?.total ?? 0;

  return (
    <section aria-label="Extracted CRM entities" className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Entities extracted from this source's files. Open a row for its fields and where each value was found.
      </p>
      <ErrorAlert message={entities.isError ? `Couldn't load the CRM entities: ${formatUserError(entities.error)}` : null} />
      <div aria-busy={entities.isPlaceholderData || undefined} className={cn("transition-opacity", entities.isPlaceholderData && "opacity-60")}>
        <CrmEntitiesTable
          entities={entities.data?.items ?? []}
          loading={entities.isLoading}
          filters={filters}
          onFiltersChange={onFiltersChange}
          pagination={{
            mode: "server",
            page: Math.floor(offset / ENTITIES_PAGE_SIZE) + 1,
            pageSize: ENTITIES_PAGE_SIZE,
            total,
            onPageChange: (page) => setOffset((page - 1) * ENTITIES_PAGE_SIZE),
          }}
        />
      </div>
    </section>
  );
}

// ---- Empty state -----------------------------------------------------------------------------

function NoSources({ onConnect, disabled }: { onConnect: () => void; disabled: boolean }) {
  return (
    <Card>
      <EmptyState
        icon={FolderSync}
        title="No folders connected yet"
        description={
          <>
            Connect a SharePoint or OneDrive folder: AIVA lists it read-only, processes new and changed PDF and Word files into the CRM
            store, and withdraws entities of deleted files. You need a Microsoft Entra app (Tenant ID, Client ID, client secret) with{" "}
            <span className="font-medium text-foreground">Sites.Read.All</span> and{" "}
            <span className="font-medium text-foreground">Files.Read.All</span> application permissions.
          </>
        }
        action={
          <Button onClick={onConnect} disabled={disabled}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            Connect a folder
          </Button>
        }
        className="[&>p:last-of-type]:max-w-xl"
      />
    </Card>
  );
}

// ---- Page ------------------------------------------------------------------------------------

export function SharePointSyncPage() {
  const status = useDocIntelStatus();
  const moduleProblem = moduleUnavailable(status.data, status.error);
  // Wait for /status (or its failure) so a server without V002 is not asked for sources at all.
  const sources = useSyncSources(moduleProblem == null && (status.data != null || status.isError));
  useRefreshWhenSyncsFinish(sources.data);
  const unavailable = moduleProblem ?? sharePointUnavailable(sources.error);

  const [dialog, setDialog] = useState<{ source: SourceOut | null } | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [tab, setTab] = useState<TabId>("runs");
  const [deleting, setDeleting] = useState<SourceOut | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const remove = useDeleteSource();

  const list = useMemo(() => (sources.data ?? []).filter((s) => s.status !== "DELETED"), [sources.data]);
  const selected = list.find((s) => s.id === selectedId) ?? list[0] ?? null;
  const st = status.data;
  const keyMissing = st?.secrets_key_configured === false;
  const scheduledSources = list.filter((s) => s.sync_enabled && s.status === "ACTIVE").length;
  const anyActive = list.some((s) => isActiveRun(s.active_run));

  function selectAndScroll(id: number) {
    setSelectedId(id);
    document.getElementById(DETAILS_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeleteError(null);
    try {
      await remove.mutateAsync(deleting.id);
      toast.success("Source deleted", { description: deleting.name });
      setDeleting(null);
    } catch (e) {
      setDeleteError(formatUserError(e));
    }
  }

  const heading = (
    <PageHeading
      title="SharePoint Sync"
      description="Connect SharePoint or OneDrive folders and sync their documents into the CRM store, on a schedule or with Sync now."
      actions={
        unavailable ? undefined : (
          <Button onClick={() => setDialog({ source: null })} disabled={keyMissing || status.isLoading}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            Connect a folder
          </Button>
        )
      }
    />
  );

  if (unavailable) {
    return (
      <Page width="wide">
        {heading}
        <Notice tone="danger" title={unavailable.title}>
          {unavailable.message}
        </Notice>
      </Page>
    );
  }

  return (
    <Page width="wide">
      {heading}

      {status.isError && <ErrorAlert message={`Couldn't load the module status: ${formatUserError(status.error)}`} />}
      {keyMissing && (
        <Notice tone="danger" title="Set DOC_INTEL_SECRETS_KEY on the server before saving credentials">
          Microsoft credentials are stored encrypted with this key. Until it is set in the backend .env and the backend restarted,
          sources can't be saved and stored credentials can't be read for tests or syncs. Generate a key with{" "}
          <code className="font-mono text-xs">python -m backend.doc_intel.crypto generate-key</code>.
        </Notice>
      )}
      {st && !st.scheduler_enabled && scheduledSources > 0 && (
        <Notice tone="warning" title="Automatic syncs are off on this server (DOC_INTEL_SCHEDULER_ENABLED=false); use Sync now">
          {scheduledSources === 1 ? "A source has" : `${scheduledSources} sources have`} an automatic schedule, but it won't run until
          the scheduler is turned on.
        </Notice>
      )}
      {st && !st.sync_worker_running && (
        <Notice tone="warning" title="The sync worker is not running">
          Sync now requests stay queued until the backend's sync worker starts.
        </Notice>
      )}
      {st && !st.extraction_available && (
        <Notice tone="warning" title="Text extraction is unavailable">
          {st.extraction_unavailable_reason || "The document extractor is not available on the server."} Synced files fail at the
          extraction stage until this is fixed.
        </Notice>
      )}
      <ErrorAlert message={sources.isError ? `Couldn't load the sources: ${formatUserError(sources.error)}` : null} />

      {/* isPending, not isLoading: while the query still waits for /status it is idle, and the empty
          state must not flash before the real list arrives. */}
      {sources.isPending ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      ) : sources.isError ? null : list.length === 0 ? (
        <NoSources onConnect={() => setDialog({ source: null })} disabled={keyMissing || status.isLoading} />
      ) : (
        <>
          <section aria-labelledby="sharepoint-sources-title" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="sharepoint-sources-title" className="text-base font-semibold text-foreground">
                Connected folders <span className="ml-1 text-sm font-normal text-muted-foreground">{list.length}</span>
              </h2>
              {anyActive && <AutoRefreshIndicator intervalMs={SYNC_REFETCH_MS} fetching={sources.isFetching} />}
            </div>
            <div className="space-y-3">
              {list.map((s) => (
                <SourceCard
                  key={s.id}
                  source={s}
                  selected={selected?.id === s.id}
                  showSelect={list.length > 1}
                  onSelect={() => selectAndScroll(s.id)}
                  onEdit={() => setDialog({ source: s })}
                  onDelete={() => {
                    setDeleteError(null);
                    setDeleting(s);
                  }}
                />
              ))}
            </div>
          </section>

          {selected && (
            <section id={DETAILS_ID} aria-labelledby={`${DETAILS_ID}-title`} className="scroll-mt-4 space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 id={`${DETAILS_ID}-title`} className="min-w-0 break-words text-base font-semibold text-foreground">
                  <bdi>{selected.name}</bdi>: sync details
                </h2>
                {list.length > 1 && (
                  <Select
                    aria-label="Source"
                    value={String(selected.id)}
                    onChange={(e) => setSelectedId(Number(e.target.value))}
                    className="w-full sm:w-72"
                    controlSize="sm"
                  >
                    {list.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
              <Tabs value={tab} onValueChange={(v) => setTab(v as TabId)}>
                <TabsList aria-label="Sync details">
                  <TabsTrigger value="runs">Sync history</TabsTrigger>
                  <TabsTrigger value="files">Files</TabsTrigger>
                  <TabsTrigger value="entities">Extracted CRM entities</TabsTrigger>
                </TabsList>
                <TabsContent value="runs">
                  <RunsTab key={selected.id} source={selected} />
                </TabsContent>
                <TabsContent value="files">
                  <FilesTab key={selected.id} source={selected} />
                </TabsContent>
                <TabsContent value="entities">
                  <EntitiesTab key={selected.id} source={selected} />
                </TabsContent>
              </Tabs>
            </section>
          )}
        </>
      )}

      {dialog && (
        <SourceDialog
          source={dialog.source}
          secretsKeyConfigured={!keyMissing}
          schedulerEnabled={st?.scheduler_enabled ?? true}
          onClose={() => setDialog(null)}
          onSaved={(saved) => {
            if (!dialog.source) setSelectedId(saved.id);
          }}
        />
      )}
      <ConfirmDialog
        open={deleting != null}
        title="Delete this source?"
        message={
          deleting
            ? `“${deleting.name}” stops syncing and is removed from this page, and its stored client secret is erased. Its sync history is kept, and its extracted CRM entities are kept as withdrawn. A source cannot be deleted while a sync is queued or running: wait for it to finish first.`
            : ""
        }
        confirmLabel="Delete"
        loadingLabel="Deleting…"
        destructive
        loading={remove.isPending}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (remove.isPending) return;
          setDeleting(null);
          setDeleteError(null);
        }}
      />
    </Page>
  );
}
