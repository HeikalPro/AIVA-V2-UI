import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  ExternalLink,
  FolderSync,
  Loader2,
  Pencil,
  PlugZap,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { formatUserError } from "@/lib/errors";
import { docIntelUnavailable, formatWhen, notInstalled, type DocIntelUnavailable } from "@/lib/doc-intel";
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
import { PageHeader } from "@/components/shared/PageHeader";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ConnectionTestResult } from "@/components/doc-intel/ConnectionTestResult";
import { CrmEntitiesTable, EMPTY_ENTITY_FILTERS, type CrmEntityFilters } from "@/components/doc-intel/CrmEntitiesTable";
import { ListPager } from "@/components/doc-intel/ListPager";
import { Notice } from "@/components/doc-intel/Notice";
import { SourceDialog } from "@/components/doc-intel/SourceDialog";
import { SourceFilesTable } from "@/components/doc-intel/SourceFilesTable";
import { LastSyncSummary, SecretBadge, SourceStatusBadge } from "@/components/doc-intel/SyncBadges";
import { SyncRunsTable } from "@/components/doc-intel/SyncRunsTable";
import type { DocIntelStatusOut, FileState, FileStatus, SourceOut } from "@/types/api";

const RUNS_PAGE_SIZE = 20;
const FILES_PAGE_SIZE = 25;
const ENTITIES_PAGE_SIZE = 25;
const DETAILS_ID = "sharepoint-sync-details";

type TabId = "runs" | "files" | "entities";

const TABS: { id: TabId; label: string }[] = [
  { id: "runs", label: "Sync history" },
  { id: "files", label: "Files" },
  { id: "entities", label: "CRM entities" },
];

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

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">{children}</div>
  );
}

// ---- Source card -----------------------------------------------------------------------------

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      {/* Stacked on phones: space between facts, not between a label and its value. */}
      <dt className="mt-2 text-xs font-medium text-muted-foreground first:mt-0 sm:mt-0 sm:pt-0.5">{label}</dt>
      <dd className="min-w-0 break-words text-sm text-foreground">{children}</dd>
    </>
  );
}

const COUNT_TILES: { key: SourceCountKey; label: string; tone?: "red" }[] = [
  { key: "files_active", label: "Files" },
  { key: "files_failed", label: "Failed files", tone: "red" },
  { key: "files_deleted", label: "Deleted files" },
  { key: "entities_active", label: "CRM entities" },
];

function ActiveRunBanner({ source }: { source: SourceOut }) {
  const run = source.active_run;
  if (!run || !isActiveRun(run)) return null;
  const queued = run.status === "QUEUED";
  const facts = queued
    ? [`queued ${formatWhen(run.created_at)}`]
    : [
        run.started_at ? `started ${formatWhen(run.started_at)}` : null,
        `${plural(run.files_seen, "file")} seen`,
        `${run.files_new.toLocaleString()} new`,
        `${run.files_changed.toLocaleString()} changed`,
        `${run.files_deleted.toLocaleString()} deleted`,
        run.files_failed > 0 ? `${run.files_failed.toLocaleString()} failed` : null,
      ].filter(Boolean);
  return (
    <div className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
      <Loader2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />
      <div className="min-w-0">
        <p className="font-medium text-primary">{queued ? "Sync queued, waiting for the sync worker" : "Sync running"}</p>
        <p className="break-words text-xs text-muted-foreground">{facts.join(" · ")}</p>
      </div>
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
  const toggleProblem = toggle.isError
    ? describeActionError(toggle.error, disabled ? "Enabling the source" : "Disabling the source")
    : null;

  return (
    <article
      aria-labelledby={titleId}
      aria-current={selected && showSelect ? "true" : undefined}
      className={`min-w-0 rounded-xl border bg-card p-5 shadow-sm ${selected && showSelect ? "border-primary/60 ring-1 ring-primary/30" : "border-border"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <FolderSync aria-hidden="true" className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 id={titleId} className="break-words text-base font-semibold text-foreground">
              {source.name}
            </h3>
            <p className="break-words text-sm text-muted-foreground">
              {source.account_name ?? (source.account_id != null ? `Account #${source.account_id}` : "No account")}
            </p>
          </div>
        </div>
        <SourceStatusBadge status={source.status} />
      </div>

      {!source.credentials_readable && (
        <Notice tone="danger" title="The stored credentials can't be decrypted" className="mt-4">
          The server's encryption key is missing or was rotated. Edit the source and enter the Tenant ID, Client ID and
          client secret again.
        </Notice>
      )}

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <dl className="grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-y-2">
          <Fact label="Site">
            {siteHref ? (
              // Inline (not flex) so a long URL wraps and the icon follows its last line.
              <a
                href={siteHref}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary underline-offset-2 [overflow-wrap:anywhere] hover:underline"
              >
                {source.site_url}
                <ExternalLink aria-hidden="true" className="ml-1 inline h-3 w-3 align-[-1px]" />
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ) : (
              <span className="[overflow-wrap:anywhere]">{source.site_url || "—"}</span>
            )}
          </Fact>
          <Fact label="Library">{libraryLabel(source.drive_name)}</Fact>
          <Fact label="Folder">
            <span className="[overflow-wrap:anywhere]">{folderLabel(source.folder_path)}</span>
            <span className="text-muted-foreground">{source.recursive ? " · with subfolders" : " · this folder only"}</span>
          </Fact>
          <Fact label="File types">{fileTypesLabel(source.file_extensions)}</Fact>
          <Fact label="Tenant ID">
            <span className="font-mono text-xs [overflow-wrap:anywhere]">{source.tenant_id || "—"}</span>
          </Fact>
          <Fact label="Client ID">
            <span className="font-mono text-xs [overflow-wrap:anywhere]">{source.client_id || "—"}</span>
          </Fact>
          <Fact label="Client secret">
            <SecretBadge source={source} />
          </Fact>
          <Fact label="CRM intelligence">
            {source.use_intelligence ? "LLM intelligence on" : "Local pattern rules (no document text leaves the server)"}
          </Fact>
        </dl>

        <div className="min-w-0 space-y-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Schedule</p>
            <p className="mt-0.5 break-words text-sm text-foreground">
              {scheduleSummary(source)}
              {source.sync_enabled && <span className="text-muted-foreground"> ({SCHEDULE_TIME_ZONE_LABEL})</span>}
            </p>
            {source.sync_enabled && disabled && (
              <p className="text-xs text-muted-foreground">Paused while the source is disabled.</p>
            )}
          </div>
          <div aria-live="polite">
            <ActiveRunBanner source={source} />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground">Last sync</p>
            <div className="mt-0.5">
              <LastSyncSummary source={source} />
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {COUNT_TILES.map(({ key, label, tone }) => {
              const value = sourceCount(source, key);
              return (
                <div key={key} className="rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <dt className="text-[11px] leading-tight text-muted-foreground">{label}</dt>
                  <dd
                    className={`text-lg font-bold tabular-nums ${tone === "red" && value ? "text-red-700" : "text-foreground"}`}
                  >
                    {value == null ? "—" : value.toLocaleString()}
                  </dd>
                </div>
              );
            })}
          </dl>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
        <Button
          onClick={() => syncNow.mutate(source.id)}
          disabled={syncing || disabled}
          title={disabled ? "Enable the source to sync it" : undefined}
        >
          {syncing ? (
            <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
          )}
          {syncing ? "Syncing…" : "Sync now"}
        </Button>
        <Button variant="outline" onClick={() => test.mutate(source.id)} disabled={test.isPending}>
          {test.isPending ? (
            <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PlugZap aria-hidden="true" className="mr-2 h-4 w-4" />
          )}
          {test.isPending ? "Testing…" : "Test connection"}
        </Button>
        <Button variant="outline" onClick={onEdit}>
          <Pencil aria-hidden="true" className="mr-2 h-4 w-4" /> Edit
        </Button>
        <Button
          variant="outline"
          disabled={toggle.isPending}
          onClick={() => toggle.mutate({ id: source.id, body: { status: disabled ? "ACTIVE" : "DISABLED" } })}
        >
          {toggle.isPending ? (
            <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
          ) : disabled ? (
            <Power aria-hidden="true" className="mr-2 h-4 w-4" />
          ) : (
            <PowerOff aria-hidden="true" className="mr-2 h-4 w-4" />
          )}
          {disabled ? "Enable" : "Disable"}
        </Button>
        <Button variant="ghost" onClick={onDelete}>
          <Trash2 aria-hidden="true" className="mr-2 h-4 w-4 text-red-600" /> Delete
        </Button>
        {showSelect && (
          <Button variant="link" className="px-1 sm:ml-auto" aria-pressed={selected} onClick={onSelect}>
            {selected ? "Details shown below" : "View history, files & entities"}
          </Button>
        )}
      </div>

      {(syncProblem || testProblem || toggleProblem || test.data) && (
        <div className="mt-4 space-y-3">
          {syncProblem && <ProblemNotice problem={syncProblem} onDismiss={() => syncNow.reset()} />}
          {toggleProblem && <ProblemNotice problem={toggleProblem} onDismiss={() => toggle.reset()} />}
          {testProblem && <ProblemNotice problem={testProblem} onDismiss={() => test.reset()} />}
          {test.data && <ConnectionTestResult result={test.data} onDismiss={() => test.reset()} />}
        </div>
      )}
    </article>
  );
}

// ---- Tabs ------------------------------------------------------------------------------------

function RunsTab({ source }: { source: SourceOut }) {
  const [offset, setOffset] = useState(0);
  const runs = useSyncRuns(source.id, { limit: RUNS_PAGE_SIZE, offset }, isActiveRun(source.active_run));
  return (
    <section aria-label="Sync history" className="space-y-3">
      <ErrorAlert message={runs.isError ? `Couldn't load the sync history: ${formatUserError(runs.error)}` : null} />
      <div aria-busy={runs.isPlaceholderData} className={`transition-opacity ${runs.isPlaceholderData ? "opacity-60" : ""}`}>
        <SyncRunsTable runs={runs.data?.items ?? []} loading={runs.isLoading} />
      </div>
      <ListPager
        offset={offset}
        limit={RUNS_PAGE_SIZE}
        total={runs.data?.total ?? 0}
        onChange={setOffset}
        label="Sync history pages"
      />
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
  // Retry only re-queues the file (PENDING); the source's next sync processes it.
  const [retried, setRetried] = useState<string | null>(null);
  const filtered = state !== "ALL" || status !== "ALL";
  const total = files.data?.total ?? 0;

  return (
    <section aria-label="Files" className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="w-full lg:w-44">
            <Label htmlFor="sp-files-state">State</Label>
            <Select
              id="sp-files-state"
              value={state}
              onChange={(e) => {
                setState(e.target.value as "ALL" | FileState);
                setOffset(0);
              }}
              className="mt-1"
            >
              <option value="ALL">All states</option>
              {FILE_STATES.map((s) => (
                <option key={s} value={s}>
                  {FILE_STATE_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full lg:w-48">
            <Label htmlFor="sp-files-status">Status</Label>
            <Select
              id="sp-files-status"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value as "ALL" | FileStatus);
                setOffset(0);
              }}
              className="mt-1"
            >
              <option value="ALL">All statuses</option>
              {FILE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {FILE_STATUS_LABELS[s]}
                </option>
              ))}
            </Select>
          </div>
          {filtered && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setState("ALL");
                setStatus("ALL");
                setOffset(0);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground" aria-live="polite">
          {files.data ? plural(total, "file") : files.isLoading ? "Loading files…" : "—"}
          {active ? " · refreshing every 3 s while a sync runs" : ""}
        </p>
      </div>

      {retryProblem && <ProblemNotice problem={retryProblem} onDismiss={() => retry.reset()} />}
      {retried && !retryProblem && (
        <Notice tone="info" title={`“${retried}” is queued again`} onDismiss={() => setRetried(null)}>
          The next sync of this source processes it{active ? " (a sync is running now)" : ". Press Sync now to run one right away"}.
        </Notice>
      )}
      <ErrorAlert message={files.isError ? `Couldn't load the files: ${formatUserError(files.error)}` : null} />
      <div aria-busy={files.isPlaceholderData} className={`transition-opacity ${files.isPlaceholderData ? "opacity-60" : ""}`}>
        <SourceFilesTable
          files={files.data?.items ?? []}
          loading={files.isLoading}
          emptyMessage={filtered ? "No files match these filters." : "No files found yet. Press Sync now to list the folder."}
          onRetry={(file) => {
            setRetried(null);
            retry.mutate(
              { fileId: file.id, sourceId: source.id },
              { onSuccess: () => setRetried(file.name?.trim() || `File #${file.id}`) },
            );
          }}
          retryingId={retry.isPending ? retry.variables?.fileId : null}
        />
      </div>
      <ListPager offset={offset} limit={FILES_PAGE_SIZE} total={total} onChange={setOffset} label="Files pages" />
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
    <section aria-label="CRM entities" className="space-y-4">
      <p className="text-xs text-muted-foreground" aria-live="polite">
        {entities.data ? plural(total, "entity", "entities") : entities.isLoading ? "Loading entities…" : "—"} extracted from
        this source's files. Click a row for its fields and where each value was found.
      </p>
      <ErrorAlert message={entities.isError ? `Couldn't load the CRM entities: ${formatUserError(entities.error)}` : null} />
      <div aria-busy={entities.isPlaceholderData} className={`transition-opacity ${entities.isPlaceholderData ? "opacity-60" : ""}`}>
        <CrmEntitiesTable
          entities={entities.data?.items ?? []}
          loading={entities.isLoading}
          filters={filters}
          onFiltersChange={onFiltersChange}
        />
      </div>
      <ListPager offset={offset} limit={ENTITIES_PAGE_SIZE} total={total} onChange={setOffset} label="CRM entities pages" />
    </section>
  );
}

// ---- Empty state -----------------------------------------------------------------------------

function EmptyState({ onConnect, disabled }: { onConnect: () => void; disabled: boolean }) {
  return (
    <section aria-labelledby="sharepoint-empty-title" className="rounded-xl border border-dashed border-border bg-card p-6 sm:p-8">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <FolderSync aria-hidden="true" className="h-6 w-6" />
        </div>
        <h2 id="sharepoint-empty-title" className="mt-4 text-lg font-semibold text-foreground">
          No folders connected yet
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Connect a SharePoint or OneDrive folder. AIVA checks it for new, changed and deleted files, on a schedule or
          when you press Sync now, and extracts organizations, contacts and document references into the CRM store.
        </p>
      </div>
      <div className="mx-auto mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">What it does</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>Lists the folder (and its subfolders, if you choose) with read-only access.</li>
            <li>
              Processes new and changed PDF and Word files: download, extraction, CRM intelligence, entities, save to the
              CRM store.
            </li>
            <li>Withdraws the entities of files that were deleted from the folder.</li>
          </ul>
        </div>
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">What you need</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>A Microsoft Entra app registration: its Tenant ID, Client ID and a client secret.</li>
            <li>
              The <span className="font-medium text-foreground">Sites.Read.All</span> and{" "}
              <span className="font-medium text-foreground">Files.Read.All</span> application permissions, with admin
              consent.
            </li>
            <li>The site URL and, optionally, the library and folder to sync.</li>
          </ul>
        </div>
      </div>
      <div className="mt-6 text-center">
        <Button onClick={onConnect} disabled={disabled}>
          <Plus aria-hidden="true" className="mr-2 h-4 w-4" /> Connect a folder
        </Button>
      </div>
    </section>
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
      setDeleting(null);
    } catch (e) {
      setDeleteError(formatUserError(e));
    }
  }

  const header = (
    <PageHeader
      icon={FolderSync}
      title="SharePoint Sync"
      description="Connect SharePoint or OneDrive folders and sync their documents into the CRM store, automatically on a schedule or with Sync now."
      actions={
        unavailable ? undefined : (
          <Button onClick={() => setDialog({ source: null })} disabled={keyMissing || status.isLoading}>
            <Plus aria-hidden="true" className="mr-2 h-4 w-4" /> Connect a folder
          </Button>
        )
      }
    />
  );

  if (unavailable) {
    return (
      <div className="space-y-6">
        {header}
        <Notice tone="danger" title={unavailable.title}>
          {unavailable.message}
        </Notice>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {status.isError && (
        <ErrorAlert message={`Couldn't load the module status: ${formatUserError(status.error)}`} />
      )}
      {keyMissing && (
        <Notice tone="danger" title="Set DOC_INTEL_SECRETS_KEY on the server before saving credentials">
          Microsoft credentials are stored encrypted with this key. Until it is set in the backend .env and the backend
          restarted, sources can't be saved and stored credentials can't be read for tests or syncs. Generate a key with{" "}
          <code className="font-mono text-xs">python -m backend.doc_intel.crypto generate-key</code>.
        </Notice>
      )}
      {st && !st.scheduler_enabled && scheduledSources > 0 && (
        <Notice tone="warning" title="Automatic syncs are off on this server (DOC_INTEL_SCHEDULER_ENABLED=false); use Sync now">
          {scheduledSources === 1 ? "A source has" : `${scheduledSources} sources have`} an automatic schedule, but it
          won't run until the scheduler is turned on.
        </Notice>
      )}
      {st && !st.sync_worker_running && (
        <Notice tone="warning" title="The sync worker is not running">
          Sync now requests stay queued until the backend's sync worker starts.
        </Notice>
      )}
      {st && !st.extraction_available && (
        <Notice tone="warning" title="Text extraction is unavailable">
          {st.extraction_unavailable_reason || "The document extractor is not available on the server."} Synced files
          fail at the extraction stage until this is fixed.
        </Notice>
      )}
      <ErrorAlert message={sources.isError ? `Couldn't load the sources: ${formatUserError(sources.error)}` : null} />

      {/* isPending, not isLoading: while the query still waits for /status it is idle, and the empty
          state must not flash before the real list arrives. */}
      {sources.isPending ? (
        <Placeholder>Loading sources…</Placeholder>
      ) : sources.isError ? null : list.length === 0 ? (
        <EmptyState onConnect={() => setDialog({ source: null })} disabled={keyMissing || status.isLoading} />
      ) : (
        <>
          <section aria-labelledby="sharepoint-sources-title" className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="sharepoint-sources-title" className="text-lg font-semibold text-foreground">
                Connected folders
              </h2>
              <p className="text-xs text-muted-foreground" aria-live="polite">
                {plural(list.length, "source")}
                {anyActive ? " · refreshing every 3 s while a sync runs" : ""}
              </p>
            </div>
            <div className="space-y-4">
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
            <section id={DETAILS_ID} aria-labelledby={`${DETAILS_ID}-title`} className="scroll-mt-20 space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <h2 id={`${DETAILS_ID}-title`} className="min-w-0 break-words text-lg font-semibold text-foreground">
                  {selected.name}: sync details
                </h2>
                {list.length > 1 && (
                  <div className="w-full sm:w-72">
                    <Label htmlFor="sharepoint-details-source">Source</Label>
                    <Select
                      id="sharepoint-details-source"
                      value={String(selected.id)}
                      onChange={(e) => setSelectedId(Number(e.target.value))}
                      className="mt-1"
                    >
                      {list.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>
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
              {tab === "runs" && <RunsTab key={selected.id} source={selected} />}
              {tab === "files" && <FilesTab key={selected.id} source={selected} />}
              {tab === "entities" && <EntitiesTab key={selected.id} source={selected} />}
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
            ? `“${deleting.name}” stops syncing and is removed from this page, and its stored client secret is erased. Its sync history is kept, and its extracted CRM entities are kept as withdrawn. A source cannot be deleted while a sync is queued or running — wait for it to finish first.`
            : ""
        }
        confirmLabel="Delete"
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
    </div>
  );
}
