import { useMemo, useState } from "react";
import { Plus, Ticket as TicketIcon, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatUserError } from "@/lib/errors";
import { ROLES } from "@/lib/roles";
import { useAccounts } from "@/hooks/useAccounts";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useTickets, useTicketOpenCount, useCreateTicket, useUpdateTicket, useDeleteTicket } from "@/hooks/useTickets";
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
import type { DeveloperNotify, Ticket } from "@/types/api";

export function TicketsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const canSubmitTickets =
    !!user &&
    (user.roles.includes(ROLES.SUPER_ADMIN) ||
      user.roles.includes(ROLES.ORG_ADMIN) ||
      user.roles.includes(ROLES.ACCOUNT_MANAGER) ||
      user.roles.includes(ROLES.SUPERVISOR) ||
      user.roles.includes(ROLES.DEVELOPER));
  const { data: openBadge } = useTicketOpenCount(isSuperAdmin ?? false);
  const openForSuperAdmin = openBadge?.open_count ?? 0;
  const { data: organizations = [] } = useOrganizations(isSuperAdmin ?? false);
  const { data: accounts = [] } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const { data = [], isLoading } = useTickets({ organization_id: isSuperAdmin ? undefined : user?.organization_id });
  const createTicket = useCreateTicket();
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [orgFilter, setOrgFilter] = useState("ALL");
  const [form, setForm] = useState({
    organization_id: "",
    account_id: "",
    ticket_type: "SUPPORT",
    status: "OPEN",
    subject: "",
    description: "",
    assigned_to: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [emailNotify, setEmailNotify] = useState<DeveloperNotify | null>(null);

  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const organizationNameById = useMemo(
    () => new Map(organizations.map((o) => [o.id, o.name])),
    [organizations],
  );
  const ticketTypeOptions = useMemo(
    () =>
      Array.from(
        new Set(data.map((t) => t.ticket_type).filter((v): v is string => !!v && v.trim().length > 0)),
      ).sort((a, b) => a.localeCompare(b)),
    [data],
  );
  const filteredData = useMemo(
    () =>
      filterRows(
        data,
        search,
        (t) =>
          [
            t.subject ?? "",
            t.description ?? "",
            t.ticket_type ?? "",
            t.status ?? "",
            organizationNameById.get(t.organization_id) ?? "",
            t.account_id != null ? accountNameById.get(t.account_id) ?? `Account #${t.account_id}` : "",
          ].join(" "),
        [
          (t) => statusFilter === "ALL" || t.status === statusFilter,
          (t) => typeFilter === "ALL" || t.ticket_type === typeFilter,
          (t) => orgFilter === "ALL" || String(t.organization_id) === orgFilter,
        ],
      ),
    [data, search, statusFilter, typeFilter, orgFilter, organizationNameById, accountNameById],
  );

  const createAccounts = useMemo(() => {
    if (!isSuperAdmin) return accounts;
    const orgId = form.organization_id ? Number(form.organization_id) : null;
    return orgId ? accounts.filter((a) => a.organization_id === orgId) : accounts;
  }, [accounts, form.organization_id, isSuperAdmin]);

  function defaultCreateOrganizationId(): string {
    if (!isSuperAdmin) return String(user?.organization_id ?? "");
    const orgWithAccounts = organizations.find((o) => accounts.some((a) => a.organization_id === o.id));
    return String(orgWithAccounts?.id ?? organizations[0]?.id ?? "");
  }

  function openCreate() {
    setEditing(null);
    setForm({
      organization_id: defaultCreateOrganizationId(),
      account_id: "",
      ticket_type: "SUPPORT",
      status: "OPEN",
      subject: "",
      description: "",
      assigned_to: "",
    });
    setError(null);
    setEmailNotify(null);
    setDialogOpen(true);
  }

  function openEdit(t: Ticket) {
    setEditing(t);
    setForm({
      account_id: t.account_id != null ? String(t.account_id) : "",
      ticket_type: t.ticket_type ?? "SUPPORT",
      status: t.status ?? "OPEN",
      subject: t.subject ?? "",
      description: t.description ?? "",
      assigned_to: t.assigned_to != null ? String(t.assigned_to) : "",
    });
    setError(null);
    setEmailNotify(null);
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
            status: form.status,
            subject: form.subject,
            description: form.description,
            assigned_to: form.assigned_to ? Number(form.assigned_to) : null,
          },
        });
      } else {
        const created = await createTicket.mutateAsync({
          organization_id: isSuperAdmin ? Number(form.organization_id) : user!.organization_id,
          account_id: form.account_id ? Number(form.account_id) : null,
          ticket_type: form.ticket_type,
          subject: form.subject,
          description: form.description,
        });
        setEmailNotify(created.developer_notify);
        return;
      }
      setDialogOpen(false);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setOrgFilter("ALL");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={TicketIcon}
        title="Tickets"
        description={
          isSuperAdmin && openForSuperAdmin > 0
            ? `${openForSuperAdmin} open or in-progress ticket${openForSuperAdmin === 1 ? "" : "s"} need your attention`
            : "Tickets from organization admins, account managers, supervisors, and developers (super admins triage here)"
        }
        actions={
          canSubmitTickets ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New Ticket
            </Button>
          ) : undefined
        }
      />

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by subject, type, status, account, or organization…"
        filters={[
          ...(isSuperAdmin
            ? [
                {
                  id: "ticket-org-filter",
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
          {
            id: "ticket-status-filter",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "ALL", label: "All statuses" },
              { value: "OPEN", label: "Open" },
              { value: "IN_PROGRESS", label: "In progress" },
              { value: "RESOLVED", label: "Resolved" },
              { value: "CLOSED", label: "Closed" },
            ],
          },
          {
            id: "ticket-type-filter",
            label: "Type",
            value: typeFilter,
            onChange: setTypeFilter,
            options: [
              { value: "ALL", label: "All types" },
              ...ticketTypeOptions.map((t) => ({ value: t, label: t })),
            ],
          },
        ]}
        onClear={clearFilters}
        totalCount={data.length}
        filteredCount={filteredData.length}
      />

      <DataTable<Ticket>
        columns={[
          { key: "id", header: "ID", sortable: true },
          { key: "subject", header: "Subject", sortable: true },
          ...(isSuperAdmin
            ? [
                {
                  key: "organization_id",
                  header: "Organization",
                  render: (r: Ticket) => organizationNameById.get(r.organization_id) ?? `Org #${r.organization_id}`,
                },
                {
                  key: "account_id",
                  header: "Account",
                  render: (r: Ticket) =>
                    r.account_id != null
                      ? accountNameById.get(r.account_id) ?? `Account #${r.account_id}`
                      : "—",
                },
              ]
            : []),
          {
            key: "created_at",
            header: "Date",
            sortable: true,
            render: (r) => (r.created_at ? new Date(r.created_at).toLocaleString() : "—"),
          },
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
        data={filteredData}
        keyFn={(r) => r.id}
        loading={isLoading}
        emptyMessage={data.length ? "No tickets match your search or filters" : "No tickets"}
        onRowClick={openEdit}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="flex max-h-[min(90vh,calc(100dvh-2rem))] max-w-lg flex-col overflow-hidden p-0">
          <DialogHeader className="mb-0 border-b border-slate-100 px-6 py-4">
            <DialogTitle>{editing ? "Edit Ticket" : "New Ticket"}</DialogTitle>
          </DialogHeader>
          <DialogBody className="min-h-0 flex-1 px-6 py-4">
          <div className="space-y-4">
            {!editing && (
              <>
                {isSuperAdmin && (
                  <div>
                    <Label>Organization</Label>
                    <Select
                      value={form.organization_id}
                      onChange={(e) => setForm({ ...form, organization_id: e.target.value, account_id: "" })}
                      className="mt-1"
                    >
                      {organizations.map((o) => (
                        <option key={o.id} value={o.id}>{o.name}</option>
                      ))}
                    </Select>
                  </div>
                )}
                <div>
                  <Label>Account</Label>
                  <Select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} className="mt-1">
                    <option value="">None</option>
                    {createAccounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}{isSuperAdmin && !form.organization_id ? ` (${a.organization_name ?? `org ${a.organization_id}`})` : ""}
                      </option>
                    ))}
                  </Select>
                </div>
              </>
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
            {emailNotify && (
              <div
                className={
                  emailNotify.status === "sent"
                    ? "rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800"
                    : emailNotify.status === "disabled" || emailNotify.status === "no_recipients"
                      ? "rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
                      : "rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
                }
                role="status"
              >
                <p className="font-medium">
                  {emailNotify.status === "sent"
                    ? "Developer email sent"
                    : emailNotify.status === "failed"
                      ? "Developer email not sent"
                      : "Developer email skipped"}
                </p>
                <p className="mt-1">{emailNotify.message}</p>
              </div>
            )}
          </div>
          </DialogBody>
          <DialogFooter className="mt-0 border-t border-slate-100 px-6 py-4">
            {emailNotify ? (
              <Button
                onClick={() => {
                  setEmailNotify(null);
                  setDialogOpen(false);
                }}
              >
                Close
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleSave} disabled={createTicket.isPending || updateTicket.isPending}>
                  {editing ? "Save" : createTicket.isPending ? "Creating…" : "Create"}
                </Button>
              </>
            )}
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
