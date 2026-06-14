import { useEffect, useMemo, useState } from "react";
import { Activity, Clock, DollarSign, LayoutDashboard, MessageSquare, Users, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES, canAccess } from "@/lib/roles";
import { useAccounts } from "@/hooks/useAccounts";
import { useAgentMetrics, useDashboardStats } from "@/hooks/useAnalytics";
import { PageHeader } from "@/components/shared/PageHeader";
import { KPIStatCard } from "@/components/shared/KPIStatCard";
import { DataTable } from "@/components/shared/DataTable";
import { TableFilters } from "@/components/shared/TableFilters";
import { filterRows } from "@/lib/table-filters";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { AgentMetric } from "@/types/api";

const DASHBOARD_ROLES = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR, ROLES.DEVELOPER];
const ANALYTICS_VIEW_ROLES = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR];

function agentDisplayName(metric: AgentMetric): string {
  const name = [metric.agent_first_name, metric.agent_last_name].filter(Boolean).join(" ").trim();
  return name || metric.agent_email || `User #${metric.user_id}`;
}

export function DashboardPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const canViewDashboard = canAccess(user?.roles ?? [], DASHBOARD_ROLES);
  const canViewAnalytics = canAccess(user?.roles ?? [], ANALYTICS_VIEW_ROLES);
  const { data: accounts = [] } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const [accountId, setAccountId] = useState<number | null>(null);
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;

  const { data: stats } = useDashboardStats(selectedAccountId, canViewAnalytics);
  const { data: agents = [], isLoading: agentsLoading } = useAgentMetrics(selectedAccountId, canViewAnalytics);

  const [search, setSearch] = useState("");
  const [usageFilter, setUsageFilter] = useState("ALL");
  const [escalationFilter, setEscalationFilter] = useState("ALL");
  const [responseFilter, setResponseFilter] = useState("ALL");

  useEffect(() => {
    setSearch("");
    setUsageFilter("ALL");
    setEscalationFilter("ALL");
    setResponseFilter("ALL");
  }, [selectedAccountId]);

  const filteredAgents = useMemo(
    () =>
      filterRows(
        agents,
        search,
        (r) =>
          [
            agentDisplayName(r),
            r.agent_email ?? "",
            String(r.user_id),
            String(r.ai_usage_count ?? ""),
            String(r.successful_answers ?? ""),
          ].join(" "),
        [
          (r) => {
            const usage = r.ai_usage_count ?? 0;
            if (usageFilter === "LOW") return usage < 10;
            if (usageFilter === "MEDIUM") return usage >= 10 && usage < 50;
            if (usageFilter === "HIGH") return usage >= 50;
            return true;
          },
          (r) => {
            const esc = r.escalation_count ?? 0;
            if (escalationFilter === "WITH") return esc > 0;
            if (escalationFilter === "NONE") return esc === 0;
            return true;
          },
          (r) => {
            const ms = r.avg_response_time;
            if (responseFilter === "FAST") return ms != null && ms < 3000;
            if (responseFilter === "SLOW") return ms != null && ms >= 3000;
            if (responseFilter === "UNKNOWN") return ms == null;
            return true;
          },
        ],
      ),
    [agents, search, usageFilter, escalationFilter, responseFilter],
  );

  function clearAgentFilters() {
    setSearch("");
    setUsageFilter("ALL");
    setEscalationFilter("ALL");
    setResponseFilter("ALL");
  }

  if (!canViewDashboard) {
    return <p className="text-sm text-muted-foreground">You do not have access to the dashboard.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description={
          canViewAnalytics
            ? "Analytics overview for your account"
            : "Account overview for your assigned account(s)"
        }
      />

      <div className="max-w-xs">
        <Label htmlFor="account">Account</Label>
        <Select
          id="account"
          value={selectedAccountId ?? ""}
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

      {!selectedAccountId ? (
        <p className="text-sm text-muted-foreground">Select an account to continue.</p>
      ) : canViewAnalytics ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KPIStatCard label="Sessions" value={stats?.total_sessions ?? "—"} icon={<Activity className="h-4 w-4" />} iconColor="bg-blue-100 text-blue-600" />
            <KPIStatCard label="Messages" value={stats?.total_messages ?? "—"} icon={<MessageSquare className="h-4 w-4" />} iconColor="bg-violet-100 text-violet-600" />
            <KPIStatCard label="AI Requests" value={stats?.total_ai_requests ?? "—"} icon={<Zap className="h-4 w-4" />} iconColor="bg-amber-100 text-amber-600" />
            <KPIStatCard label="Avg Response" value={stats?.avg_response_time_ms != null ? `${Math.round(stats.avg_response_time_ms)} ms` : "—"} icon={<Clock className="h-4 w-4" />} iconColor="bg-emerald-100 text-emerald-600" />
            <KPIStatCard label="Input Tokens" value={stats?.total_input_tokens != null ? stats.total_input_tokens.toLocaleString() : "—"} icon={<Users className="h-4 w-4" />} iconColor="bg-sky-100 text-sky-600" />
            <KPIStatCard label="Total Cost" value={stats?.total_cost != null ? `$${stats.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}` : "—"} icon={<DollarSign className="h-4 w-4" />} iconColor="bg-rose-100 text-rose-600" />
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">Agent Metrics</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Per-agent stats from chat sessions and AI requests (computed live).
              </p>
            </div>

            <TableFilters
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search by agent name, email, or user ID…"
              filters={[
                {
                  id: "agent-usage-filter",
                  label: "AI usage",
                  value: usageFilter,
                  onChange: setUsageFilter,
                  options: [
                    { value: "ALL", label: "All levels" },
                    { value: "LOW", label: "Under 10" },
                    { value: "MEDIUM", label: "10 – 49" },
                    { value: "HIGH", label: "50+" },
                  ],
                },
                {
                  id: "agent-response-filter",
                  label: "Avg response",
                  value: responseFilter,
                  onChange: setResponseFilter,
                  options: [
                    { value: "ALL", label: "All" },
                    { value: "FAST", label: "Under 3s" },
                    { value: "SLOW", label: "3s or more" },
                  ],
                },
                {
                  id: "agent-escalation-filter",
                  label: "Escalations",
                  value: escalationFilter,
                  onChange: setEscalationFilter,
                  options: [
                    { value: "ALL", label: "All" },
                    { value: "WITH", label: "With escalations" },
                    { value: "NONE", label: "No escalations" },
                  ],
                },
              ]}
              onClear={clearAgentFilters}
              totalCount={agents.length}
              filteredCount={filteredAgents.length}
            />

            <DataTable<AgentMetric>
              columns={[
                {
                  key: "agent",
                  header: "Agent",
                  sortable: true,
                  sortValue: (r) => agentDisplayName(r),
                  render: (r) => agentDisplayName(r),
                },
                { key: "ai_usage_count", header: "AI Usage", sortable: true },
                { key: "successful_answers", header: "Successful", sortable: true },
                { key: "escalation_count", header: "Escalations", sortable: true },
                {
                  key: "avg_response_time",
                  header: "Avg Response (ms)",
                  sortable: true,
                  render: (r) => (r.avg_response_time != null ? Math.round(r.avg_response_time) : "—"),
                },
              ]}
              data={filteredAgents}
              keyFn={(r) => r.user_id}
              loading={agentsLoading}
              emptyMessage={
                agents.length === 0
                  ? "No agent chat activity for this account yet"
                  : "No agents match your filters"
              }
            />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Analytics are not available for your role.</p>
      )}
    </div>
  );
}
