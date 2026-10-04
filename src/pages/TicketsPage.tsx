import { useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Pencil, Plus, Ticket as TicketIcon, Trash2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatUserError } from "@/lib/errors";
import { formatDateTime, formatNumber, formatRelativeTime } from "@/lib/format";
import { ROLES, canAccessPermission } from "@/lib/roles";
import { useAccounts } from "@/hooks/useAccounts";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useTickets, useTicketOpenCount, useCreateTicket, useUpdateTicket, useDeleteTicket } from "@/hooks/useTickets";
import { filterRows } from "@/lib/table-filters";
import { Page, PageHeading } from "@/components/shell/page";
import { DataTable, actionsColumn, type Column, type DataTableEmpty } from "@/components/data/data-table";
import { FilterBar, type DateRangeValue } from "@/components/data/filter-bar";
import { Status } from "@/components/data/status";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Badge } from "@/components/ui/badge";
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
import { Field, FieldGroup } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { useDeepLinks } from "@/components/users/useDeepLinks";
import type { DeveloperNotify, Ticket } from "@/types/api";
import { useReturnFocus } from "@/components/users/useReturnFocus";

const STATUS_OPTIONS = [
  { value: "OPEN", label: "Open" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

/** Local calendar day (YYYY-MM-DD) of an ISO timestamp, for the date-range filter. */
function localDay(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Transient result of the developer email that follows a new ticket. */
function notifyToast(notify: DeveloperNotify | undefined, subject: string) {
  if (!notify) {
    toast.success("Ticket created", { description: subject });
    return;
  }
  if (notify.status === "sent") {
    toast.success("Ticket created · developer email sent", { description: notify.message });
  } else if (notify.status === "failed") {
    toast.warning("Ticket created · developer email not sent", { description: notify.message });
  } else {
    toast.info("Ticket created · developer email skipped", { description: notify.message });
  }
}

export function TicketsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const canSubmitTickets = user != null && canAccessPermission(user, "tickets");
  const canDeleteTickets = Boolean(isSuperAdmin || user?.roles.includes(ROLES.ORG_ADMIN));
  const { data: openBadge } = useTicketOpenCount(isSuperAdmin ?? false);
  const openForSuperAdmin = openBadge?.open_count ?? 0;
  const orgsQuery = useOrganizations(isSuperAdmin ?? false);
  const { data: organizations = [] } = orgsQuery;
  const accountsQuery = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const { data: accounts = [] } = accountsQuery;
  const ticketsQuery = useTickets({ organization_id: isSuperAdmin ? undefined : user?.organization_id });
  const { data = [], isLoading } = ticketsQuery;
  const createTicket = useCreateTicket();
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();
  const returnFocus = useReturnFocus();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [orgFilter, setOrgFilter] = useState("ALL");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [dateRange, setDateRange] = useState<DateRangeValue>({ from: "", to: "" });
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

  function accountLabel(t: Ticket): string {
    return t.account_id != null ? accountNameById.get(t.account_id) ?? `Account #${t.account_id}` : "";
  }

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
          (t) => accountFilter === "ALL" || String(t.account_id) === accountFilter,
          (t) => {
            if (!dateRange.from && !dateRange.to) return true;
            const day = t.created_at ? localDay(t.created_at) : "";
            if (!day) return false;
            if (dateRange.from && day < dateRange.from) return false;
            if (dateRange.to && day > dateRange.to) return false;
            return true;
          },
        ],
      ),
    [data, search, statusFilter, typeFilter, orgFilter, accountFilter, dateRange, organizationNameById, accountNameById],
  );

  const filterAccounts = useMemo(() => {
    if (!isSuperAdmin || orgFilter === "ALL") return accounts;
    return accounts.filter((a) => String(a.organization_id) === orgFilter);
  }, [accounts, orgFilter, isSuperAdmin]);

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
    setDialogOpen(true);
  }

  function openEdit(t: Ticket) {
    setEditing(t);
    setForm({
      organization_id: String(t.organization_id),
      account_id: t.account_id != null ? String(t.account_id) : "",
      ticket_type: t.ticket_type ?? "SUPPORT",
      status: t.status ?? "OPEN",
      subject: t.subject ?? "",
      description: t.description ?? "",
      assigned_to: t.assigned_to != null ? String(t.assigned_to) : "",
    });
    setError(null);
    setDialogOpen(true);
  }

  // Command palette: ?action=create opens the create dialog (once organizations/accounts that
  // drive its defaults have loaded); ?q= pre-fills the search.
  useDeepLinks({
    onCreate: openCreate,
    canCreate: canSubmitTickets,
    onSearch: setSearch,
    ready: !accountsQuery.isLoading && !(isSuperAdmin && orgsQuery.isLoading),
  });

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
        toast.success("Ticket updated", { description: form.subject || undefined });
      } else {
        const created = await createTicket.mutateAsync({
          organization_id: isSuperAdmin ? Number(form.organization_id) : user!.organization_id,
          account_id: form.account_id ? Number(form.account_id) : null,
          ticket_type: form.ticket_type,
          subject: form.subject,
          description: form.description,
        });
        notifyToast(created.developer_notify, form.subject);
      }
      setDialogOpen(false);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (createTicket.isPending || updateTicket.isPending) return;
    void handleSave();
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setTypeFilter("ALL");
    setOrgFilter("ALL");
    setAccountFilter("ALL");
    setDateRange({ from: "", to: "" });
  }

  /* ---- table ---------------------------------------------------------------------------- */

  const columns: Column<Ticket>[] = [
    { key: "id", header: "ID", numeric: true, sortable: true, defaultHidden: true, width: 72 },
    {
      key: "subject",
      header: "Subject",
      sortable: true,
      sortValue: (t) => (t.subject ?? "").toLowerCase(),
      minWidth: 220,
      render: (t) => (
        <div className="min-w-0 max-w-[24rem]">
          <p className="truncate font-medium text-foreground" title={t.subject ?? undefined}>
            {t.subject ? <span dir="auto">{t.subject}</span> : <span className="text-muted-foreground">No subject</span>}
          </p>
          {t.description && (
            <p className="truncate text-xs text-muted-foreground" title={t.description}>
              <span dir="auto">{t.description}</span>
            </p>
          )}
        </div>
      ),
    },
    ...(isSuperAdmin
      ? [
          {
            key: "organization_id",
            header: "Organization",
            sortable: true,
            sortValue: (t: Ticket) => organizationNameById.get(t.organization_id) ?? "",
            render: (t: Ticket) => (
              <span dir="auto" className="block max-w-[12rem] truncate">
                {organizationNameById.get(t.organization_id) ?? `Org #${t.organization_id}`}
              </span>
            ),
          } satisfies Column<Ticket>,
        ]
      : []),
    {
      key: "account_id",
      header: "Account",
      sortable: true,
      sortValue: (t) => accountLabel(t) || null,
      render: (t) =>
        t.account_id != null ? (
          <span dir="auto" className="block max-w-[12rem] truncate">
            {accountLabel(t)}
          </span>
        ) : (
          <span className="text-subtle-foreground">—</span>
        ),
    },
    {
      key: "ticket_type",
      header: "Type",
      sortable: true,
      render: (t) => (t.ticket_type ? <Badge variant="neutral">{t.ticket_type}</Badge> : <span className="text-subtle-foreground">—</span>),
    },
    { key: "status", header: "Status", sortable: true, render: (t) => <Status value={t.status} /> },
    {
      key: "created_at",
      header: "Created",
      sortable: true,
      render: (t) =>
        t.created_at ? (
          <Tooltip content={formatDateTime(t.created_at)}>
            <span className="whitespace-nowrap text-muted-foreground">{formatRelativeTime(t.created_at)}</span>
          </Tooltip>
        ) : (
          <span className="text-subtle-foreground">—</span>
        ),
    },
    actionsColumn<Ticket>(
      (t) => [
        { label: "Edit", icon: Pencil, onSelect: () => openEdit(t) },
        {
          label: "Delete",
          icon: Trash2,
          destructive: true,
          separatorBefore: true,
          hidden: !canDeleteTickets,
          onSelect: () => {
            setDeleteError(null);
            setDeleteId(t.id);
          },
        },
      ],
      { label: (t) => `Actions for ticket ${t.id}` },
    ),
  ];

  const isFiltered =
    search.trim() !== "" ||
    statusFilter !== "ALL" ||
    typeFilter !== "ALL" ||
    orgFilter !== "ALL" ||
    accountFilter !== "ALL" ||
    Boolean(dateRange.from || dateRange.to);

  let empty: DataTableEmpty;
  if (ticketsQuery.isError) {
    empty = {
      icon: AlertCircle,
      title: "Couldn't load tickets",
      description: formatUserError(ticketsQuery.error),
      action: (
        <Button variant="outline" size="sm" onClick={() => void ticketsQuery.refetch()}>
          Try again
        </Button>
      ),
    };
  } else if (data.length === 0) {
    empty = {
      icon: TicketIcon,
      title: "No tickets yet",
      description: canSubmitTickets ? "Report a problem or request a change for your team." : undefined,
      action: canSubmitTickets ? (
        <Button size="sm" onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Create ticket
        </Button>
      ) : undefined,
    };
  } else {
    empty = {
      title: "No tickets match these filters",
      action: (
        <Button variant="outline" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      ),
    };
  }

  const deleteTarget = deleteId != null ? data.find((t) => t.id === deleteId) : undefined;

  return (
    <Page width="wide">
      <PageHeading
        title="Tickets"
        description={
          isSuperAdmin && openForSuperAdmin > 0
            ? `${formatNumber(openForSuperAdmin)} open or in-progress ticket${openForSuperAdmin === 1 ? "" : "s"} need your attention.`
            : "Requests from organization admins, account managers, supervisors and developers. Super Admins triage them here."
        }
        meta={
          isLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : ticketsQuery.isError ? null : (
            <span>
              {formatNumber(data.length)} {data.length === 1 ? "ticket" : "tickets"}
            </span>
          )
        }
        actions={
          canSubmitTickets ? (
            <Button onClick={openCreate}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              Create ticket
            </Button>
          ) : undefined
        }
      />

      <DataTable<Ticket>
        aria-label="Tickets"
        columns={columns}
        data={ticketsQuery.isError ? [] : filteredData}
        keyFn={(t) => t.id}
        loading={isLoading}
        empty={empty}
        onRowClick={openEdit}
        rowLabel={(t) => t.subject ?? `Ticket ${t.id}`}
        itemLabel="tickets"
        defaultSort={{ key: "created_at", dir: "desc" }}
        enableColumnVisibility
        persistKey="tickets"
        toolbar={
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search subject, type, account…"
            filters={[
              {
                id: "ticket-status-filter",
                label: "Status",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [{ value: "ALL", label: "All" }, ...STATUS_OPTIONS],
              },
              {
                id: "ticket-type-filter",
                label: "Type",
                value: typeFilter,
                onChange: setTypeFilter,
                options: [{ value: "ALL", label: "All" }, ...ticketTypeOptions.map((t) => ({ value: t, label: t }))],
              },
              {
                id: "ticket-org-filter",
                label: "Organization",
                value: orgFilter,
                onChange: setOrgFilter,
                hidden: !isSuperAdmin,
                options: [
                  { value: "ALL", label: "All" },
                  ...organizations.map((o) => ({ value: String(o.id), label: o.name })),
                ],
              },
              {
                id: "ticket-account-filter",
                label: "Account",
                value: accountFilter,
                onChange: setAccountFilter,
                options: [
                  { value: "ALL", label: "All" },
                  ...filterAccounts.map((a) => ({ value: String(a.id), label: a.name })),
                ],
              },
            ]}
            dateRange={{ ...dateRange, onChange: setDateRange, presets: true, label: "Created" }}
            onClear={clearFilters}
            isFiltered={isFiltered}
            totalCount={isFiltered ? data.length : undefined}
            filteredCount={filteredData.length}
            itemLabel="tickets"
          />
        }
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} size="lg">
        <DialogContent onCloseAutoFocus={returnFocus}>
          <form onSubmit={onSubmit} noValidate className="contents">
            <DialogHeader>
              <DialogTitle>{editing ? `Edit ticket #${editing.id}` : "Create ticket"}</DialogTitle>
              <DialogDescription>
                {editing
                  ? [
                      isSuperAdmin ? organizationNameById.get(editing.organization_id) : null,
                      editing.account_id != null ? accountLabel(editing) : null,
                      editing.created_at ? `created ${formatDateTime(editing.created_at)}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")
                  : "Describe the problem or request. Super Admins are notified and triage it."}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-4">
              <ErrorAlert message={error} />
              {!editing && (
                <FieldGroup>
                  {isSuperAdmin && (
                    <Field label="Organization">
                      <Select
                        value={form.organization_id}
                        onChange={(e) => setForm({ ...form, organization_id: e.target.value, account_id: "" })}
                      >
                        {organizations.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  <Field label="Account" hint="Optional">
                    <Select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
                      <option value="">None</option>
                      {createAccounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {isSuperAdmin && !form.organization_id ? ` (${a.organization_name ?? `org ${a.organization_id}`})` : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </FieldGroup>
              )}
              <Field label="Subject" required>
                <Input dir="auto" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
              </Field>
              <Field label="Description">
                <Textarea
                  dir="auto"
                  rows={6}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </Field>
              <FieldGroup>
                <Field label="Type" hint="e.g. SUPPORT, Bug, Request">
                  <Input value={form.ticket_type} onChange={(e) => setForm({ ...form, ticket_type: e.target.value })} />
                </Field>
                {editing && (
                  <Field label="Status">
                    <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      {!STATUS_OPTIONS.some((o) => o.value === form.status) && (
                        <option value={form.status}>{form.status}</option>
                      )}
                      {STATUS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
              </FieldGroup>
              {editing && (
                <FieldGroup>
                  <Field label="Assigned to" hint="Numeric user ID of the assignee. Leave empty to unassign.">
                    <Input
                      inputMode="numeric"
                      className="font-mono"
                      placeholder="User ID"
                      value={form.assigned_to}
                      onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
                    />
                  </Field>
                </FieldGroup>
              )}
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createTicket.isPending || updateTicket.isPending}>
                {editing ? "Save changes" : createTicket.isPending ? "Creating…" : "Create ticket"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId != null}
        title="Delete ticket"
        message={
          deleteTarget?.subject
            ? `Delete “${deleteTarget.subject}”? This can't be undone.`
            : "This action cannot be undone."
        }
        destructive
        confirmLabel="Delete"
        loading={deleteTicket.isPending}
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
            await deleteTicket.mutateAsync(deleteId);
            toast.success("Ticket deleted");
            setDeleteId(null);
          } catch (e) {
            setDeleteError(formatUserError(e));
          }
        }}
      />
    </Page>
  );
}
