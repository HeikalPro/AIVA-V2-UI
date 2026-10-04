import { useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Lock, Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatUserError } from "@/lib/errors";
import { formatDateTime, formatNumber, formatRelativeTime } from "@/lib/format";
import { ROLES, canAccessPermission } from "@/lib/roles";
import { useAccounts } from "@/hooks/useAccounts";
import { useOrganizations } from "@/hooks/useOrganizations";
import {
  useAccountUpdates,
  useCreateAccountUpdate,
  useUpdateAccountUpdate,
  useDeleteAccountUpdate,
} from "@/hooks/useAccountUpdates";
import { filterRows } from "@/lib/table-filters";
import { Page, PageHeading } from "@/components/shell/page";
import { DataTable, actionsColumn, type Column, type DataTableEmpty } from "@/components/data/data-table";
import { EmptyState } from "@/components/data/empty-state";
import { FilterBar } from "@/components/data/filter-bar";
import { Status } from "@/components/data/status";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { useDeepLinks } from "@/components/users/useDeepLinks";
import type { AccountAnnouncement } from "@/types/api";
import { useReturnFocus } from "@/components/users/useReturnFocus";

export function AccountUpdatesPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const canManage = user != null && canAccessPermission(user, "account-updates");

  const { data: organizations = [] } = useOrganizations(isSuperAdmin ?? false);
  const accountsQuery = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const { data: accounts = [] } = accountsQuery;
  const updatesQuery = useAccountUpdates({
    organization_id: isSuperAdmin ? undefined : user?.organization_id,
  });
  const { data = [], isLoading } = updatesQuery;
  const createUpdate = useCreateAccountUpdate();
  const updateUpdate = useUpdateAccountUpdate();
  const deleteUpdate = useDeleteAccountUpdate();
  const returnFocus = useReturnFocus();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AccountAnnouncement | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [orgFilter, setOrgFilter] = useState("ALL");
  const [accountFilter, setAccountFilter] = useState("ALL");
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

  function accountName(u: AccountAnnouncement): string {
    return u.account_name ?? accountNameById.get(u.account_id) ?? `Account #${u.account_id}`;
  }

  function organizationName(u: AccountAnnouncement): string {
    return u.organization_name ?? organizationNameById.get(u.organization_id ?? 0) ?? `Org #${u.organization_id}`;
  }

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
          (u) => accountFilter === "ALL" || String(u.account_id) === accountFilter,
        ],
      ),
    [data, search, statusFilter, orgFilter, accountFilter, accountNameById],
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

  // Command palette: ?action=create opens the publish dialog once accounts are loaded.
  useDeepLinks({
    onCreate: openCreate,
    canCreate: canManage,
    onSearch: setSearch,
    ready: !accountsQuery.isLoading,
  });

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
        toast.success("Update saved", { description: form.title.trim() });
      } else {
        await createUpdate.mutateAsync({
          account_id: Number(form.account_id),
          title: form.title.trim(),
          body: form.body.trim(),
          is_active: form.is_active,
        });
        toast.success(form.is_active ? "Update published" : "Update saved as inactive", {
          description: form.title.trim(),
        });
      }
      setDialogOpen(false);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (createUpdate.isPending || updateUpdate.isPending) return;
    void handleSave();
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setOrgFilter("ALL");
    setAccountFilter("ALL");
  }

  if (!canManage) {
    return (
      <Page width="wide">
        <PageHeading title="Updates" />
        <EmptyState
          icon={Lock}
          title="You don't have permission to manage updates"
          description="Ask an administrator for access to Updates."
        />
      </Page>
    );
  }

  const columns: Column<AccountAnnouncement>[] = [
    {
      key: "title",
      header: "Title",
      sortable: true,
      sortValue: (u) => u.title.toLowerCase(),
      minWidth: 240,
      render: (u) => (
        <div className="min-w-0 max-w-[28rem]">
          <p className="truncate font-medium text-foreground" title={u.title}>
            <span dir="auto">{u.title}</span>
          </p>
          <p className="truncate text-xs text-muted-foreground" title={u.body}>
            <span dir="auto">{u.body}</span>
          </p>
        </div>
      ),
    },
    {
      key: "account",
      header: "Account",
      sortable: true,
      sortValue: (u) => accountName(u).toLowerCase(),
      render: (u) => (
        <span dir="auto" className="block max-w-[12rem] truncate">
          {accountName(u)}
        </span>
      ),
    },
    ...(isSuperAdmin
      ? [
          {
            key: "organization",
            header: "Organization",
            sortable: true,
            sortValue: (u: AccountAnnouncement) => organizationName(u).toLowerCase(),
            render: (u: AccountAnnouncement) => (
              <span dir="auto" className="block max-w-[12rem] truncate">
                {organizationName(u)}
              </span>
            ),
          } satisfies Column<AccountAnnouncement>,
        ]
      : []),
    {
      key: "is_active",
      header: "Status",
      sortable: true,
      sortValue: (u) => (u.is_active ? 0 : 1),
      render: (u) => <Status tone={u.is_active ? "success" : "neutral"} label={u.is_active ? "Active" : "Inactive"} />,
    },
    {
      key: "created_at",
      header: "Created",
      sortable: true,
      render: (u) =>
        u.created_at ? (
          <Tooltip content={formatDateTime(u.created_at)}>
            <span className="whitespace-nowrap text-muted-foreground">{formatRelativeTime(u.created_at)}</span>
          </Tooltip>
        ) : (
          <span className="text-subtle-foreground">—</span>
        ),
    },
    actionsColumn<AccountAnnouncement>(
      (u) => [
        { label: "Edit", icon: Pencil, onSelect: () => openEdit(u) },
        {
          label: "Delete",
          icon: Trash2,
          destructive: true,
          separatorBefore: true,
          onSelect: () => {
            setDeleteError(null);
            setDeleteId(u.id);
          },
        },
      ],
      { label: (u) => `Actions for ${u.title}` },
    ),
  ];

  const isFiltered = search.trim() !== "" || statusFilter !== "ALL" || orgFilter !== "ALL" || accountFilter !== "ALL";
  let empty: DataTableEmpty;
  if (updatesQuery.isError) {
    empty = {
      icon: AlertCircle,
      title: "Couldn't load updates",
      description: formatUserError(updatesQuery.error),
      action: (
        <Button variant="outline" size="sm" onClick={() => void updatesQuery.refetch()}>
          Try again
        </Button>
      ),
    };
  } else if (data.length === 0) {
    empty = {
      icon: Megaphone,
      title: "No updates yet",
      description: "Publish an announcement and agents see it in the widget when they sign in.",
      action: (
        <Button size="sm" onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Publish update
        </Button>
      ),
    };
  } else {
    empty = {
      title: "No updates match these filters",
      action: (
        <Button variant="outline" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      ),
    };
  }

  const deleteTarget = deleteId != null ? data.find((u) => u.id === deleteId) : undefined;

  return (
    <Page width="wide">
      <PageHeading
        title="Updates"
        description="Announcements shown in agents' desktop widget when they sign in to their account."
        meta={
          isLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : updatesQuery.isError ? null : (
            <span>
              {formatNumber(data.length)} {data.length === 1 ? "update" : "updates"}
            </span>
          )
        }
        actions={
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            Publish update
          </Button>
        }
      />

      <DataTable<AccountAnnouncement>
        aria-label="Updates"
        columns={columns}
        data={updatesQuery.isError ? [] : filteredData}
        keyFn={(u) => u.id}
        loading={isLoading}
        empty={empty}
        onRowClick={openEdit}
        rowLabel={(u) => u.title}
        itemLabel="updates"
        defaultSort={{ key: "created_at", dir: "desc" }}
        toolbar={
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search title, message or account…"
            filters={[
              {
                id: "update-account-filter",
                label: "Account",
                value: accountFilter,
                onChange: setAccountFilter,
                options: [
                  { value: "ALL", label: "All" },
                  ...createAccounts.map((a) => ({ value: String(a.id), label: a.name })),
                ],
              },
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
              {
                id: "update-org-filter",
                label: "Organization",
                value: orgFilter,
                onChange: setOrgFilter,
                hidden: !isSuperAdmin,
                options: [
                  { value: "ALL", label: "All" },
                  ...organizations.map((o) => ({ value: String(o.id), label: o.name })),
                ],
              },
            ]}
            onClear={clearFilters}
            isFiltered={isFiltered}
            totalCount={isFiltered ? data.length : undefined}
            filteredCount={filteredData.length}
            itemLabel="updates"
          />
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} size="lg">
        <DialogContent onCloseAutoFocus={returnFocus}>
          <form onSubmit={onSubmit} noValidate className="contents">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit update" : "Publish update"}</DialogTitle>
              <DialogDescription>
                {editing ? (
                  <>
                    For <bdi className="font-medium text-foreground">{accountName(editing)}</bdi>
                  </>
                ) : (
                  "Agents assigned to the account see this update in the widget."
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <ErrorAlert message={error} />
              {!editing && (
                <Field label="Account" required hint="Agents assigned to this account will see this update in the widget.">
                  <Select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
                    <option value="">Select account…</option>
                    {createAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                        {isSuperAdmin ? ` (${a.organization_name ?? `org ${a.organization_id}`})` : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              )}
              <Field label="Title" required>
                <Input
                  dir="auto"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. New knowledge base articles"
                />
              </Field>
              <Field label="Message" required>
                <Textarea
                  dir="auto"
                  rows={6}
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder="Write the update message agents will see…"
                />
              </Field>
              <Field
                orientation="horizontal"
                label="Active"
                hint="Visible to agents in the widget. Turn off to hide it without deleting."
              >
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v === true })} />
              </Field>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createUpdate.isPending || updateUpdate.isPending}>
                {editing ? "Save changes" : createUpdate.isPending ? "Publishing…" : "Publish"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId != null}
        title="Delete update"
        message="Agents will no longer see this update. This action cannot be undone."
        destructive
        confirmLabel="Delete"
        loading={deleteUpdate.isPending}
        loadingLabel="Deleting…"
        error={deleteError}
        onCancel={() => {
          setDeleteId(null);
          setDeleteError(null);
        }}
        onConfirm={async () => {
          if (!deleteId) return;
          setDeleteError(null);
          try {
            await deleteUpdate.mutateAsync(deleteId);
            toast.success("Update deleted", deleteTarget ? { description: deleteTarget.title } : undefined);
            setDeleteId(null);
          } catch (e) {
            setDeleteError(formatUserError(e));
          }
        }}
      >
        {deleteTarget && (
          <p className="rounded-md border border-border bg-surface-muted px-3 py-2 text-foreground">
            <bdi className="font-medium">{deleteTarget.title}</bdi>
          </p>
        )}
      </ConfirmDialog>
    </Page>
  );
}
