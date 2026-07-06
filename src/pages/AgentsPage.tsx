import { useMemo, useState } from "react";
import { GraduationCap, ListChecks, Plus, UserCheck, UserPlus, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatUserError } from "@/lib/errors";
import { ROLES, canAccessPermission } from "@/lib/roles";
import { useAgents, usePromoteTrainee } from "@/hooks/useAgents";
import { useAgentsQueueSummary } from "@/hooks/useKbQueues";
import { useAccounts } from "@/hooks/useAccounts";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { TableFilters } from "@/components/shared/TableFilters";
import { filterRows } from "@/lib/table-filters";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TraineeDialog } from "@/components/agents/TraineeDialog";
import { AgentQueueAccessDialog } from "@/components/agents/AgentQueueAccessDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { User } from "@/types/api";

type AgentTypeFilter = "ALL" | "AGENTS" | "TRAINEES";

function agentTypeLabel(user: User) {
  return user.is_trainee ? "Trainee" : "Agent";
}

export function AgentsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN) ?? false;
  const canManageAgents = user ? canAccessPermission(user, "agents") : false;
  const { data: accounts = [] } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const [accountId, setAccountId] = useState<number | null>(null);
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;
  const { data = [], isLoading } = useAgents(selectedAccountId);
  const { data: queueSummary } = useAgentsQueueSummary(selectedAccountId);
  const promoteTrainee = usePromoteTrainee();
  const [traineeOpen, setTraineeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState<AgentTypeFilter>("ALL");
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [promotingId, setPromotingId] = useState<number | null>(null);
  const [queueAgent, setQueueAgent] = useState<User | null>(null);
  const [queueDialogOpen, setQueueDialogOpen] = useState(false);

  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  const queuesByUserId = useMemo(() => {
    const map = new Map<number, { queues: { key: string; label: string }[]; isRestricted: boolean }>();
    for (const item of queueSummary?.agents ?? []) {
      map.set(item.user_id, { queues: item.queues, isRestricted: item.is_restricted });
    }
    return map;
  }, [queueSummary]);

  const typeCounts = useMemo(
    () => ({
      all: data.length,
      agents: data.filter((u) => !u.is_trainee).length,
      trainees: data.filter((u) => u.is_trainee).length,
    }),
    [data],
  );

  const filteredData = useMemo(
    () =>
      filterRows(
        data,
        search,
        (u) =>
          [
            u.email,
            u.first_name ?? "",
            u.last_name ?? "",
            u.status,
            agentTypeLabel(u),
            ...(queuesByUserId.get(u.id)?.queues.map((q) => q.label) ?? []),
            ...u.account_ids.map((id) => accountNameById.get(id) ?? ""),
          ].join(" "),
        [
          (u) => statusFilter === "ALL" || u.status === statusFilter,
          (u) =>
            typeFilter === "ALL" ||
            (typeFilter === "TRAINEES" ? Boolean(u.is_trainee) : !u.is_trainee),
        ],
      ),
    [data, search, statusFilter, typeFilter, accountNameById, queuesByUserId],
  );

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  async function handlePromote(agent: User) {
    if (!canManageAgents || selectedAccountId == null || !agent.is_trainee) return;

    const name = [agent.first_name, agent.last_name].filter(Boolean).join(" ") || agent.email;
    const confirmed = window.confirm(
      `Promote ${name} from trainee to full agent on ${selectedAccount?.name ?? "this account"}?`,
    );
    if (!confirmed) return;

    setFeedback(null);
    setPromotingId(agent.id);
    try {
      await promoteTrainee.mutateAsync({ userId: agent.id, accountId: selectedAccountId });
      setFeedback({ kind: "success", message: `${name} is now a full agent.` });
    } catch (e) {
      setFeedback({ kind: "error", message: formatUserError(e) });
    } finally {
      setPromotingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserCheck}
        title="Agents & Trainees"
        description={
          selectedAccount
            ? `Agents assigned to ${selectedAccount.name}`
            : "View and onboard agent accounts for your team"
        }
        actions={
          canManageAgents ? (
            <Button onClick={() => setTraineeOpen(true)} disabled={accounts.length === 0}>
              <Plus className="mr-2 h-4 w-4" /> New Trainee
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[220px]">
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
      </div>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {(
          [
            { id: "ALL" as const, label: "All", count: typeCounts.all, icon: Users },
            { id: "AGENTS" as const, label: "Agents", count: typeCounts.agents, icon: UserCheck },
            { id: "TRAINEES" as const, label: "Trainees", count: typeCounts.trainees, icon: GraduationCap },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <Button
              key={tab.id}
              variant={typeFilter === tab.id ? "default" : "outline"}
              size="sm"
              onClick={() => setTypeFilter(tab.id)}
            >
              <Icon className="mr-2 h-4 w-4" />
              {tab.label}
              <Badge variant="muted" className="ml-2 text-[10px] tabular-nums">
                {tab.count}
              </Badge>
            </Button>
          );
        })}
      </div>

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by email, name, or account…"
        filters={[
          {
            id: "agent-status-filter",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "ALL", label: "All statuses" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ],
          },
        ]}
        onClear={() => {
          setSearch("");
          setStatusFilter("ALL");
        }}
        totalCount={data.length}
        filteredCount={filteredData.length}
      />

      <DataTable<User>
        columns={[
          { key: "id", header: "ID", sortable: true },
          {
            key: "type",
            header: "Type",
            sortable: true,
            render: (r) => (
              <Badge variant={r.is_trainee ? "warning" : "default"}>
                {agentTypeLabel(r)}
              </Badge>
            ),
          },
          { key: "email", header: "Email", sortable: true },
          {
            key: "name",
            header: "Name",
            render: (r) => [r.first_name, r.last_name].filter(Boolean).join(" ") || "—",
          },
          {
            key: "accounts",
            header: "Accounts",
            render: (r) => (
              <div className="flex flex-wrap gap-1">
                {r.account_ids.length
                  ? r.account_ids.map((id) => (
                      <Badge key={id} variant="muted">
                        {accountNameById.get(id) ?? `Account #${id}`}
                      </Badge>
                    ))
                  : "—"}
              </div>
            ),
          },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          {
            key: "kb_queues",
            header: "KB Queues",
            render: (r) => {
              const summary = queuesByUserId.get(r.id);
              if (!summary) return "—";
              if (!summary.isRestricted) {
                return (
                  <Badge variant="muted" title="No supervisor restriction — all queues allowed">
                    All queues
                  </Badge>
                );
              }
              return (
                <div className="flex flex-wrap gap-1">
                  {summary.queues.map((q) => (
                    <Badge key={q.key} variant="default">
                      {q.label}
                    </Badge>
                  ))}
                </div>
              );
            },
          },
          ...(canManageAgents
            ? [
                {
                  key: "actions",
                  header: "",
                  render: (r: User) => (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setQueueAgent(r);
                          setQueueDialogOpen(true);
                        }}
                        disabled={selectedAccountId == null}
                      >
                        <ListChecks className="mr-2 h-4 w-4" />
                        Queues
                      </Button>
                      {r.is_trainee ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePromote(r)}
                          disabled={promotingId === r.id || selectedAccountId == null}
                        >
                          <UserPlus className="mr-2 h-4 w-4" />
                          {promotingId === r.id ? "Promoting…" : "Promote to agent"}
                        </Button>
                      ) : null}
                    </div>
                  ),
                },
              ]
            : []),
        ]}
        data={filteredData}
        keyFn={(r) => r.id}
        loading={isLoading}
        emptyMessage={
          accounts.length === 0
            ? "No accounts available. Ask an admin to assign you to an account."
            : data.length
              ? typeFilter === "TRAINEES"
                ? "No trainees match your filters"
                : typeFilter === "AGENTS"
                  ? "No agents match your filters"
                  : "No agents match your search"
              : "No agents on this account yet — add a trainee to get started"
        }
      />

      {feedback && (
        <p className={`text-sm ${feedback.kind === "success" ? "text-emerald-700" : "text-red-600"}`}>
          {feedback.message}
        </p>
      )}

      <TraineeDialog
        open={traineeOpen}
        onOpenChange={setTraineeOpen}
        accounts={accounts}
        defaultAccountId={selectedAccountId != null ? String(selectedAccountId) : ""}
      />

      <AgentQueueAccessDialog
        open={queueDialogOpen}
        onOpenChange={setQueueDialogOpen}
        agent={queueAgent}
        accountId={selectedAccountId}
      />
    </div>
  );
}
