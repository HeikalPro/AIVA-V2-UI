import { useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { formatUserError } from "@/lib/errors";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import {
  useCreateOrganization,
  useDeleteOrganization,
  useOrganizationDeletePreview,
  useOrganizations,
  useUpdateOrganization,
} from "@/hooks/useOrganizations";
import { useAccounts } from "@/hooks/useAccounts";
import { useUsers } from "@/hooks/useUsers";
import { filterRows } from "@/lib/table-filters";
import { OrganizationDeleteDialog } from "@/components/organizations/OrganizationDeleteDialog";
import { Page, PageHeading } from "@/components/shell/page";
import { DataTable, actionsColumn, type Column, type DataTableEmpty } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Status } from "@/components/data/status";
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
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { OverflowChips } from "@/components/users/OverflowChips";
import { useDeepLinks } from "@/components/users/useDeepLinks";
import type { Organization, OrganizationDeleteSummary } from "@/types/api";
import { useReturnFocus } from "@/components/users/useReturnFocus";

export function OrganizationsPage() {
  const orgsQuery = useOrganizations();
  const { data = [], isLoading } = orgsQuery;
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();
  const deleteOrg = useDeleteOrganization();
  const returnFocus = useReturnFocus();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const deleteOrgId = deleteTarget?.id ?? null;
  const {
    data: deleteSummary,
    isLoading: loadingDeletePreview,
    isError: deletePreviewFailed,
  } = useOrganizationDeletePreview(deleteOrgId);
  const { data: orgUsers = [], isLoading: loadingOrgUsers } = useUsers(deleteOrgId);
  const { data: orgAccounts = [], isLoading: loadingOrgAccounts } = useAccounts(deleteOrgId);

  const effectiveDeleteSummary = useMemo((): OrganizationDeleteSummary | null => {
    if (!deleteTarget) return null;
    if (deleteSummary) return deleteSummary;
    return {
      organization_id: deleteTarget.id,
      name: deleteTarget.name,
      code: deleteTarget.code,
      user_count: orgUsers.length,
      account_count: orgAccounts.length,
      ticket_count: 0,
      account_names: orgAccounts.map((a) => a.name),
    };
  }, [deleteTarget, deleteSummary, orgUsers, orgAccounts]);

  const loadingDeleteSummary =
    !!deleteTarget && (loadingDeletePreview || loadingOrgUsers || loadingOrgAccounts);

  function openCreate() {
    setEditing(null);
    setName("");
    setCode("");
    setStatus("ACTIVE");
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(org: Organization) {
    setEditing(org);
    setName(org.name);
    setCode(org.code);
    setStatus(org.status);
    setError(null);
    setDialogOpen(true);
  }

  function openDelete(org: Organization) {
    setDeleteTarget(org);
    setDeleteError(null);
  }

  function closeDelete() {
    if (!deleteOrg.isPending) {
      setDeleteTarget(null);
      setDeleteError(null);
    }
  }

  // Command palette: ?action=create opens the create dialog, ?q=<name> pre-fills the search.
  useDeepLinks({ onCreate: openCreate, onSearch: setSearch });

  async function handleSave() {
    setError(null);
    try {
      if (editing) {
        await updateOrg.mutateAsync({ id: editing.id, body: { name, status } });
        toast.success("Organization updated", { description: name });
      } else {
        await createOrg.mutateAsync({ name, code, status });
        toast.success("Organization created", { description: name });
      }
      setDialogOpen(false);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (createOrg.isPending || updateOrg.isPending) return;
    void handleSave();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      const result = await deleteOrg.mutateAsync(deleteTarget.id);
      toast.success(result.message || "Organization deleted");
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(formatUserError(e));
    }
  }

  const summaryError = deletePreviewFailed && !deleteSummary ? "preview_unavailable" : null;

  const filteredData = useMemo(
    () =>
      filterRows(
        data,
        search,
        (o) => [o.name, o.code, o.status, ...(o.account_names ?? [])].join(" "),
        [(o) => statusFilter === "ALL" || o.status === statusFilter],
      ),
    [data, search, statusFilter],
  );

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
  }

  const columns: Column<Organization>[] = [
    { key: "id", header: "ID", numeric: true, sortable: true, defaultHidden: true, width: 72 },
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortValue: (o) => o.name.toLowerCase(),
      render: (o) => (
        <span dir="auto" className="block max-w-[18rem] truncate font-medium text-foreground" title={o.name}>
          {o.name}
        </span>
      ),
    },
    {
      key: "code",
      header: "Code",
      sortable: true,
      render: (o) => <span className="font-mono text-xs text-muted-foreground">{o.code}</span>,
    },
    {
      key: "account_names",
      header: "Accounts",
      sortable: true,
      sortValue: (o) => o.account_count ?? o.account_names?.length ?? 0,
      render: (o) => (
        <OverflowChips
          noun="accounts"
          items={(o.account_names ?? []).map((n) => ({ key: n, label: n }))}
          empty={<span className="text-muted-foreground">No accounts</span>}
        />
      ),
    },
    { key: "status", header: "Status", sortable: true, render: (o) => <Status value={o.status} /> },
    {
      key: "created_at",
      header: "Created",
      sortable: true,
      render: (o) =>
        o.created_at ? (
          <Tooltip content={formatDateTime(o.created_at)}>
            <span className="text-muted-foreground">
              {formatDate(o.created_at)}
            </span>
          </Tooltip>
        ) : (
          <span className="text-subtle-foreground">—</span>
        ),
    },
    actionsColumn<Organization>(
      (o) => [
        { label: "Edit", icon: Pencil, onSelect: () => openEdit(o) },
        { label: "Delete", icon: Trash2, destructive: true, separatorBefore: true, onSelect: () => openDelete(o) },
      ],
      { label: (o) => `Actions for ${o.name}` },
    ),
  ];

  const isFiltered = search.trim() !== "" || statusFilter !== "ALL";
  let empty: DataTableEmpty;
  if (orgsQuery.isError) {
    empty = {
      icon: AlertCircle,
      title: "Couldn't load organizations",
      description: formatUserError(orgsQuery.error),
      action: (
        <Button variant="outline" size="sm" onClick={() => void orgsQuery.refetch()}>
          Try again
        </Button>
      ),
    };
  } else if (data.length === 0) {
    empty = {
      icon: Building2,
      title: "No organizations yet",
      description: "Organizations group the accounts and users of one tenant.",
      action: (
        <Button size="sm" onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add organization
        </Button>
      ),
    };
  } else {
    empty = {
      title: "No organizations match these filters",
      action: (
        <Button variant="outline" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      ),
    };
  }

  const editingAccounts = editing?.account_names ?? [];
  const editingAccountCount = editing ? (editing.account_count ?? editing.account_names?.length ?? 0) : 0;

  return (
    <Page width="wide">
      <PageHeading
        title="Organizations"
        description="Tenant organizations and the accounts that belong to them."
        meta={
          isLoading ? (
            <Skeleton className="h-4 w-24" />
          ) : orgsQuery.isError ? null : (
            <span>
              {formatNumber(data.length)} {data.length === 1 ? "organization" : "organizations"}
            </span>
          )
        }
        actions={
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add organization
          </Button>
        }
      />

      <DataTable<Organization>
        aria-label="Organizations"
        columns={columns}
        data={orgsQuery.isError ? [] : filteredData}
        keyFn={(o) => o.id}
        loading={isLoading}
        empty={empty}
        onRowClick={openEdit}
        rowLabel={(o) => o.name}
        itemLabel="organizations"
        defaultSort={{ key: "name", dir: "asc" }}
        enableColumnVisibility
        persistKey="organizations"
        toolbar={
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search name, code or account…"
            filters={[
              {
                id: "org-status-filter",
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
            itemLabel="organizations"
          />
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} size="md">
        <DialogContent onCloseAutoFocus={returnFocus}>
          <form onSubmit={onSubmit} noValidate className="contents">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit organization" : "Add organization"}</DialogTitle>
              <DialogDescription>
                {editing ? "Changes apply to every account and user in this organization." : "A tenant that owns accounts and users."}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <ErrorAlert message={error} />
              <Field label="Name" required>
                <Input dir="auto" value={name} onChange={(e) => setName(e.target.value)} />
              </Field>
              {editing ? (
                <Field label="Code" hint="The code can't be changed.">
                  <Input value={code} readOnly className="font-mono" />
                </Field>
              ) : (
                <Field label="Code" hint="Short unique identifier, e.g. HALAN. It can't be changed later." required>
                  <Input value={code} onChange={(e) => setCode(e.target.value)} className="font-mono" autoComplete="off" />
                </Field>
              )}
              <Field label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </Select>
              </Field>
              {editing && (
                <div className="space-y-1.5">
                  <p className="text-ui font-medium text-foreground">
                    Accounts <span className="font-normal tabular-nums text-muted-foreground">({formatNumber(editingAccountCount)})</span>
                  </p>
                  {editingAccounts.length ? (
                    <OverflowChips max={12} noun="accounts" items={editingAccounts.map((n) => ({ key: n, label: n }))} />
                  ) : (
                    <p className="text-sm text-muted-foreground">No accounts in this organization.</p>
                  )}
                </div>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createOrg.isPending || updateOrg.isPending}>
                {editing ? "Save changes" : "Create organization"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <OrganizationDeleteDialog
        open={deleteTarget != null}
        organization={deleteTarget}
        summary={effectiveDeleteSummary}
        loadingSummary={loadingDeleteSummary}
        summaryError={summaryError}
        deleting={deleteOrg.isPending}
        deleteError={deleteError}
        onCancel={closeDelete}
        onConfirm={handleConfirmDelete}
      />
    </Page>
  );
}
