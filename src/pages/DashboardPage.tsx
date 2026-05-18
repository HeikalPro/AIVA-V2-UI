import { useState } from "react";
import { Activity, Clock, DollarSign, LayoutDashboard, MessageSquare, Users, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES, canAccess } from "@/lib/roles";
import { useAccounts } from "@/hooks/useAccounts";
import { useAgentMetrics, useDashboardStats } from "@/hooks/useAnalytics";
import { PageHeader } from "@/components/shared/PageHeader";
import { KPIStatCard } from "@/components/shared/KPIStatCard";
import { DataTable } from "@/components/shared/DataTable";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { AgentMetric } from "@/types/api";

export function DashboardPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const { data: accounts = [] } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const [accountId, setAccountId] = useState<number | null>(null);
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;

  const { data: stats, isLoading: statsLoading } = useDashboardStats(selectedAccountId);
  const { data: agents = [], isLoading: agentsLoading } = useAgentMetrics(selectedAccountId);

  if (!canAccess(user?.roles ?? [], [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR])) {
    return <p className="text-sm text-muted-foreground">You do not have access to the dashboard.</p>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={LayoutDashboard}
        title="Dashboard"
        description="Analytics overview for your account"
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
        <p className="text-sm text-muted-foreground">Select an account to view analytics.</p>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KPIStatCard label="Sessions" value={stats?.total_sessions ?? "—"} icon={<Activity className="h-4 w-4" />} iconColor="bg-blue-100 text-blue-600" />
            <KPIStatCard label="Messages" value={stats?.total_messages ?? "—"} icon={<MessageSquare className="h-4 w-4" />} iconColor="bg-violet-100 text-violet-600" />
            <KPIStatCard label="AI Requests" value={stats?.total_ai_requests ?? "—"} icon={<Zap className="h-4 w-4" />} iconColor="bg-amber-100 text-amber-600" />
            <KPIStatCard label="Avg Response" value={stats?.avg_response_time_ms != null ? `${Math.round(stats.avg_response_time_ms)} ms` : "—"} icon={<Clock className="h-4 w-4" />} iconColor="bg-emerald-100 text-emerald-600" />
            <KPIStatCard label="Input Tokens" value={stats?.total_input_tokens ?? "—"} icon={<Users className="h-4 w-4" />} iconColor="bg-sky-100 text-sky-600" />
            <KPIStatCard label="Total Cost" value={stats?.total_cost != null ? `$${stats.total_cost.toFixed(2)}` : "—"} icon={<DollarSign className="h-4 w-4" />} iconColor="bg-rose-100 text-rose-600" />
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Agent Metrics</h2>
            <DataTable<AgentMetric>
              columns={[
                { key: "user_id", header: "User ID", sortable: true },
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
              data={agents}
              keyFn={(r) => r.user_id}
              loading={statsLoading || agentsLoading}
              emptyMessage="No agent metrics for this account"
            />
          </div>
        </>
      )}
    </div>
  );
}
