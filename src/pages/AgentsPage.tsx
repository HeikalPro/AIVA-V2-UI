import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Building2, ListChecks, Plus, UserCheck, UserPlus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { formatUserError } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { canAccessPermission } from "@/lib/roles";
import { filterRows } from "@/lib/table-filters";
import { useAgents, usePromoteTrainee } from "@/hooks/useAgents";
import { useAgentsQueueSummary } from "@/hooks/useKbQueues";
import { Page, PageHeading } from "@/components/shell/page";
import { DataTable, actionsColumn, type Column, type DataTableEmpty } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Status } from "@/components/data/status";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { TraineeDialog } from "@/components/agents/TraineeDialog";
import { AgentQueueAccessDialog } from "@/components/agents/AgentQueueAccessDialog";
import { OverflowChips } from "@/components/users/OverflowChips";
import type { User } from "@/types/api";

type AgentTypeFilter = "ALL" | "AGENTS" | "TRAINEES";

function agentTypeLabel(user: User) {
  return user.is_trainee ? "Trainee" : "Agent";
}

function displayName(user: User) {
  return [user.first_name, user.last_name].filter(Boolean).join(" ");
}

export function AgentsPage() {
  const { user } = useAuth();
  const workspace = useWorkspace();
  const canManageAgents = user ? canAccessPermission(user, "agents") : false;
  const accounts = workspace.accounts;
  const selectedAccountId = workspace.accountId;
  const agentsQuery = useAgents(selectedAccountId);
  const { data = [], isLoading } = agentsQuery;
  const { data: queueSummary } = useAgentsQueueSummary(selectedAccountId);
  const promoteTrainee = usePromoteTrainee();
  const [traineeOpen, setTraineeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState<AgentTypeFilter>("ALL");
  const [promoteTarget, setPromoteTarget] = useState<User | null>(null);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [promotingId, setPromotingId] = useState<number | null>(null);
  const [queueAgent, setQueueAgent] = useState<User | null>(null);
  const [queueDialogOpen, setQueueDialogOpen] = useState(false);

  // Filters belong to one account: start clean when the workspace changes.
  useEffect(() => {
    setSearch("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
  }, [selectedAccountId]);

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

  const selectedAccount = workspace.account;
  const accountName = selectedAccount?.name ?? "this account";

  function openPromote(agent: User) {
    if (!canManageAgents || selectedAccountId == null || !agent.is_trainee) return;
    setPromoteError(null);
    setPromoteTarget(agent);
  }

  async function handlePromote(agent: User) {
    if (!canManageAgents || selectedAccountId == null || !agent.is_trainee) return;
    const name = displayName(agent) || agent.email;
    setPromoteError(null);
    setPromotingId(agent.id);
    try {
      await promoteTrainee.mutateAsync({ userId: agent.id, accountId: selectedAccountId });
      setPromoteTarget(null);
      toast.success(`${name} is now a full agent.`);
    } catch (e) {
      setPromoteError(formatUserError(e));
    } finally {
      setPromotingId(null);
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
  }

  const columns: Column<User>[] = [
    { key: "id", header: "ID", numeric: true, sortable: true, defaultHidden: true, width: 72 },
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortValue: (u) => (displayName(u) || u.email).toLowerCase(),
      minWidth: 200,
      render: (u) => {
        const name = displayName(u);
        return (
          <div className="flex min-w-0 max-w-[18rem] items-center gap-2.5">
            <Avatar name={name || u.email} size="sm" title={false} />
            {name ? (
              <span dir="auto" className="truncate font-medium text-foreground" title={name}>
                {name}
              </span>
            ) : (
              <span className="truncate text-muted-foreground">No name</span>
            )}
          </div>
        );
      },
    },
    { key: "email", header: "Email", sortable: true, truncate: true, maxWidth: "17rem" },
    {
      key: "kb_queues",
      header: "Queues",
      render: (u) => {
        const summary = queuesByUserId.get(u.id);
        if (!summary) return <span className="text-subtle-foreground">—</span>;
        if (!summary.isRestricted) {
          return (
            <Tooltip content="No supervisor restriction: every queue of the account is allowed">
              <Badge variant="outline" tabIndex={0} className="text-muted-foreground">
                All queues
              </Badge>
            </Tooltip>
          );
        }
        return (
          <OverflowChips
            noun="queues"
            variant="primary"
            items={summary.queues.map((q) => ({ key: q.key, label: q.label }))}
          />
        );
      },
    },
    {
      key: "type",
      header: "Role",
      sortable: true,
      sortValue: (u) => agentTypeLabel(u),
      render: (u) => <Badge variant={u.is_trainee ? "warning" : "neutral"}>{agentTypeLabel(u)}</Badge>,
    },
    {
      key: "accounts",
      header: "Accounts",
      defaultHidden: true,
      render: (u) => (
        <OverflowChips
          noun="accounts"
          items={u.account_ids.map((id) => ({ key: id, label: accountNameById.get(id) ?? `Account #${id}` }))}
        />
      ),
    },
    { key: "status", header: "Status", sortable: true, render: (u) => <Status value={u.status} /> },
    ...(canManageAgents
      ? [
          actionsColumn<User>(
            (u) => [
              {
                label: "Edit queue access",
                icon: ListChecks,
                disabled: selectedAccountId == null,
                onSelect: () => {
                  setQueueAgent(u);
                  setQueueDialogOpen(true);
                },
              },
              {
                label: promotingId === u.id ? "Promoting…" : "Promote to agent",
                icon: UserPlus,
                hidden: !u.is_trainee,
                disabled: promotingId === u.id || selectedAccountId == null,
                separatorBefore: true,
                onSelect: () => openPromote(u),
              },
            ],
            { label: (u) => `Actions for ${u.email}` },
          ),
        ]
      : []),
  ];

  const isFiltered = search.trim() !== "" || statusFilter !== "ALL";
  let empty: DataTableEmpty;
  if (!workspace.isLoading && accounts.length === 0) {
    empty = {
      icon: Building2,
      title: "No accounts available",
      description: "Ask an admin to assign you to an account.",
    };
  } else if (agentsQuery.isError) {
    empty = {
      icon: AlertCircle,
      title: "Couldn't load agents",
      description: formatUserError(agentsQuery.error),
      action: (
        <Button variant="outline" size="sm" onClick={() => void agentsQuery.refetch()}>
          Try again
        </Button>
      ),
    };
  } else if (data.length === 0) {
    empty = {
      icon: UserCheck,
      title: "No agents on this account yet",
      description: canManageAgents ? "Add a trainee to get started." : undefined,
      action: canManageAgents ? (
        <Button size="sm" onClick={() => setTraineeOpen(true)}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add trainee
        </Button>
      ) : undefined,
    };
  } else {
    empty = {
      title:
        typeFilter === "TRAINEES"
          ? "No trainees match these filters"
          : typeFilter === "AGENTS"
            ? "No agents match these filters"
            : "No agents match your search",
      action: isFiltered ? (
        <Button variant="outline" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      ) : undefined,
    };
  }

  const promoteName = promoteTarget ? displayName(promoteTarget) || promoteTarget.email : "";
  const listLoading = workspace.isLoading || isLoading;

  return (
    <Page width="wide">
      <PageHeading
        title="Agents & Trainees"
        description={
          selectedAccount
            ? `Agents and trainees on ${selectedAccount.name}, and the knowledge-base queues they can use.`
            : "View and onboard agent accounts for your team."
        }
        actions={
          canManageAgents ? (
            <Button onClick={() => setTraineeOpen(true)} disabled={accounts.length === 0}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              Add trainee
            </Button>
          ) : undefined
        }
      />

      <DataTable<User>
        aria-label="Agents and trainees"
        columns={columns}
        data={agentsQuery.isError ? [] : filteredData}
        keyFn={(u) => u.id}
        loading={listLoading}
        empty={empty}
        rowLabel={(u) => u.email}
        itemLabel={typeFilter === "TRAINEES" ? "trainees" : "agents"}
        enableColumnVisibility
        persistKey="agents"
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <Tabs variant="segmented" value={typeFilter} onValueChange={(v) => setTypeFilter(v as AgentTypeFilter)}>
              <TabsList aria-label="Agent type">
                <TabsTrigger value="ALL" count={listLoading ? undefined : formatNumber(typeCounts.all)}>
                  All
                </TabsTrigger>
                <TabsTrigger value="AGENTS" count={listLoading ? undefined : formatNumber(typeCounts.agents)}>
                  Agents
                </TabsTrigger>
                <TabsTrigger value="TRAINEES" count={listLoading ? undefined : formatNumber(typeCounts.trainees)}>
                  Trainees
                </TabsTrigger>
              </TabsList>
            </Tabs>
            <FilterBar
              className="min-w-0 flex-1"
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search name, email, queue or account…"
              filters={[
                {
                  id: "agent-status-filter",
                  label: "Status",
                  value: statusFilter,
                  onChange: setStatusFilter,
                  options: [
                    { value: "ALL", label: "All" },
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ],
                },
              ]}
              onClear={clearFilters}
              isFiltered={isFiltered}
              totalCount={isFiltered ? data.length : undefined}
              filteredCount={filteredData.length}
              itemLabel="agents"
            />
          </div>
        }
      />

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

      <ConfirmDialog
        open={promoteTarget != null}
        title="Promote to agent?"
        message={`Promote ${promoteName} from trainee to full agent on ${accountName}?`}
        confirmLabel="Promote to agent"
        loading={promoteTarget != null && promotingId === promoteTarget.id}
        loadingLabel="Promoting…"
        error={promoteError}
        onCancel={() => {
          if (promotingId != null) return;
          setPromoteTarget(null);
          setPromoteError(null);
        }}
        onConfirm={() => {
          if (promoteTarget) void handlePromote(promoteTarget);
        }}
      />
    </Page>
  );
}
