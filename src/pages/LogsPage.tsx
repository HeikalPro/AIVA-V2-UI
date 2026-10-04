import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertCircle, Building2, History, KeyRound, RefreshCw, Search, Sparkles, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { ROLES } from "@/lib/roles";
import { useAgentMetrics } from "@/hooks/useAnalytics";
import { useActivityLogs, useAiRequestLogs, useRagLogs, useSignInLogs } from "@/hooks/useLogs";
import { filterRows } from "@/lib/table-filters";
import { formatUserError } from "@/lib/errors";
import { formatDurationMs, formatNumber } from "@/lib/format";
import { Page, PageHeading } from "@/components/shell/page";
import { DataTable, type Column, type DataTableEmpty } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ErrorLogsPanel } from "@/components/logs/ErrorLogsPanel";
import { FailureReasonsPopover } from "@/components/logs/FailureReasonsPopover";
import { AiMetricsPanel } from "@/components/logs/AiMetricsPanel";
import { ApiRequestsPanel } from "@/components/logs/ApiRequestsPanel";
import { LogDetailsSheet } from "@/components/logs/LogDetailsSheet";
import { LogResultStatus, LogSourceBadge, LogTime, SignInEventStatus } from "@/components/logs/log-cells";
import { AutoRefreshIndicator } from "@/components/system/AutoRefreshIndicator";
import { SystemComponentsSection } from "@/components/system/SystemComponentsSection";
import { SystemResourcesSection } from "@/components/system/SystemResourcesSection";
import type { AgentMetric, AiRequest, AuditLog, HttpRequestLog, RagRetrieval, SignInLog } from "@/types/api";

type TabId = "activity" | "sign-in" | "agents" | "api" | "rag" | "ai-requests" | "errors" | "system";

type LogRow = AuditLog | SignInLog | AgentMetric | RagRetrieval | AiRequest | HttpRequestLog;

/** Display only: mirrors LIVE_LOG_REFETCH_MS in hooks/useLogs (retrievals and AI requests poll every 10 s). */
const LIVE_LOGS_REFRESH_MS = 10_000;

function agentLabel(row: AgentMetric): string {
  const name = [row.agent_first_name, row.agent_last_name].filter(Boolean).join(" ").trim();
  return name || row.agent_email || `User #${row.user_id}`;
}

function humanizeToken(value: string | null | undefined): string {
  const text = (value ?? "").replace(/[_-]+/g, " ").trim().toLowerCase();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "—";
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

function RefreshAction({ label, onClick, busy, intervalMs }: { label: string; onClick: () => void; busy: boolean; intervalMs?: number }) {
  return (
    <div className="flex items-center gap-2">
      {intervalMs != null && <AutoRefreshIndicator intervalMs={intervalMs} fetching={busy} />}
      <IconButton
        label={label}
        icon={RefreshCw}
        variant="outline"
        size="sm"
        disabled={busy}
        className={busy ? "[&_svg]:motion-safe:animate-spin" : undefined}
        onClick={onClick}
      />
    </div>
  );
}

function TabIntro({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-sm text-muted-foreground">{children}</p>
      {aside}
    </div>
  );
}

export function LogsPage() {
  const { user } = useAuth();
  const workspace = useWorkspace();
  const [searchParams] = useSearchParams();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN) ?? false;
  const isOrgAdmin = user?.roles.includes(ROLES.ORG_ADMIN) ?? false;
  const isSupervisor = user?.roles.includes(ROLES.SUPERVISOR) ?? false;
  const isDeveloper = user?.roles.includes(ROLES.DEVELOPER) ?? false;
  const isAccountManager = user?.roles.includes(ROLES.ACCOUNT_MANAGER) ?? false;

  const canSeeAiLogs = isSuperAdmin || isOrgAdmin || isDeveloper;
  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: "activity", label: "Activity audit", show: isSuperAdmin || isOrgAdmin || isSupervisor },
    { id: "sign-in", label: "Sign-in events", show: isSuperAdmin || isOrgAdmin },
    { id: "agents", label: "Agent activity", show: isSuperAdmin || isOrgAdmin || isSupervisor || isAccountManager },
    { id: "api", label: "API requests", show: canSeeAiLogs },
    { id: "rag", label: "Knowledge search", show: canSeeAiLogs },
    { id: "ai-requests", label: "AI requests", show: canSeeAiLogs },
    { id: "errors", label: "Error logs", show: canSeeAiLogs },
    { id: "system", label: "System health", show: isSuperAdmin || isDeveloper },
  ];
  const visibleTabs = tabs.filter((t) => t.show);
  const [tab, setTab] = useState<TabId>(visibleTabs[0]?.id ?? "activity");
  const [selectedRow, setSelectedRow] = useState<LogRow | null>(null);

  // Same list the page loaded before the shell existed: useAccounts(isSuperAdmin ? null : org).
  const accounts = workspace.accounts;
  const selectedAccountId = workspace.accountId;
  const [activityAccountFilter, setActivityAccountFilter] = useState("ALL");

  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [entityFilter, setEntityFilter] = useState("ALL");
  const [eventFilter, setEventFilter] = useState("ALL");

  const activity = useActivityLogs(
    {
      account_id: activityAccountFilter === "ALL" ? undefined : Number(activityAccountFilter),
      action_type: actionFilter === "ALL" ? undefined : actionFilter,
      entity_type: entityFilter === "ALL" ? undefined : entityFilter,
    },
    tab === "activity",
  );
  const signIn = useSignInLogs({ event_type: eventFilter === "ALL" ? undefined : eventFilter }, tab === "sign-in");
  const agents = useAgentMetrics(selectedAccountId, tab === "agents" && selectedAccountId != null);
  const agentMetrics = useMemo(() => agents.data ?? [], [agents.data]);
  const rag = useRagLogs({ status: eventFilter === "ALL" ? undefined : eventFilter }, tab === "rag");
  const ai = useAiRequestLogs({ status: eventFilter === "ALL" ? undefined : eventFilter }, tab === "ai-requests");

  const activityRows = useMemo(
    () =>
      filterRows(activity.data?.items ?? [], search, (r) =>
        [r.summary ?? "", r.actor_email ?? "", r.action_type, r.entity_type, r.entity_id, r.new_value ?? "", r.ip_address ?? ""].join(" "),
      ),
    [activity.data, search],
  );

  const signInRows = useMemo(
    () =>
      filterRows(signIn.data?.items ?? [], search, (r) =>
        [r.summary ?? "", r.user_email ?? "", r.event_type, r.ip_address ?? "", r.user_agent ?? ""].join(" "),
      ),
    [signIn.data, search],
  );

  const agentRows = useMemo(
    () =>
      filterRows(agentMetrics, search, (r) =>
        [agentLabel(r), r.agent_email ?? "", String(r.ai_usage_count ?? ""), String(r.escalation_count ?? "")].join(" "),
      ),
    [agentMetrics, search],
  );

  const ragRows = useMemo(
    () =>
      filterRows(rag.data?.items ?? [], search, (r) =>
        [r.summary ?? "", r.query_text ?? "", r.status, r.account_name ?? "", r.error_message ?? ""].join(" "),
      ),
    [rag.data, search],
  );

  const aiRows = useMemo(
    () =>
      filterRows(ai.data?.items ?? [], search, (r) =>
        [r.summary ?? "", r.model_name ?? "", r.provider ?? "", r.status ?? "", r.account_name ?? "", r.error_message ?? ""].join(" "),
      ),
    [ai.data, search],
  );

  const activityColumns: Column<AuditLog>[] = [
    { key: "created_at", header: "Time", sortable: true, render: (r) => <LogTime value={r.created_at} /> },
    {
      key: "actor",
      header: "Actor",
      truncate: true,
      maxWidth: "14rem",
      render: (r) => r.actor_email ?? (r.user_id ? `#${r.user_id}` : "—"),
    },
    { key: "action_type", header: "Action", render: (r) => <Badge variant="neutral">{humanizeToken(r.action_type)}</Badge> },
    {
      key: "entity",
      header: "Entity",
      render: (r) => (
        <span className="whitespace-nowrap">
          {humanizeToken(r.entity_type)} <span className="font-mono text-xs text-muted-foreground">#{r.entity_id}</span>
        </span>
      ),
    },
    {
      key: "summary",
      header: "Summary",
      truncate: true,
      maxWidth: "32rem",
      cellTitle: (r) => r.summary ?? undefined,
      render: (r) => <span dir="auto">{r.summary ?? `${r.action_type} ${r.entity_type} #${r.entity_id}`}</span>,
    },
    { key: "ip_address", header: "IP", render: (r) => <span className="font-mono text-xs">{r.ip_address ?? "—"}</span> },
  ];

  const signInColumns: Column<SignInLog>[] = [
    { key: "created_at", header: "Time", sortable: true, render: (r) => <LogTime value={r.created_at} /> },
    { key: "event_type", header: "Event", sortable: true, render: (r) => <SignInEventStatus value={r.event_type} /> },
    {
      key: "user_email",
      header: "User",
      truncate: true,
      maxWidth: "16rem",
      render: (r) => r.user_email ?? (r.user_id ? `#${r.user_id}` : "—"),
    },
    {
      key: "summary",
      header: "Summary",
      truncate: true,
      maxWidth: "26rem",
      render: (r) => r.summary ?? `${r.user_email ?? `#${r.user_id}`} ${r.event_type}`,
    },
    { key: "ip_address", header: "IP", render: (r) => <span className="font-mono text-xs">{r.ip_address ?? "—"}</span> },
    { key: "user_agent", header: "Device", truncate: true, maxWidth: "16rem", render: (r) => r.user_agent ?? "—" },
  ];

  const agentColumns: Column<AgentMetric>[] = [
    {
      key: "agent",
      header: "Agent",
      sortable: true,
      sortValue: (r) => agentLabel(r).toLowerCase(),
      render: (r) => {
        const name = agentLabel(r);
        return (
          <div className="min-w-0 max-w-[18rem]">
            <p className="truncate font-medium text-foreground" title={name}>
              <bdi>{name}</bdi>
            </p>
            {r.agent_email && r.agent_email !== name && <p className="truncate text-xs text-muted-foreground">{r.agent_email}</p>}
          </div>
        );
      },
    },
    { key: "ai_usage_count", header: "AI requests", numeric: true, sortable: true, render: (r) => formatNumber(r.ai_usage_count) },
    { key: "successful_answers", header: "Successful", numeric: true, sortable: true, render: (r) => formatNumber(r.successful_answers) },
    {
      key: "failed_answers",
      header: "Failed",
      numeric: true,
      sortable: true,
      render: (r) => {
        const n = r.failed_answers ?? 0;
        if (n <= 0) return formatNumber(r.failed_answers);
        return (
          <span className="inline-flex items-center justify-end gap-1">
            <FailureReasonsPopover reasons={r.failure_reasons} />
            <span className="font-medium text-danger">{formatNumber(n)}</span>
          </span>
        );
      },
    },
    { key: "escalation_count", header: "Escalations", numeric: true, sortable: true, render: (r) => formatNumber(r.escalation_count) },
    { key: "avg_response_time", header: "Avg response", numeric: true, sortable: true, render: (r) => formatDurationMs(r.avg_response_time) },
  ];

  const ragColumns: Column<RagRetrieval>[] = [
    { key: "created_at", header: "Time", sortable: true, render: (r) => <LogTime value={r.created_at} /> },
    { key: "status", header: "Result", sortable: true, render: (r) => <LogResultStatus value={r.status} /> },
    { key: "source", header: "Source", render: (r) => <LogSourceBadge value={r.source} /> },
    {
      key: "query_text",
      header: "Query",
      truncate: true,
      maxWidth: "26rem",
      cellTitle: (r) => r.query_text ?? undefined,
      render: (r) => <span dir="auto">{r.query_text ?? "—"}</span>,
    },
    { key: "chunks_returned", header: "Chunks", numeric: true, sortable: true, render: (r) => formatNumber(r.chunks_returned) },
    {
      key: "top_score",
      header: "Top score",
      numeric: true,
      sortable: true,
      render: (r) => (r.top_score != null ? r.top_score.toFixed(3) : "—"),
    },
    { key: "retrieval_ms", header: "Retrieval", numeric: true, sortable: true, render: (r) => formatDurationMs(r.retrieval_ms) },
    {
      key: "account",
      header: "Account",
      truncate: true,
      maxWidth: "12rem",
      render: (r) => (r.account_name ? <bdi>{r.account_name}</bdi> : r.account_id ? `#${r.account_id}` : "—"),
    },
  ];

  const aiColumns: Column<AiRequest>[] = [
    { key: "id", header: "Request", sortable: true, render: (r) => <span className="font-mono text-xs">#{r.id}</span> },
    { key: "created_at", header: "Time", sortable: true, render: (r) => <LogTime value={r.created_at} /> },
    { key: "status", header: "Result", sortable: true, render: (r) => <LogResultStatus value={r.status} /> },
    { key: "source", header: "Source", render: (r) => <LogSourceBadge value={r.source} /> },
    {
      key: "model_name",
      header: "Model",
      truncate: true,
      maxWidth: "16rem",
      render: (r) => <span className="font-mono text-xs">{r.model_name ?? "—"}</span>,
    },
    {
      key: "tokens",
      header: "Tokens in → out",
      numeric: true,
      render: (r) => `${formatNumber(r.input_tokens ?? 0)} → ${formatNumber(r.output_tokens ?? 0)}`,
    },
    { key: "response_time_ms", header: "Latency", numeric: true, sortable: true, render: (r) => formatDurationMs(r.response_time_ms) },
    {
      key: "account",
      header: "Account",
      truncate: true,
      maxWidth: "12rem",
      render: (r) => (r.account_name ? <bdi>{r.account_name}</bdi> : r.account_id ? `#${r.account_id}` : "—"),
    },
  ];

  function clearFilters() {
    setSearch("");
    setActionFilter("ALL");
    setEntityFilter("ALL");
    setEventFilter("ALL");
  }

  function changeTab(next: string) {
    setTab(next as TabId);
    clearFilters();
  }

  const filtered = (total: number, shown: number) => (shown !== total ? total : undefined);
  const noMatch: DataTableEmpty = {
    title: "No entries match these filters",
    action: (
      <Button variant="outline" size="sm" onClick={clearFilters}>
        Clear filters
      </Button>
    ),
  };
  const anyFilter = search.trim() !== "" || actionFilter !== "ALL" || entityFilter !== "ALL" || eventFilter !== "ALL";

  const statusOptions = (withEmpty: boolean) => [
    { value: "ALL", label: "All" },
    { value: "SUCCESS", label: "Success" },
    ...(withEmpty ? [{ value: "EMPTY", label: "Empty (no chunks)" }] : []),
    { value: "FAILED", label: "Failed" },
  ];

  return (
    <Page width="wide">
      <PageHeading
        title="Logs & Health"
        description="Activity audit, sign-in security, agent usage, API traffic, knowledge search, AI requests, errors and system health."
      />

      {visibleTabs.length === 0 ? null : (
        <Tabs value={tab} onValueChange={changeTab}>
          <TabsList aria-label="Log views">
            {visibleTabs.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="activity" className="space-y-3">
            <TabIntro>
              Changes made in the console. Pick an account to include its trainee and account assignments.
            </TabIntro>
            <DataTable<AuditLog>
              aria-label="Activity audit"
              columns={activityColumns}
              data={activity.isError ? [] : activityRows}
              keyFn={(r) => r.id}
              loading={activity.isLoading}
              density="compact"
              itemLabel="entries"
              defaultSort={{ key: "created_at", dir: "desc" }}
              onRowClick={(row) => setSelectedRow(row)}
              empty={
                activity.isError
                  ? loadError("Couldn't load activity", activity.error, () => void activity.refetch())
                  : anyFilter || activityAccountFilter !== "ALL"
                    ? noMatch
                    : { icon: History, title: "No activity recorded yet" }
              }
              toolbarEnd={<RefreshAction label="Refresh activity" busy={activity.isFetching} onClick={() => void activity.refetch()} />}
              toolbar={
                <FilterBar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search activity…"
                  filters={[
                    {
                      id: "log-account",
                      label: "Account",
                      value: activityAccountFilter,
                      onChange: setActivityAccountFilter,
                      hidden: accounts.length === 0,
                      options: [
                        { value: "ALL", label: "All (org-wide)" },
                        ...accounts.map((a) => ({ value: String(a.id), label: `${a.name} only` })),
                      ],
                    },
                    {
                      id: "log-action",
                      label: "Action",
                      value: actionFilter,
                      onChange: setActionFilter,
                      options: [
                        { value: "ALL", label: "All" },
                        { value: "CREATE", label: "Create" },
                        { value: "CREATE_TRAINEE", label: "Create trainee" },
                        { value: "UPDATE", label: "Update" },
                        { value: "DELETE", label: "Delete" },
                        { value: "ASSIGN", label: "Assign" },
                        { value: "UNASSIGN", label: "Unassign" },
                      ],
                    },
                    {
                      id: "log-entity",
                      label: "Entity",
                      value: entityFilter,
                      onChange: setEntityFilter,
                      options: [
                        { value: "ALL", label: "All" },
                        { value: "user", label: "User" },
                        { value: "account_user", label: "Account user" },
                        { value: "account", label: "Account" },
                        { value: "organization", label: "Organization" },
                      ],
                    },
                  ]}
                  onClear={() => {
                    clearFilters();
                    setActivityAccountFilter("ALL");
                  }}
                  isFiltered={anyFilter || activityAccountFilter !== "ALL"}
                  totalCount={filtered(activity.data?.items.length ?? 0, activityRows.length)}
                  filteredCount={activityRows.length}
                  itemLabel="entries"
                />
              }
            />
          </TabsContent>

          <TabsContent value="sign-in" className="space-y-3">
            <TabIntro>Sign-ins, failed attempts, lockouts, OTP checks and password resets.</TabIntro>
            <DataTable<SignInLog>
              aria-label="Sign-in events"
              columns={signInColumns}
              data={signIn.isError ? [] : signInRows}
              keyFn={(r) => r.id}
              loading={signIn.isLoading}
              density="compact"
              itemLabel="events"
              defaultSort={{ key: "created_at", dir: "desc" }}
              onRowClick={(row) => setSelectedRow(row)}
              empty={
                signIn.isError
                  ? loadError("Couldn't load sign-in events", signIn.error, () => void signIn.refetch())
                  : anyFilter
                    ? noMatch
                    : { icon: KeyRound, title: "No sign-in events recorded" }
              }
              toolbarEnd={<RefreshAction label="Refresh sign-in events" busy={signIn.isFetching} onClick={() => void signIn.refetch()} />}
              toolbar={
                <FilterBar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search sign-in events…"
                  filters={[
                    {
                      id: "log-event",
                      label: "Event",
                      value: eventFilter,
                      onChange: setEventFilter,
                      options: [
                        { value: "ALL", label: "All" },
                        { value: "login_success", label: "Login success" },
                        { value: "login_failed", label: "Login failed" },
                        { value: "account_locked", label: "Account locked" },
                        { value: "otp_verified", label: "OTP verified" },
                        { value: "password_reset_success", label: "Password reset" },
                      ],
                    },
                  ]}
                  onClear={clearFilters}
                  totalCount={filtered(signIn.data?.items.length ?? 0, signInRows.length)}
                  filteredCount={signInRows.length}
                  itemLabel="events"
                />
              }
            />
          </TabsContent>

          <TabsContent value="agents" className="space-y-3">
            <TabIntro>
              {workspace.account ? (
                <>
                  AI usage and answer outcomes per agent of <span className="font-medium text-foreground">{workspace.account.name}</span>, all
                  time. Switch the account in the sidebar.
                </>
              ) : (
                "AI usage and answer outcomes per agent, all time."
              )}
            </TabIntro>
            <DataTable<AgentMetric>
              aria-label="Agent activity"
              columns={agentColumns}
              data={agents.isError ? [] : agentRows}
              keyFn={(r) => r.user_id}
              loading={workspace.isLoading || (agents.isLoading && selectedAccountId != null)}
              itemLabel="agents"
              defaultSort={{ key: "ai_usage_count", dir: "desc" }}
              onRowClick={(row) => setSelectedRow(row)}
              empty={
                selectedAccountId == null
                  ? { icon: Building2, title: "Select an account", description: "Choose an account in the sidebar to see its agents." }
                  : agents.isError
                    ? loadError("Couldn't load agent metrics", agents.error, () => void agents.refetch())
                    : anyFilter
                      ? noMatch
                      : { icon: Users, title: "No agent metrics for this account" }
              }
              toolbarEnd={
                selectedAccountId != null ? (
                  <RefreshAction label="Refresh agent activity" busy={agents.isFetching} onClick={() => void agents.refetch()} />
                ) : undefined
              }
              toolbar={
                <FilterBar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search agents…"
                  onClear={clearFilters}
                  totalCount={filtered(agentMetrics.length, agentRows.length)}
                  filteredCount={agentRows.length}
                  itemLabel="agents"
                />
              }
            />
          </TabsContent>

          <TabsContent value="api">
            <ApiRequestsPanel onRowClick={(row) => setSelectedRow(row)} />
          </TabsContent>

          <TabsContent value="rag" className="space-y-3">
            <TabIntro>Knowledge-base retrievals behind AI answers: query, chunks found and their top score.</TabIntro>
            <DataTable<RagRetrieval>
              aria-label="Knowledge search"
              columns={ragColumns}
              data={rag.isError ? [] : ragRows}
              keyFn={(r) => r.id}
              loading={rag.isLoading}
              density="compact"
              itemLabel="retrievals"
              defaultSort={{ key: "created_at", dir: "desc" }}
              onRowClick={(row) => setSelectedRow(row)}
              empty={
                rag.isError
                  ? loadError("Couldn't load retrievals", rag.error, () => void rag.refetch())
                  : anyFilter
                    ? noMatch
                    : { icon: Search, title: "No knowledge searches recorded yet" }
              }
              toolbarEnd={
                <RefreshAction
                  label="Refresh knowledge search"
                  busy={rag.isFetching}
                  onClick={() => void rag.refetch()}
                  intervalMs={LIVE_LOGS_REFRESH_MS}
                />
              }
              toolbar={
                <FilterBar
                  search={search}
                  onSearchChange={setSearch}
                  searchPlaceholder="Search queries…"
                  filters={[{ id: "rag-status", label: "Result", value: eventFilter, onChange: setEventFilter, options: statusOptions(true) }]}
                  onClear={clearFilters}
                  totalCount={filtered(rag.data?.items.length ?? 0, ragRows.length)}
                  filteredCount={ragRows.length}
                  itemLabel="retrievals"
                />
              }
            />
          </TabsContent>

          <TabsContent value="ai-requests" className="space-y-6">
            <AiMetricsPanel />
            <section className="space-y-3" aria-labelledby="ai-requests-heading">
              <h2 id="ai-requests-heading" className="text-base font-semibold text-foreground">
                Requests
              </h2>
              <DataTable<AiRequest>
                aria-label="AI requests"
                columns={aiColumns}
                data={ai.isError ? [] : aiRows}
                keyFn={(r) => r.id}
                loading={ai.isLoading}
                density="compact"
                itemLabel="requests"
                defaultSort={{ key: "id", dir: "desc" }}
                onRowClick={(row) => setSelectedRow(row)}
                empty={
                  ai.isError
                    ? loadError("Couldn't load AI requests", ai.error, () => void ai.refetch())
                    : anyFilter
                      ? noMatch
                      : { icon: Sparkles, title: "No AI requests recorded yet" }
                }
                toolbarEnd={
                  <RefreshAction label="Refresh AI requests" busy={ai.isFetching} onClick={() => void ai.refetch()} intervalMs={LIVE_LOGS_REFRESH_MS} />
                }
                toolbar={
                  <FilterBar
                    search={search}
                    onSearchChange={setSearch}
                    searchPlaceholder="Search model, account, error…"
                    filters={[{ id: "ai-status", label: "Result", value: eventFilter, onChange: setEventFilter, options: statusOptions(false) }]}
                    onClear={clearFilters}
                    totalCount={filtered(ai.data?.items.length ?? 0, aiRows.length)}
                    filteredCount={aiRows.length}
                    itemLabel="requests"
                  />
                }
              />
            </section>
          </TabsContent>

          <TabsContent value="errors">
            <ErrorLogsPanel />
          </TabsContent>

          <TabsContent value="system" className="space-y-8">
            <SystemComponentsSection />
            <SystemResourcesSection />
          </TabsContent>
        </Tabs>
      )}

      <LogDetailsSheet row={selectedRow} onClose={() => setSelectedRow(null)} />
    </Page>
  );
}
