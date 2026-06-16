import { useMemo, useState } from "react";
import { Plus, Trash2, Users, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatUserError } from "@/lib/errors";
import { ROLES } from "@/lib/roles";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useAssignAccount,
  useUnassignAccount,
  useSetUserRole,
} from "@/hooks/useUsers";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useAccounts } from "@/hooks/useAccounts";
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
import { Badge } from "@/components/ui/badge";
import type { User } from "@/types/api";

const ROLE_OPTIONS = [
  { id: 1, name: "SUPER_ADMIN" },
  { id: 2, name: "ORGANIZATION_ADMIN" },
  { id: 3, name: "ACCOUNT_MANAGER" },
  { id: 4, name: "SUPERVISOR" },
  { id: 5, name: "AGENT" },
  { id: 6, name: "DEVELOPER" },
];

function primaryRoleId(user: User): string {
  const primaryName = user.roles[0];
  const match = ROLE_OPTIONS.find((r) => r.name === primaryName);
  return String(match?.id ?? "5");
}

export function UsersPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const isOrgAdmin = user?.roles.includes(ROLES.ORG_ADMIN);
  const isAccountManager = user?.roles.includes(ROLES.ACCOUNT_MANAGER);
  const canCreateUsers = isSuperAdmin || isOrgAdmin;
  const canDeleteUsers = isSuperAdmin || isOrgAdmin;
  const canAssignAccounts = isSuperAdmin || isOrgAdmin || isAccountManager;
  const { data: orgs = [] } = useOrganizations(isSuperAdmin);
  const { data: accounts = [] } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const { data = [], isLoading } = useUsers(isSuperAdmin ? null : user?.organization_id);
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const assignAccount = useAssignAccount();
  const unassignAccount = useUnassignAccount();
  const setUserRole = useSetUserRole();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [addAccountId, setAddAccountId] = useState("");
  const [form, setForm] = useState({
    organization_id: "",
    email: "",
    password: "",
    first_name: "",
    last_name: "",
    status: "ACTIVE",
    role_id: "5",
    account_id: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [orgFilter, setOrgFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");

  const createOrgId = !editing && form.organization_id ? Number(form.organization_id) : null;
  const createAccounts = createOrgId
    ? accounts.filter((a) => a.organization_id === createOrgId)
    : accounts;
  const editOrgId = editing?.organization_id ?? null;
  const editAccounts = isSuperAdmin
    ? accounts
    : editOrgId
      ? accounts.filter((a) => a.organization_id === editOrgId)
      : accounts;
  const accountNameById = new Map(accounts.map((a) => [a.id, a.name]));
  const orgNameById = useMemo(() => new Map(orgs.map((o) => [o.id, o.name])), [orgs]);
  const availableAccounts = editAccounts.filter((a) => !(editing?.account_ids ?? []).includes(a.id));

  function resolveOrganizationName(u: User): string {
    return (
      u.organization_name
      ?? orgNameById.get(u.organization_id)
      ?? `Organization #${u.organization_id}`
    );
  }

  function defaultCreateOrganizationId(): string {
    if (!isSuperAdmin) return String(user?.organization_id ?? "");
    const orgWithAccounts = orgs.find((o) => accounts.some((a) => a.organization_id === o.id));
    return String(orgWithAccounts?.id ?? orgs[0]?.id ?? "");
  }

  function openCreate() {
    setEditing(null);
    setForm({
      organization_id: defaultCreateOrganizationId(),
      email: "",
      password: "",
      first_name: "",
      last_name: "",
      status: "ACTIVE",
      role_id: "5",
      account_id: "",
    });
    setError(null);
    setAddAccountId("");
    setDialogOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setForm({
      organization_id: String(u.organization_id),
      email: u.email,
      password: "",
      first_name: u.first_name ?? "",
      last_name: u.last_name ?? "",
      status: u.status,
      role_id: primaryRoleId(u),
      account_id: "",
    });
    setError(null);
    setAddAccountId("");
    setDialogOpen(true);
  }

  async function handleAddAccount() {
    if (!editing || !addAccountId) return;
    setError(null);
    try {
      const updated = await assignAccount.mutateAsync({
        userId: editing.id,
        body: { account_id: Number(addAccountId) },
      });
      setEditing(updated);
      setAddAccountId("");
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  async function handleRemoveAccount(accountId: number) {
    if (!editing) return;
    setError(null);
    try {
      const updated = await unassignAccount.mutateAsync({ userId: editing.id, accountId });
      setEditing(updated);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

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
            resolveOrganizationName(u),
            u.organization_code ?? "",
            u.status,
            ...u.roles,
            ...u.account_ids.map((id) => accountNameById.get(id) ?? ""),
          ].join(" "),
        [
          (u) => statusFilter === "ALL" || u.status === statusFilter,
          (u) => orgFilter === "ALL" || String(u.organization_id) === orgFilter,
          (u) => roleFilter === "ALL" || u.roles.includes(roleFilter),
        ],
      ),
    [data, search, statusFilter, orgFilter, roleFilter, accountNameById, orgNameById],
  );

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setOrgFilter("ALL");
    setRoleFilter("ALL");
  }

  async function handleSave() {
    setError(null);
    try {
      if (editing) {
        const orgChanged =
          isSuperAdmin && Number(form.organization_id) !== editing.organization_id;
        const updated = await updateUser.mutateAsync({
          id: editing.id,
          body: {
            ...(orgChanged ? { organization_id: Number(form.organization_id) } : {}),
            email: form.email,
            first_name: form.first_name || null,
            last_name: form.last_name || null,
            status: form.status,
          },
        });
        setEditing(updated);
        if (isSuperAdmin) {
          await setUserRole.mutateAsync({
            userId: editing.id,
            body: { role_id: Number(form.role_id) },
          });
        }
      } else {
        await createUser.mutateAsync({
          organization_id: Number(form.organization_id),
          email: form.email,
          password: form.password,
          first_name: form.first_name || null,
          last_name: form.last_name || null,
          status: form.status,
          role_id: Number(form.role_id),
          account_id: form.account_id ? Number(form.account_id) : null,
        });
      }
      setDialogOpen(false);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Users}
        title="Users"
        description="Manage platform users and roles"
        actions={
          canCreateUsers ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New User
            </Button>
          ) : undefined
        }
      />

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by email, name, organization, role, or account…"
        filters={[
          ...(isSuperAdmin
            ? [
                {
                  id: "user-org-filter",
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
            id: "user-role-filter",
            label: "Role",
            value: roleFilter,
            onChange: setRoleFilter,
            options: [
              { value: "ALL", label: "All roles" },
              ...ROLE_OPTIONS.map((r) => ({ value: r.name, label: r.name })),
            ],
          },
          {
            id: "user-status-filter",
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
            key: "roles",
            header: "Roles",
            render: (r) => (
              <div className="flex flex-wrap gap-1">
                {r.roles.map((role) => <Badge key={role}>{role}</Badge>)}
              </div>
            ),
          },
          {
                key: "accounts",
                header: "Accounts",
                render: (r: User) => (
                  <div className="flex flex-wrap gap-1">
                    {r.account_ids.length
                      ? r.account_ids.map((id) => (
                          <Badge key={id} variant="muted">{accountNameById.get(id) ?? `Account #${id}`}</Badge>
                        ))
                      : "—"}
                  </div>
                ),
          },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>Edit</Button>
                {canDeleteUsers && r.id !== user?.id ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteError(null);
                      setDeleteId(r.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                ) : null}
              </div>
            ),
          },
        ]}
        data={filteredData}
        keyFn={(r) => r.id}
        loading={isLoading}
        emptyMessage={data.length ? "No users match your search or filters" : "No users"}
        onRowClick={openEdit}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit User" : "New User"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {isSuperAdmin && (
              <div>
                <Label>Organization</Label>
                <Select value={form.organization_id} onChange={(e) => setForm({ ...form, organization_id: e.target.value, account_id: "" })} className="mt-1">
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
                {!editing && createOrgId && createAccounts.length === 0 && (
                  <p className="mt-1 text-sm text-amber-700">
                    No accounts in this organization. Create an account first, or pick another organization (e.g. GoChat247 for Hallan).
                  </p>
                )}
                {editing && Number(form.organization_id) !== editing.organization_id && (
                  <p className="mt-1 text-sm text-amber-700">
                    Changing organization removes account access for accounts outside the new organization.
                  </p>
                )}
              </div>
            )}
            <div><Label>Email</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-1" /></div>
            {!editing && (
              <div>
                <Label>Password</Label>
                <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="mt-1" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div><Label>First Name</Label><Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} className="mt-1" /></div>
              <div><Label>Last Name</Label><Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} className="mt-1" /></div>
            </div>
            {(!editing || isSuperAdmin) && (
              <div>
                <Label>Role</Label>
                <Select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })} className="mt-1">
                  {ROLE_OPTIONS.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                </Select>
                {editing && isSuperAdmin && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Replaces the user&apos;s current role. Account access below is unchanged.
                  </p>
                )}
              </div>
            )}
            {!editing && (
              <div>
                <Label>Account (optional)</Label>
                <Select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} className="mt-1">
                  <option value="">None</option>
                  {createAccounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </div>
            )}
            {editing && canAssignAccounts && (
              <div className="space-y-3 rounded-md border p-3">
                <Label>Account Access</Label>
                <div className="space-y-2">
                  {editing.account_ids.length ? (
                    editing.account_ids.map((accountId) => (
                      <div key={accountId} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
                        <span className="text-sm">{accountNameById.get(accountId) ?? `Account #${accountId}`}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveAccount(accountId)}
                          disabled={unassignAccount.isPending}
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">No accounts assigned.</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Select
                    value={addAccountId}
                    onChange={(e) => setAddAccountId(e.target.value)}
                    className="flex-1"
                  >
                    <option value="">Select account</option>
                    {availableAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}{isSuperAdmin && a.organization_id !== editing.organization_id ? ` (org ${a.organization_id})` : ""}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleAddAccount}
                    disabled={!addAccountId || assignAccount.isPending}
                  >
                    Add
                  </Button>
                </div>
                {availableAccounts.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No available accounts to assign to this user.
                  </p>
                )}
                {isSuperAdmin && editing && availableAccounts.some((a) => a.organization_id !== editing.organization_id) && (
                  <p className="text-sm text-muted-foreground">
                    Assigning an account from another organization will move this user into that account&apos;s organization.
                  </p>
                )}
              </div>
            )}
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
            <Button
              onClick={handleSave}
              disabled={createUser.isPending || updateUser.isPending || setUserRole.isPending}
            >
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId != null}
        title="Delete user"
        message={
          deleteBusy
            ? "Deleting user…"
            : "This permanently removes the user and cannot be undone."
        }
        destructive
        loading={deleteBusy}
        confirmLabel="Delete"
        error={deleteError}
        onCancel={() => {
          if (deleteBusy) return;
          setDeleteId(null);
          setDeleteError(null);
        }}
        onConfirm={async () => {
          if (!deleteId || deleteBusy) return;
          setDeleteError(null);
          setDeleteBusy(true);
          try {
            await deleteUser.mutateAsync(deleteId);
            setDeleteId(null);
            setDeleteError(null);
          } catch (e) {
            setDeleteError(formatUserError(e));
          } finally {
            setDeleteBusy(false);
          }
        }}
      />
    </div>
  );
}
