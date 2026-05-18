import { useMemo, useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import {
  useCreateOrganization,
  useDeleteOrganization,
  useOrganizationDeletePreview,
  useOrganizations,
  useUpdateOrganization,
} from "@/hooks/useOrganizations";
import { useAccounts } from "@/hooks/useAccounts";
import { useUsers } from "@/hooks/useUsers";
import { OrganizationDeleteDialog } from "@/components/organizations/OrganizationDeleteDialog";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Organization, OrganizationDeleteSummary } from "@/types/api";

export function OrganizationsPage() {
  const { data = [], isLoading } = useOrganizations();
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();
  const deleteOrg = useDeleteOrganization();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Organization | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

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

  async function handleSave() {
    setError(null);
    try {
      if (editing) {
        await updateOrg.mutateAsync({ id: editing.id, body: { name, status } });
      } else {
        await createOrg.mutateAsync({ name, code, status });
      }
      setDialogOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleteError(null);
    try {
      const result = await deleteOrg.mutateAsync(deleteTarget.id);
      setDeleteSuccess(result.message);
      setDeleteTarget(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    }
  }

  const summaryError = deletePreviewFailed && !deleteSummary ? "preview_unavailable" : null;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Building2}
        title="Organizations"
        description="Manage tenant organizations"
        actions={
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New Organization
          </Button>
        }
      />

      {deleteSuccess && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {deleteSuccess}
        </div>
      )}

      <DataTable<Organization>
        columns={[
          { key: "id", header: "ID", sortable: true },
          { key: "name", header: "Name", sortable: true },
          { key: "code", header: "Code", sortable: true },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openDelete(r); }}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ),
          },
        ]}
        data={data}
        keyFn={(r) => r.id}
        loading={isLoading}
        onRowClick={openEdit}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Organization" : "New Organization"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1" />
            </div>
            {!editing && (
              <div>
                <Label>Code</Label>
                <Input value={code} onChange={(e) => setCode(e.target.value)} className="mt-1" />
              </div>
            )}
            <div>
              <Label>Status</Label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="mt-1">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createOrg.isPending || updateOrg.isPending}>
              {editing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
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
    </div>
  );
}
