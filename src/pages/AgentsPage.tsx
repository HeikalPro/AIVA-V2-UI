import { useMemo, useState } from "react";
import { Plus, UserCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES, canAccessPermission } from "@/lib/roles";
import { useAgents } from "@/hooks/useAgents";
import { useAccounts } from "@/hooks/useAccounts";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { TableFilters } from "@/components/shared/TableFilters";
import { filterRows } from "@/lib/table-filters";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { TraineeDialog } from "@/components/agents/TraineeDialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { User } from "@/types/api";

export function AgentsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN) ?? false;
  const canManageAgents = user ? canAccessPermission(user, "agents") : false;
  const { data: accounts = [] } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const [accountId, setAccountId] = useState<number | null>(null);
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;
  const { data = [], isLoading } = useAgents(selectedAccountId);
  const [traineeOpen, setTraineeOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

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
            ...u.account_ids.map((id) => accountNameById.get(id) ?? ""),
          ].join(" "),
        [(u) => statusFilter === "ALL" || u.status === statusFilter],
      ),
    [data, search, statusFilter, accountNameById],
  );

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

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
        ]}
        data={filteredData}
        keyFn={(r) => r.id}
        loading={isLoading}
        emptyMessage={
          accounts.length === 0
            ? "No accounts available. Ask an admin to assign you to an account."
            : data.length
              ? "No agents match your search"
              : "No agents on this account yet — add a trainee to get started"
        }
      />

      <TraineeDialog
        open={traineeOpen}
        onOpenChange={setTraineeOpen}
        accounts={accounts}
        defaultAccountId={selectedAccountId != null ? String(selectedAccountId) : ""}
      />
    </div>
  );
}
