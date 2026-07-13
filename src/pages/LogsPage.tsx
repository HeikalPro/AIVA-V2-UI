import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/roles";
import { useAccounts } from "@/hooks/useAccounts";
import { useAgentMetrics } from "@/hooks/useAnalytics";
import { useActivityLogs, useAiRequestLogs, useRagLogs, useSignInLogs } from "@/hooks/useLogs";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { TableFilters } from "@/components/shared/TableFilters";
import { filterRows } from "@/lib/table-filters";
import { formatUserError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { AgentMetric, AiRequest, AuditLog, RagRetrieval, SignInLog } from "@/types/api";

type TabId = "activity" | "sign-in" | "agents" | "rag" | "ai-requests";

type LogRow = AuditLog | SignInLog | AgentMetric | RagRetrieval | AiRequest;

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

function agentLabel(row: AgentMetric): string {
  const name = [row.agent_first_name, row.agent_last_name].filter(Boolean).join(" ").trim();
  return name || row.agent_email || `User #${row.user_id}`;
}

function SourceBadge({ value }: { value: string | null | undefined }) {
  const isWidget = (value ?? "").toUpperCase() === "WIDGET";
  const label = isWidget ? "Widget" : "Agent";
  const tone = isWidget ? "bg-violet-100 text-violet-700" : "bg-sky-100 text-sky-700";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{label}</span>;
}

function StatusBadge({ value }: { value: string | null | undefined }) {
  const v = (value ?? "").toUpperCase();
  const tone =
    v === "SUCCESS"
      ? "bg-emerald-100 text-emerald-700"
      : v === "FAILED"
        ? "bg-red-100 text-red-700"
        : v === "EMPTY"
          ? "bg-amber-100 text-amber-700"
          : "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>{v || "—"}</span>
  );
}

export function LogsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN) ?? false;
  const isOrgAdmin = user?.roles.includes(ROLES.ORG_ADMIN) ?? false;
  const isSupervisor = user?.roles.includes(ROLES.SUPERVISOR) ?? false;
  const isDeveloper = user?.roles.includes(ROLES.DEVELOPER) ?? false;
  const isAccountManager = user?.roles.includes(ROLES.ACCOUNT_MANAGER) ?? false;

  const canSeeAiLogs = isSuperAdmin || isOrgAdmin || isDeveloper;
  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: "activity", label: "Activity", show: isSuperAdmin || isOrgAdmin || isSupervisor },
    { id: "sign-in", label: "Sign-in", show: isSuperAdmin || isOrgAdmin },
    { id: "agents", label: "Agent activity", show: isSuperAdmin || isOrgAdmin || isSupervisor || isAccountManager },
    { id: "rag", label: "RAG retrieval", show: canSeeAiLogs },
    { id: "ai-requests", label: "AI requests", show: canSeeAiLogs },
  ];
  const visibleTabs = tabs.filter((t) => t.show);
  const [tab, setTab] = useState<TabId>(visibleTabs[0]?.id ?? "activity");
  const [selectedRow, setSelectedRow] = useState<LogRow | null>(null);

  const { data: accounts = [] } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const [accountId, setAccountId] = useState<number | null>(null);
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;
  const [activityAccountFilter, setActivityAccountFilter] = useState("ALL");

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [entityFilter, setEntityFilter] = useState("ALL");
  const [eventFilter, setEventFilter] = useState("ALL");

  const { data: activityData, isLoading: activityLoading, isError: activityError, error: activityLoadError } = useActivityLogs(
    {
      account_id: activityAccountFilter === "ALL" ? undefined : Number(activityAccountFilter),
      action_type: actionFilter === "ALL" ? undefined : actionFilter,
      entity_type: entityFilter === "ALL" ? undefined : entityFilter,
    },
    tab === "activity",
  );
  const { data: signInData, isLoading: signInLoading, isError: signInError, error: signInLoadError } = useSignInLogs(
    { event_type: eventFilter === "ALL" ? undefined : eventFilter },
    tab === "sign-in",
  );
  const { data: agentMetrics = [], isLoading: agentsLoading } = useAgentMetrics(
    selectedAccountId,
    tab === "agents" && selectedAccountId != null,
  );
  const { data: ragData, isLoading: ragLoading, isError: ragError, error: ragLoadError } = useRagLogs(
    { status: eventFilter === "ALL" ? undefined : eventFilter },
    tab === "rag",
  );
  const { data: aiData, isLoading: aiLoading, isError: aiError, error: aiLoadError } = useAiRequestLogs(
    { status: eventFilter === "ALL" ? undefined : eventFilter },
    tab === "ai-requests",
  );

  const activityRows = useMemo(
    () =>
      filterRows(
        activityData?.items ?? [],
        search,
        (r) =>
          [
            r.summary ?? "",
            r.actor_email ?? "",
            r.action_type,
            r.entity_type,
            r.entity_id,
            r.new_value ?? "",
            r.ip_address ?? "",
          ].join(" "),
      ),
    [activityData, search],
  );

  const signInRows = useMemo(
    () =>
      filterRows(
        signInData?.items ?? [],
        search,
        (r) => [r.summary ?? "", r.user_email ?? "", r.event_type, r.ip_address ?? "", r.user_agent ?? ""].join(" "),
      ),
    [signInData, search],
  );

  const agentRows = useMemo(
    () =>
      filterRows(
        agentMetrics,
        search,
        (r) => [agentLabel(r), r.agent_email ?? "", String(r.ai_usage_count ?? ""), String(r.escalation_count ?? "")].join(" "),
      ),
    [agentMetrics, search],
  );

  const ragRows = useMemo(
    () =>
      filterRows(
        ragData?.items ?? [],
        search,
        (r) => [r.summary ?? "", r.query_text ?? "", r.status, r.account_name ?? "", r.error_message ?? ""].join(" "),
      ),
    [ragData, search],
  );

  const aiRows = useMemo(
    () =>
      filterRows(
        aiData?.items ?? [],
        search,
        (r) => [r.summary ?? "", r.model_name ?? "", r.provider ?? "", r.status ?? "", r.account_name ?? "", r.error_message ?? ""].join(" "),
      ),
    [aiData, search],
  );

  const activityColumns: Column<AuditLog>[] = [
    { key: "when", header: "When", sortable: true, sortValue: (r) => r.created_at ?? "", render: (r) => formatWhen(r.created_at) },
    { key: "actor", header: "Actor", render: (r) => r.actor_email ?? (r.user_id ? `#${r.user_id}` : "—") },
    {
      key: "summary",
      header: "Summary",
      render: (r) => r.summary ?? `${r.action_type} ${r.entity_type} #${r.entity_id}`,
    },
    { key: "ip", header: "IP", render: (r) => r.ip_address ?? "—" },
  ];

  const signInColumns: Column<SignInLog>[] = [
    { key: "when", header: "When", sortable: true, sortValue: (r) => r.created_at ?? "", render: (r) => formatWhen(r.created_at) },
    { key: "summary", header: "Summary", render: (r) => r.summary ?? `${r.user_email ?? `#${r.user_id}`} ${r.event_type}` },
    { key: "device", header: "Device", render: (r) => snippet(r.user_agent, 60) },
  ];

  const agentColumns: Column<AgentMetric>[] = [
    { key: "agent", header: "Agent", sortable: true, sortValue: (r) => agentLabel(r), render: (r) => agentLabel(r) },
    { key: "email", header: "Email", render: (r) => r.agent_email ?? "—" },
    { key: "ai", header: "AI requests", render: (r) => String(r.ai_usage_count ?? "—") },
    { key: "esc", header: "Escalations", render: (r) => String(r.escalation_count ?? "—") },
    { key: "avg", header: "Avg response (s)", render: (r) => (r.avg_response_time != null ? r.avg_response_time.toFixed(2) : "—") },
  ];

  const ragColumns: Column<RagRetrieval>[] = [
    { key: "when", header: "When", sortable: true, sortValue: (r) => r.created_at ?? "", render: (r) => formatWhen(r.created_at) },
    { key: "source", header: "Source", render: (r) => <SourceBadge value={r.source} /> },
    { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
    { key: "query", header: "Query", render: (r) => snippet(r.query_text, 70) },
    { key: "chunks", header: "Chunks", render: (r) => String(r.chunks_returned ?? "—") },
    { key: "score", header: "Top score", sortable: true, sortValue: (r) => r.top_score ?? -1, render: (r) => (r.top_score != null ? r.top_score.toFixed(3) : "—") },
    { key: "ms", header: "Retrieval (ms)", render: (r) => String(r.retrieval_ms ?? "—") },
    { key: "account", header: "Account", render: (r) => r.account_name ?? (r.account_id ? `#${r.account_id}` : "—") },
  ];

  const aiColumns: Column<AiRequest>[] = [
    { key: "id", header: "Request", sortable: true, sortValue: (r) => r.id, render: (r) => `#${r.id}` },
    { key: "source", header: "Source", render: (r) => <SourceBadge value={r.source} /> },
    { key: "status", header: "Status", render: (r) => <StatusBadge value={r.status} /> },
    { key: "model", header: "Model", render: (r) => snippet(r.model_name, 40) },
    { key: "tokens", header: "Tokens (in→out)", render: (r) => `${r.input_tokens ?? 0}→${r.output_tokens ?? 0}` },
    { key: "cost", header: "Cost (USD)", sortable: true, sortValue: (r) => r.total_cost ?? -1, render: (r) => (r.total_cost != null ? `$${r.total_cost.toFixed(4)}` : "—") },
    { key: "ms", header: "Latency (ms)", render: (r) => String(r.response_time_ms ?? "—") },
    { key: "account", header: "Account", render: (r) => r.account_name ?? (r.account_id ? `#${r.account_id}` : "—") },
  ];

  function clearFilters() {
    setSearch("");
    setActionFilter("ALL");
    setEntityFilter("ALL");
    setEventFilter("ALL");
  }

  function renderDetails(row: LogRow | null) {
    if (!row) return null;

    const entries = Object.entries(row)
      .filter(([, value]) => value != null)
      .map(([key, value]) => ({ key, value }));

    return (
      <div className="space-y-3">
        {entries.map(({ key, value }) => (
          <div key={key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{key.replace(/_/g, " ")}</div>
            <div className="whitespace-pre-wrap break-words text-sm text-slate-900">{String(value)}</div>
          </div>
        ))}
      </div>
    );
  }

  const showAccountPicker = tab === "agents";
  const showActivityAccountFilter = tab === "activity" && accounts.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ScrollText}
        title="Logs"
        description="Activity audit, sign-in security, agent usage, RAG retrievals, AI requests, and API traces."
      />

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {visibleTabs.map((t) => (
          <Button
            key={t.id}
            variant={tab === t.id ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setTab(t.id);
              clearFilters();
            }}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {showActivityAccountFilter && (
        <div className="min-w-[240px]">
          <Label>Account filter</Label>
          <Select
            value={activityAccountFilter}
            onChange={(e) => setActivityAccountFilter(e.target.value)}
            className="mt-1"
          >
            <option value="ALL">All accounts (org-wide activity)</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} only
              </option>
            ))}
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">
            User and org changes appear under all accounts; trainee/account assignments appear when filtered.
          </p>
        </div>
      )}

      {showAccountPicker && accounts.length > 0 && (
        <div className="min-w-[240px]">
          <Label>Account</Label>
          <Select
            value={selectedAccountId != null ? String(selectedAccountId) : ""}
            onChange={(e) => setAccountId(Number(e.target.value))}
            className="mt-1"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {tab === "activity" && (
        <>
          <ErrorAlert message={activityError ? formatUserError(activityLoadError) : null} />
          <TableFilters
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search activity…"
            filters={[
              {
                id: "log-action",
                label: "Action",
                value: actionFilter,
                onChange: setActionFilter,
                options: [
                  { value: "ALL", label: "All actions" },
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
                  { value: "ALL", label: "All entities" },
                  { value: "user", label: "User" },
                  { value: "account_user", label: "Account user" },
                  { value: "account", label: "Account" },
                  { value: "organization", label: "Organization" },
                ],
              },
            ]}
            onClear={clearFilters}
            totalCount={activityData?.items.length ?? 0}
            filteredCount={activityRows.length}
          />
          <DataTable
            columns={activityColumns}
            data={activityRows}
            keyFn={(r) => r.id}
            loading={activityLoading}
            emptyMessage="No activity recorded yet."
            onRowClick={(row) => setSelectedRow(row)}
          />
        </>
      )}

      {tab === "sign-in" && (
        <>
          <ErrorAlert message={signInError ? formatUserError(signInLoadError) : null} />
          <TableFilters
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
                  { value: "ALL", label: "All events" },
                  { value: "login_success", label: "Login success" },
                  { value: "login_failed", label: "Login failed" },
                  { value: "account_locked", label: "Account locked" },
                  { value: "otp_verified", label: "OTP verified" },
                  { value: "password_reset_success", label: "Password reset" },
                ],
              },
            ]}
            onClear={clearFilters}
            totalCount={signInData?.items.length ?? 0}
            filteredCount={signInRows.length}
          />
          <DataTable
            columns={signInColumns}
            data={signInRows}
            keyFn={(r) => r.id}
            loading={signInLoading}
            emptyMessage="No sign-in events recorded."
            onRowClick={(row) => setSelectedRow(row)}
          />
        </>
      )}

      {tab === "agents" && (
        <>
          <TableFilters
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search agents…"
            filters={[]}
            onClear={clearFilters}
            totalCount={agentMetrics.length}
            filteredCount={agentRows.length}
          />
          <DataTable
            columns={agentColumns}
            data={agentRows}
            keyFn={(r) => r.user_id}
            loading={agentsLoading}
            emptyMessage={selectedAccountId ? "No agent metrics for this account." : "Select an account."}
            onRowClick={(row) => setSelectedRow(row)}
          />
        </>
      )}

      {tab === "rag" && (
        <>
          <ErrorAlert message={ragError ? formatUserError(ragLoadError) : null} />
          <TableFilters
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search retrievals…"
            filters={[
              {
                id: "rag-status",
                label: "Status",
                value: eventFilter,
                onChange: setEventFilter,
                options: [
                  { value: "ALL", label: "All statuses" },
                  { value: "SUCCESS", label: "Success" },
                  { value: "EMPTY", label: "Empty (no chunks)" },
                  { value: "FAILED", label: "Failed" },
                ],
              },
            ]}
            onClear={clearFilters}
            totalCount={ragData?.items.length ?? 0}
            filteredCount={ragRows.length}
          />
          <DataTable
            columns={ragColumns}
            data={ragRows}
            keyFn={(r) => r.id}
            loading={ragLoading}
            emptyMessage="No RAG retrievals recorded yet."
            onRowClick={(row) => setSelectedRow(row)}
          />
        </>
      )}

      {tab === "ai-requests" && (
        <>
          <ErrorAlert message={aiError ? formatUserError(aiLoadError) : null} />
          <TableFilters
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search AI requests…"
            filters={[
              {
                id: "ai-status",
                label: "Status",
                value: eventFilter,
                onChange: setEventFilter,
                options: [
                  { value: "ALL", label: "All statuses" },
                  { value: "SUCCESS", label: "Success" },
                  { value: "FAILED", label: "Failed" },
                ],
              },
            ]}
            onClear={clearFilters}
            totalCount={aiData?.items.length ?? 0}
            filteredCount={aiRows.length}
          />
          <DataTable
            columns={aiColumns}
            data={aiRows}
            keyFn={(r) => r.id}
            loading={aiLoading}
            emptyMessage="No AI requests recorded yet."
            onRowClick={(row) => setSelectedRow(row)}
          />
        </>
      )}

      <Dialog open={selectedRow !== null} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle>Log details</DialogTitle>
              <p className="mt-1 text-sm text-slate-500">
                Detailed fields for the selected log entry.
              </p>
            </div>
            <DialogClose onClose={() => setSelectedRow(null)} />
          </DialogHeader>
          {selectedRow ? (
            <div className="space-y-4">{renderDetails(selectedRow)}</div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
