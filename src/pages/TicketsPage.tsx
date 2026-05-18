import { useState } from "react";
import { Plus, Ticket as TicketIcon, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/roles";
import { useAccounts } from "@/hooks/useAccounts";
import { useTickets, useCreateTicket, useUpdateTicket, useDeleteTicket } from "@/hooks/useTickets";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Ticket } from "@/types/api";

export function TicketsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const { data: accounts = [] } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const { data = [], isLoading } = useTickets({ organization_id: isSuperAdmin ? undefined : user?.organization_id });
  const createTicket = useCreateTicket();
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    account_id: "",
    ticket_type: "SUPPORT",
    priority: "MEDIUM",
    status: "OPEN",
    subject: "",
    description: "",
    assigned_to: "",
  });
  const [error, setError] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setForm({ account_id: "", ticket_type: "SUPPORT", priority: "MEDIUM", status: "OPEN", subject: "", description: "", assigned_to: "" });
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(t: Ticket) {
    setEditing(t);
    setForm({
      account_id: t.account_id != null ? String(t.account_id) : "",
      ticket_type: t.ticket_type ?? "SUPPORT",
      priority: t.priority ?? "MEDIUM",
      status: t.status ?? "OPEN",
      subject: t.subject ?? "",
      description: t.description ?? "",
      assigned_to: t.assigned_to != null ? String(t.assigned_to) : "",
    });
    setError(null);
    setDialogOpen(true);
  }

  async function handleSave() {
    setError(null);
    try {
      if (editing) {
        await updateTicket.mutateAsync({
          id: editing.id,
          body: {
            ticket_type: form.ticket_type,
            priority: form.priority,
            status: form.status,
            subject: form.subject,
            description: form.description,
            assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
          },
        });
      } else {
        await createTicket.mutateAsync({
          organization_id: user!.organization_id,
          account_id: form.account_id ? Number(form.account_id) : null,
          ticket_type: form.ticket_type,
          priority: form.priority,
          subject: form.subject,
          description: form.description,
        });
      }
      setDialogOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={TicketIcon}
        title="Tickets"
        description="Support and escalation tickets"
        actions={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New Ticket</Button>}
      />

      <DataTable<Ticket>
        columns={[
          { key: "id", header: "ID", sortable: true },
          { key: "subject", header: "Subject", sortable: true },
          { key: "priority", header: "Priority", sortable: true },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          { key: "ticket_type", header: "Type", render: (r) => r.ticket_type ?? "—" },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>Edit</Button>
                {(isSuperAdmin || user?.roles.includes(ROLES.ORG_ADMIN)) && (
                  <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                )}
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
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Edit Ticket" : "New Ticket"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!editing && (
              <div>
                <Label>Account</Label>
                <Select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} className="mt-1">
                  <option value="">None</option>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Select>
              </div>
            )}
            <div><Label>Subject</Label><Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="mt-1" /></div>
            <div>
              <Label>Description</Label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Type</Label>
                <Input value={form.ticket_type} onChange={(e) => setForm({ ...form, ticket_type: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })} className="mt-1">
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </Select>
              </div>
            </div>
            {editing && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Status</Label>
                  <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1">
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN_PROGRESS</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                  </Select>
                </div>
                <div>
                  <Label>Assigned To (User ID)</Label>
                  <Input value={form.assigned_to} onChange={(e) => setForm({ ...form, assigned_to: e.target.value })} className="mt-1" />
                </div>
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId != null}
        title="Delete ticket"
        message="This action cannot be undone."
        destructive
        loading={deleteTicket.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={async () => { if (deleteId) await deleteTicket.mutateAsync(deleteId); setDeleteId(null); }}
      />
    </div>
  );
}
