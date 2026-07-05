import { useMemo, useState } from "react";
import { ScrollText } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/roles";
import { useAccounts } from "@/hooks/useAccounts";
import { useAgentMetrics } from "@/hooks/useAnalytics";
import { useActivityLogs, useApiLogs, useSignInLogs } from "@/hooks/useLogs";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable, type Column } from "@/components/shared/DataTable";
import { TableFilters } from "@/components/shared/TableFilters";
import { filterRows } from "@/lib/table-filters";
import { formatUserError } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { AgentMetric, AuditLog, HttpRequestLog, SignInLog } from "@/types/api";

type TabId = "activity" | "sign-in" | "agents" | "api";

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

export function LogsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN) ?? false;
  const isOrgAdmin = user?.roles.includes(ROLES.ORG_ADMIN) ?? false;
  const isSupervisor = user?.roles.includes(ROLES.SUPERVISOR) ?? false;
  const isDeveloper = user?.roles.includes(ROLES.DEVELOPER) ?? false;
  const isAccountManager = user?.roles.includes(ROLES.ACCOUNT_MANAGER) ?? false;

  const tabs: { id: TabId; label: string; show: boolean }[] = [
    { id: "activity", label: "Activity", show: isSuperAdmin || isOrgAdmin || isSupervisor },
    { id: "sign-in", label: "Sign-in", show: isSuperAdmin || isOrgAdmin },
    { id: "agents", label: "Agent activity", show: isSuperAdmin || isOrgAdmin || isSupervisor || isAccountManager },
    { id: "api", label: "API", show: isSuperAdmin || isOrgAdmin || isDeveloper },
  ];
  const visibleTabs = tabs.filter((t) => t.show);
  const [tab, setTab] = useState<TabId>(visibleTabs[0]?.id ?? "activity");

  const { data: accounts = [] } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const [accountId, setAccountId] = useState<number | null>(null);
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;
  const [activityAccountFilter, setActivityAccountFilter] = useState("ALL");

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");
  const [entityFilter, setEntityFilter] = useState("ALL");
  const [eventFilter, setEventFilter] = useState("ALL");
  const [methodFilter, setMethodFilter] = useState("ALL");

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
  const { data: apiData, isLoading: apiLoading, isError: apiError, error: apiLoadError } = useApiLogs(
    { method: methodFilter === "ALL" ? undefined : methodFilter },
    tab === "api",
  );
  const { data: agentMetrics = [], isLoading: agentsLoading } = useAgentMetrics(
    selectedAccountId,
    tab === "agents" && selectedAccountId != null,
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

  const apiRows = useMemo(
    () =>
      filterRows(
        apiData?.items ?? [],
        search,
        (r) =>
          [
            r.summary ?? "",
            r.path,
            r.handler_name ?? "",
            r.user_email ?? "",
            String(r.status_code),
            r.client_ip ?? "",
          ].join(" "),
      ),
    [apiData, search],
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

  const activityColumns: Column<AuditLog>[] = [
    { key: "when", header: "When", sortable: true, sortValue: (r) => r.created_at ?? "", render: (r) => formatWhen(r.created_at) },
    { key: "actor", header: "Actor", render: (r) => r.actor_email ?? (r.user_id ? `#${r.user_id}` : "—") },
    { key: "action", header: "Action", render: (r) => r.action_type },
    { key: "entity", header: "Entity", render: (r) => `${r.entity_type} #${r.entity_id}` },
    { key: "detail", header: "Detail", render: (r) => snippet(r.new_value ?? r.old_value, 100) },
    { key: "ip", header: "IP", render: (r) => r.ip_address ?? "—" },
  ];

  const signInColumns: Column<SignInLog>[] = [
    { key: "when", header: "When", sortable: true, sortValue: (r) => r.created_at ?? "", render: (r) => formatWhen(r.created_at) },
    { key: "user", header: "User", render: (r) => r.user_email ?? (r.user_id ? `#${r.user_id}` : "—") },
    { key: "event", header: "Event", render: (r) => r.event_type },
    { key: "ip", header: "IP", render: (r) => r.ip_address ?? "—" },
    { key: "agent", header: "Device", render: (r) => snippet(r.user_agent, 60) },
  ];

  const apiColumns: Column<HttpRequestLog>[] = [
    { key: "when", header: "When", sortable: true, sortValue: (r) => r.created_at ?? "", render: (r) => formatWhen(r.created_at) },
    { key: "method", header: "Method", render: (r) => r.http_method },
    { key: "handler", header: "Handler", render: (r) => r.handler_name ?? "—" },
    { key: "status", header: "Status", render: (r) => String(r.status_code) },
    { key: "ms", header: "ms", render: (r) => String(r.duration_ms) },
    { key: "user", header: "User", render: (r) => r.user_email ?? r.actor_label ?? "—" },
    { key: "ip", header: "IP", render: (r) => r.client_ip ?? "—" },
  ];

  const agentColumns: Column<AgentMetric>[] = [
    { key: "agent", header: "Agent", sortable: true, sortValue: (r) => agentLabel(r), render: (r) => agentLabel(r) },
    { key: "email", header: "Email", render: (r) => r.agent_email ?? "—" },
    { key: "ai", header: "AI requests", render: (r) => String(r.ai_usage_count ?? "—") },
    { key: "esc", header: "Escalations", render: (r) => String(r.escalation_count ?? "—") },
    { key: "avg", header: "Avg response (s)", render: (r) => (r.avg_response_time != null ? r.avg_response_time.toFixed(2) : "—") },
  ];

  function clearFilters() {
    setSearch("");
    setActionFilter("ALL");
    setEntityFilter("ALL");
    setEventFilter("ALL");
    setMethodFilter("ALL");
  }

  const showAccountPicker = tab === "agents";
  const showActivityAccountFilter = tab === "activity" && accounts.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ScrollText}
        title="Logs"
        description="Activity audit, sign-in security, agent usage, and API traces."
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
          />
        </>
      )}

      {tab === "api" && (
        <>
          <ErrorAlert message={apiError ? formatUserError(apiLoadError) : null} />
          <TableFilters
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search API logs…"
            filters={[
              {
                id: "log-method",
                label: "Method",
                value: methodFilter,
                onChange: setMethodFilter,
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
            onClear={clearFilters}
            totalCount={apiData?.items.length ?? 0}
            filteredCount={apiRows.length}
          />
          <DataTable
            columns={apiColumns}
            data={apiRows}
            keyFn={(r) => r.id}
            loading={apiLoading}
            emptyMessage="No API requests logged yet."
          />
        </>
      )}
    </div>
  );
}
