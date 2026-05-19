import { useMemo, useState } from "react";
import { Briefcase, Plus, Trash2, Users, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/roles";
import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount } from "@/hooks/useAccounts";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useLLMConfigs } from "@/hooks/useLLMConfigs";
import { useAccountUsers, useAssignAccount, useUnassignAccount, useUsers } from "@/hooks/useUsers";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { TableFilters } from "@/components/shared/TableFilters";
import { filterRows } from "@/lib/table-filters";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CorpusSelect } from "@/components/shared/CorpusSelect";
import { useCorpora } from "@/hooks/useCorpora";
import { resolveCorpusDisplayName } from "@/lib/corpus";
import type { Account, User } from "@/types/api";

export function AccountsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const { data: orgs = [] } = useOrganizations(isSuperAdmin);
  const { data: llmConfigs = [] } = useLLMConfigs(isSuperAdmin);
  const { data: corpora = [] } = useCorpora();
  const { data = [], isLoading } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const assignAccount = useAssignAccount();
  const unassignAccount = useUnassignAccount();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersAccount, setMembersAccount] = useState<Account | null>(null);
  const [addUserId, setAddUserId] = useState("");
  const [membersError, setMembersError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({ organization_id: "", name: "", description: "", corpus_id: "", llm_config_id: "", status: "ACTIVE" });
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [orgFilter, setOrgFilter] = useState("ALL");

  const { data: accountMembers = [], isLoading: membersLoading } = useAccountUsers(
    membersAccount?.id ?? null,
  );
  const { data: candidateUsers = [] } = useUsers(
    isSuperAdmin ? null : (membersAccount?.organization_id ?? null),
  );
  const availableUsers = candidateUsers.filter(
    (u) => u.status === "ACTIVE" && !accountMembers.some((m) => m.id === u.id),
  );

  const orgNameById = useMemo(() => new Map(orgs.map((o) => [o.id, o.name])), [orgs]);

  function resolveOrganizationName(account: Account): string {
    return (
      account.organization_name
      ?? orgNameById.get(account.organization_id)
      ?? `Organization #${account.organization_id}`
    );
  }

  function openMembers(acc: Account) {
    setMembersAccount(acc);
    setAddUserId("");
    setMembersError(null);
    setMembersOpen(true);
  }

  async function handleAddMember() {
    if (!membersAccount || !addUserId) return;
    setMembersError(null);
    try {
      await assignAccount.mutateAsync({
        userId: Number(addUserId),
        body: { account_id: membersAccount.id },
      });
      setAddUserId("");
    } catch (e) {
      setMembersError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleRemoveMember(userId: number) {
    if (!membersAccount) return;
    setMembersError(null);
    try {
      await unassignAccount.mutateAsync({ userId, accountId: membersAccount.id });
    } catch (e) {
      setMembersError(e instanceof Error ? e.message : String(e));
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({
      organization_id: String(user?.organization_id ?? orgs[0]?.id ?? ""),
      name: "",
      description: "",
      corpus_id: "",
      llm_config_id: "",
      status: "ACTIVE",
    });
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(acc: Account) {
    setEditing(acc);
    setForm({
      organization_id: String(acc.organization_id),
      name: acc.name,
      description: acc.description ?? "",
      corpus_id: acc.corpus_id ?? "",
      llm_config_id: acc.llm_config_id != null ? String(acc.llm_config_id) : "",
      status: acc.status,
    });
    setError(null);
    setDialogOpen(true);
  }

  const filteredData = useMemo(
    () =>
      filterRows(
        data,
        search,
        (a) =>
          [
            a.name,
            a.description ?? "",
            resolveOrganizationName(a),
            a.organization_code ?? "",
            resolveCorpusDisplayName(a.corpus_id, corpora),
            a.status,
          ].join(" "),
        [
          (a) => statusFilter === "ALL" || a.status === statusFilter,
          (a) => orgFilter === "ALL" || String(a.organization_id) === orgFilter,
        ],
      ),
    [data, search, statusFilter, orgFilter, corpora, orgNameById],
  );

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setOrgFilter("ALL");
  }

  async function handleSave() {
    setError(null);
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        corpus_id: form.corpus_id || null,
        llm_config_id: form.llm_config_id ? Number(form.llm_config_id) : null,
        status: form.status,
      };
      if (editing) {
        await updateAccount.mutateAsync({ id: editing.id, body });
      } else {
        await createAccount.mutateAsync({ ...body, organization_id: Number(form.organization_id) });
      }
      setDialogOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Briefcase}
        title="Accounts"
        description="Manage customer accounts"
        actions={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New Account</Button>}
      />

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, organization, or knowledge base…"
        filters={[
          ...(isSuperAdmin
            ? [
                {
                  id: "account-org-filter",
                  label: "Organization",
                  value: orgFilter,
                  onChange: setOrgFilter,
                  options: [
                    { value: "ALL", label: "All organizations" },
                    ...orgs.map((o) => ({ value: String(o.id), label: o.name })),
                  ],
                },
              ]
            : []),
          {
            id: "account-status-filter",
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
        onClear={clearFilters}
        totalCount={data.length}
        filteredCount={filteredData.length}
      />

      <DataTable<Account>
        columns={[
          { key: "id", header: "ID", sortable: true },
          { key: "name", header: "Name", sortable: true },
          {
            key: "organization_id",
            header: "Organization",
            sortable: true,
            render: (r) => (
              <span title={r.organization_code ?? undefined}>
                {resolveOrganizationName(r)}
              </span>
            ),
          },
          {
            key: "corpus_id",
            header: "Knowledge base",
            render: (r) => resolveCorpusDisplayName(r.corpus_id, corpora),
          },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex gap-2">
                {isSuperAdmin && (
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openMembers(r); }}>
                    <Users className="mr-1 h-4 w-4" /> Members
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ),
          },
        ]}
        data={filteredData}
        keyFn={(r) => r.id}
        loading={isLoading}
        emptyMessage={data.length ? "No accounts match your search or filters" : "No accounts"}
        onRowClick={openEdit}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Account" : "New Account"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!editing && isSuperAdmin && (
              <div>
                <Label>Organization</Label>
                <Select value={form.organization_id} onChange={(e) => setForm({ ...form, organization_id: e.target.value })} className="mt-1">
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              </div>
            )}
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" /></div>
            <CorpusSelect
              value={form.corpus_id}
              onChange={(corpusId) => setForm({ ...form, corpus_id: corpusId })}
            />
            <div>
              <Label>LLM Config</Label>
              <Select value={form.llm_config_id} onChange={(e) => setForm({ ...form, llm_config_id: e.target.value })} className="mt-1">
                <option value="">None</option>
                {llmConfigs.map((c) => <option key={c.id} value={c.id}>{c.provider} / {c.model_name}</option>)}
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Members — {membersAccount?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {membersLoading ? (
                <p className="text-sm text-muted-foreground">Loading members...</p>
              ) : accountMembers.length ? (
                accountMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{member.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {[member.first_name, member.last_name].filter(Boolean).join(" ") || `User #${member.id}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={unassignAccount.isPending}
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No users assigned to this account.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Select value={addUserId} onChange={(e) => setAddUserId(e.target.value)} className="flex-1">
                <option value="">Select user</option>
                {availableUsers.map((u: User) => (
                  <option key={u.id} value={u.id}>
                    {u.email}{isSuperAdmin && u.organization_id !== membersAccount?.organization_id ? ` (org ${u.organization_id})` : ""}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddMember}
                disabled={!addUserId || assignAccount.isPending}
              >
                Add
              </Button>
            </div>
            {!membersLoading && availableUsers.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No active users available to assign to this account.
              </p>
            )}
            {isSuperAdmin && availableUsers.some((u) => u.organization_id !== membersAccount?.organization_id) && (
              <p className="text-sm text-muted-foreground">
                Users from another organization will be moved into organization #{membersAccount?.organization_id} when assigned.
              </p>
            )}
            {membersError && <p className="text-sm text-red-600">{membersError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMembersOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId != null}
        title="Delete account"
        message="Assigned users and related account data will also be removed."
        destructive
        loading={deleteAccount.isPending}
        onCancel={() => { setDeleteId(null); setDeleteError(null); }}
        onConfirm={async () => {
          if (deleteId) {
            setDeleteError(null);
            try {
              await deleteAccount.mutateAsync(deleteId);
              setDeleteId(null);
            } catch (e) {
              setDeleteError(e instanceof Error ? e.message : String(e));
              setDeleteId(null);
            }
          }
        }}
      />
      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
    </div>
  );
}
