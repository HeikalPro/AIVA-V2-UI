import { useMemo, useState } from "react";
import { Bell, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatUserError } from "@/lib/errors";
import { ROLES, canAccessPermission } from "@/lib/roles";
import { useAccounts } from "@/hooks/useAccounts";
import { useOrganizations } from "@/hooks/useOrganizations";
import {
  useAccountUpdates,
  useCreateAccountUpdate,
  useUpdateAccountUpdate,
  useDeleteAccountUpdate,
} from "@/hooks/useAccountUpdates";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { TableFilters } from "@/components/shared/TableFilters";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { filterRows } from "@/lib/table-filters";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { AccountAnnouncement } from "@/types/api";

export function AccountUpdatesPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const canManage = user != null && canAccessPermission(user, "account-updates");

  const { data: organizations = [] } = useOrganizations(isSuperAdmin ?? false);
  const { data: accounts = [] } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const { data = [], isLoading } = useAccountUpdates({
    organization_id: isSuperAdmin ? undefined : user?.organization_id,
  });
  const createUpdate = useCreateAccountUpdate();
  const updateUpdate = useUpdateAccountUpdate();
  const deleteUpdate = useDeleteAccountUpdate();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AccountAnnouncement | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [orgFilter, setOrgFilter] = useState("ALL");
  const [form, setForm] = useState({
    account_id: "",
    title: "",
    body: "",
    is_active: true,
  });
  const [error, setError] = useState<string | null>(null);

  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const organizationNameById = useMemo(
    () => new Map(organizations.map((o) => [o.id, o.name])),
    [organizations],
  );

  const filteredData = useMemo(
    () =>
      filterRows(
        data,
        search,
        (u) =>
          [
            u.title ?? "",
            u.body ?? "",
            u.account_name ?? accountNameById.get(u.account_id) ?? "",
            u.organization_name ?? "",
          ].join(" "),
        [
          (u) => statusFilter === "ALL" || (statusFilter === "ACTIVE" ? u.is_active : !u.is_active),
          (u) => orgFilter === "ALL" || String(u.organization_id) === orgFilter,
        ],
      ),
    [data, search, statusFilter, orgFilter, accountNameById],
  );

  const createAccounts = useMemo(() => {
    if (!isSuperAdmin) return accounts;
    const orgId = orgFilter !== "ALL" ? Number(orgFilter) : null;
    return orgId ? accounts.filter((a) => a.organization_id === orgId) : accounts;
  }, [accounts, orgFilter, isSuperAdmin]);

  function openCreate() {
    setEditing(null);
    const firstAccount = createAccounts[0];
    setForm({
      account_id: firstAccount ? String(firstAccount.id) : "",
      title: "",
      body: "",
      is_active: true,
    });
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(item: AccountAnnouncement) {
    setEditing(item);
    setForm({
      account_id: String(item.account_id),
      title: item.title,
      body: item.body,
      is_active: item.is_active,
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setError(null);
    if (!form.account_id) {
      setError("Please select an account.");
      return;
    }
    if (!form.title.trim() || !form.body.trim()) {
      setError("Title and message are required.");
      return;
    }
    try {
      if (editing) {
        await updateUpdate.mutateAsync({
          id: editing.id,
          body: {
            title: form.title.trim(),
            body: form.body.trim(),
            is_active: form.is_active,
          },
        });
      } else {
        await createUpdate.mutateAsync({
          account_id: Number(form.account_id),
          title: form.title.trim(),
          body: form.body.trim(),
          is_active: form.is_active,
        });
      }
      setDialogOpen(false);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setOrgFilter("ALL");
  }

  if (!canManage) {
    return (
      <div className="p-6 text-sm text-slate-600">
        You do not have permission to manage account updates.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Bell}
        title="Account Updates"
        description="Publish announcements for agents. Updates appear in the widget when agents log in to their account."
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Update
          </Button>
        }
      />

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search updates…"
        filters={[
          {
            id: "update-status-filter",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "ALL", label: "All" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ],
          },
          ...(isSuperAdmin
            ? [
                {
                  id: "update-org-filter",
                  label: "Organization",
                  value: orgFilter,
                  onChange: setOrgFilter,
                  options: [
                    { value: "ALL", label: "All organizations" },
                    ...organizations.map((o) => ({ value: String(o.id), label: o.name })),
                  ],
                },
              ]
            : []),
        ]}
        onClear={clearFilters}
        totalCount={data.length}
        filteredCount={filteredData.length}
      />

      <DataTable
        columns={[
          {
            key: "account",
            header: "Account",
            render: (r: AccountAnnouncement) =>
              r.account_name ?? accountNameById.get(r.account_id) ?? `Account #${r.account_id}`,
          },
          ...(isSuperAdmin
            ? [
                {
                  key: "organization",
                  header: "Organization",
                  render: (r: AccountAnnouncement) =>
                    r.organization_name ??
                    organizationNameById.get(r.organization_id ?? 0) ??
                    `Org #${r.organization_id}`,
                },
              ]
            : []),
          { key: "title", header: "Title", sortable: true },
          {
            key: "is_active",
            header: "Status",
            render: (r) => <StatusBadge status={r.is_active ? "ACTIVE" : "INACTIVE"} />,
          },
          {
            key: "created_at",
            header: "Created",
            sortable: true,
            render: (r) => (r.created_at ? new Date(r.created_at).toLocaleString() : "—"),
          },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    openEdit(r);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(r.id);
                  }}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ),
          },
        ]}
        data={filteredData}
        keyFn={(r) => r.id}
        loading={isLoading}
        emptyMessage={data.length ? "No updates match your search or filters" : "No account updates yet"}
        onRowClick={openEdit}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[min(90vh,calc(100dvh-2rem))] max-w-lg flex-col overflow-hidden p-0">
          <DialogHeader className="mb-0 border-b border-slate-100 px-6 py-4">
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-[#004080]" />
              {editing ? "Edit Account Update" : "New Account Update"}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="min-h-0 flex-1 px-6 py-4">
            <div className="space-y-4">
              {!editing && (
                <div>
                  <Label>Account</Label>
                  <Select
                    value={form.account_id}
                    onChange={(e) => setForm({ ...form, account_id: e.target.value })}
                    className="mt-1"
                  >
                    <option value="">Select account…</option>
                    {createAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {isSuperAdmin ? ` (${a.organization_name ?? `org ${a.organization_id}`})` : ""}
                      </option>
                    ))}
                  </Select>
                  <p className="mt-1 text-xs text-slate-500">
                    Agents assigned to this account will see this update in the widget.
                  </p>
                </div>
              )}
              {editing && (
                <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  Account:{" "}
                  <span className="font-medium">
                    {editing.account_name ?? accountNameById.get(editing.account_id) ?? editing.account_id}
                  </span>
                </div>
              )}
              <div>
                <Label>Title</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. New knowledge base articles"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Message</Label>
                <textarea
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  rows={5}
                  placeholder="Write the update message agents will see…"
                  className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="is_active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <Label htmlFor="is_active" className="cursor-pointer font-normal">
                  Active (visible to agents in the widget)
                </Label>
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>
          </DialogBody>
          <DialogFooter className="mt-0 border-t border-slate-100 px-6 py-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={createUpdate.isPending || updateUpdate.isPending}>
              {editing ? "Save" : createUpdate.isPending ? "Creating…" : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId != null}
        title="Delete account update"
        message="Agents will no longer see this update. This action cannot be undone."
        destructive
        loading={deleteUpdate.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => {
          if (deleteId) await deleteUpdate.mutateAsync(deleteId);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
