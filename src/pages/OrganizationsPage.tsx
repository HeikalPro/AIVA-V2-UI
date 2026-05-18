import { useState } from "react";
import { Building2, Plus, Trash2 } from "lucide-react";
import {
  useCreateOrganization,
  useDeleteOrganization,
  useOrganizations,
  useUpdateOrganization,
} from "@/hooks/useOrganizations";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Organization } from "@/types/api";

export function OrganizationsPage() {
  const { data = [], isLoading } = useOrganizations();
  const createOrg = useCreateOrganization();
  const updateOrg = useUpdateOrganization();
  const deleteOrg = useDeleteOrganization();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Organization | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }}>
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

      <ConfirmDialog
        open={deleteId != null}
        title="Delete organization"
        message="Remove all users, accounts, and tickets in this organization before deleting it."
        destructive
        loading={deleteOrg.isPending}
        onCancel={() => { setDeleteId(null); setDeleteError(null); }}
        onConfirm={async () => {
          if (deleteId) {
            setDeleteError(null);
            try {
              await deleteOrg.mutateAsync(deleteId);
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
