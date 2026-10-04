import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Eye, Inbox, Plus } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatUserError } from "@/lib/errors";
import { formatDateTime, formatNumber } from "@/lib/format";
import { ROLES, canAccessPermission } from "@/lib/roles";
import { useAccounts } from "@/hooks/useAccounts";
import { useOrganizations } from "@/hooks/useOrganizations";
import {
  useIngestionRequests,
  useIngestionPendingCount,
  useCreateIngestionRequest,
  useUpdateIngestionRequest,
} from "@/hooks/useIngestion";
import { Page, PageHeading } from "@/components/shell/page";
import { DataTable, actionsColumn, type Column } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Status, humanizeStatus } from "@/components/data/status";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { filterRows } from "@/lib/table-filters";
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
import { Field, FieldGroup, FormSection } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/toast";
import { RelativeTime } from "@/components/doc-intel/RelativeTime";
import type { DeveloperNotify, IngestionRequest } from "@/types/api";

const INGESTION_STATUS_OPTIONS = ["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED", "CANCELLED"] as const;

/** Status summary chips (they also filter the table). */
const STATUS_TABS: { value: string; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING", label: "Pending" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "FAILED", label: "Failed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const KB_DESCRIPTION_PLACEHOLDER =
  "Example: Product FAQs, onboarding guides, and policy documents for the Halan mobile app. " +
  "Include common customer issues, refund rules, and troubleshooting steps you want in the knowledge base.";

function requesterName(first: string | null | undefined, last: string | null | undefined, email: string): string {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || email;
}

function PriorityBadge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  const v = value.toUpperCase();
  return <Badge variant={v === "HIGH" || v === "URGENT" ? "warning" : "neutral"}>{humanizeStatus(v)}</Badge>;
}

function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-ui text-foreground">{children}</dd>
    </div>
  );
}

export function IngestionPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const isDeveloper = user?.roles.includes(ROLES.DEVELOPER);
  const canManageIngestion = isSuperAdmin || isDeveloper;
  const canCreateRequest = user != null && canAccessPermission(user, "ingestion");

  const { data: pendingBadge } = useIngestionPendingCount(isSuperAdmin ?? false);
  const pendingCount = pendingBadge?.pending_count ?? 0;
  const { data: organizations = [] } = useOrganizations(isSuperAdmin ?? false);
  const { data: accounts = [] } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const { data = [], isLoading, isError, error: loadError, refetch } = useIngestionRequests();
  const createRequest = useCreateIngestionRequest();
  const updateRequest = useUpdateIngestionRequest();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState<IngestionRequest | null>(null);
  const [viewStatus, setViewStatus] = useState("PENDING");
  const [viewError, setViewError] = useState<string | null>(null);
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [orgFilter, setOrgFilter] = useState("ALL");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [submittedAt, setSubmittedAt] = useState(() => new Date().toLocaleString());
  const [form, setForm] = useState({
    account_id: "",
    request_type: "DOCUMENT",
    description: "",
    requester_phone: "",
  });
  const [error, setError] = useState<string | null>(null);

  const organizationNameById = useMemo(() => new Map(organizations.map((o) => [o.id, o.name])), [organizations]);
  const orgName = (r: IngestionRequest) => r.organization_name ?? organizationNameById.get(r.organization_id ?? -1) ?? "—";

  // Everything except the status filter: the status chips count within this scope.
  const scopedData = useMemo(
    () =>
      filterRows(
        data,
        search,
        (r) =>
          [
            r.requester_name ?? "",
            r.requester_email ?? "",
            r.requester_phone ?? "",
            r.account_name ?? "",
            r.organization_name ?? organizationNameById.get(r.organization_id ?? -1) ?? "",
            r.request_type ?? "",
            r.status ?? "",
            r.description ?? "",
          ].join(" "),
        [
          (r) => orgFilter === "ALL" || String(r.organization_id) === orgFilter,
          (r) => accountFilter === "ALL" || String(r.account_id) === accountFilter,
        ],
      ),
    [data, search, orgFilter, accountFilter, organizationNameById],
  );
  const filteredData = useMemo(
    () => scopedData.filter((r) => statusFilter === "ALL" || r.status === statusFilter),
    [scopedData, statusFilter],
  );
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: scopedData.length };
    for (const r of scopedData) counts[r.status ?? ""] = (counts[r.status ?? ""] ?? 0) + 1;
    return counts;
  }, [scopedData]);

  const filterAccounts = useMemo(() => {
    if (!isSuperAdmin || orgFilter === "ALL") return accounts;
    return accounts.filter((a) => String(a.organization_id) === orgFilter);
  }, [accounts, orgFilter, isSuperAdmin]);

  function openCreate() {
    setSubmittedAt(new Date().toLocaleString());
    setForm({ account_id: "", request_type: "DOCUMENT", description: "", requester_phone: "" });
    setError(null);
    setDialogOpen(true);
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setOrgFilter("ALL");
    setAccountFilter("ALL");
  }

  function openView(request: IngestionRequest) {
    setViewing(request);
    setViewStatus(request.status ?? "PENDING");
    setViewError(null);
    setViewOpen(true);
  }

  async function handleSaveStatus() {
    if (!viewing) return;
    setViewError(null);
    try {
      const updated = await updateRequest.mutateAsync({ id: viewing.id, body: { status: viewStatus } });
      setViewing(updated);
      setViewOpen(false);
      toast.success(`Request #${viewing.id} updated`, { description: `Status: ${humanizeStatus(viewStatus)}` });
    } catch (e) {
      setViewError(formatUserError(e));
    }
  }

  function notifyToast(notify: DeveloperNotify | null | undefined) {
    if (!notify) {
      toast.success("Ingestion request created");
      return;
    }
    if (notify.status === "sent") toast.success("Ingestion request created", { description: `Developer email sent. ${notify.message}` });
    else if (notify.status === "failed")
      toast.warning("Request created, developer email not sent", { description: notify.message });
    else toast.info("Request created, developer email skipped", { description: notify.message });
  }

  async function handleCreate() {
    setError(null);
    if (!form.requester_phone.trim()) {
      setError("Phone number is required so a supervisor can reach you.");
      return;
    }
    if (!form.description.trim()) {
      setError("Please describe what the knowledge base should contain.");
      return;
    }
    try {
      const created = await createRequest.mutateAsync({
        account_id: Number(form.account_id),
        request_type: form.request_type,
        description: form.description.trim(),
        requester_phone: form.requester_phone.trim(),
      });
      notifyToast(created.developer_notify);
      setDialogOpen(false);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  const displayName = user ? requesterName(user.first_name, user.last_name, user.email) : "";

  const columns: Column<IngestionRequest>[] = [
    { key: "id", header: "ID", sortable: true, render: (r) => <span className="font-mono text-xs">#{r.id}</span> },
    {
      key: "account_name",
      header: "Account",
      sortable: true,
      truncate: true,
      maxWidth: "11rem",
      render: (r) => <bdi>{r.account_name ?? `#${r.account_id}`}</bdi>,
    },
    ...(isSuperAdmin
      ? [
          {
            key: "organization_name",
            header: "Organization",
            sortable: true,
            sortValue: (r: IngestionRequest) => orgName(r),
            truncate: true,
            maxWidth: "11rem",
            render: (r: IngestionRequest) => <bdi>{orgName(r)}</bdi>,
          } satisfies Column<IngestionRequest>,
        ]
      : []),
    { key: "request_type", header: "Type", render: (r) => r.request_type ?? "—" },
    {
      key: "requester_name",
      header: "Requester",
      render: (r) => (
        <div className="min-w-0 max-w-[15rem]">
          <p className="truncate text-foreground">
            <bdi>{r.requester_name ?? "—"}</bdi>
          </p>
          {!isSuperAdmin && (r.requester_email || r.requester_phone) && (
            <p className="truncate text-xs text-muted-foreground">
              {r.requester_email && (
                <a href={`mailto:${r.requester_email}`} className="text-primary hover:underline">
                  {r.requester_email}
                </a>
              )}
              {r.requester_email && r.requester_phone ? " · " : ""}
              {r.requester_phone && <span className="tabular-nums">{r.requester_phone}</span>}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (r) => <Status value={r.status} />,
    },
    { key: "priority", header: "Priority", render: (r) => <PriorityBadge value={r.priority} /> },
    {
      key: "created_at",
      header: "Created",
      sortable: true,
      sortValue: (r) => r.created_at ?? "",
      render: (r) => <RelativeTime value={r.created_at} />,
    },
    {
      key: "description",
      header: "KB description",
      truncate: true,
      maxWidth: "18rem",
      defaultHidden: true,
      cellTitle: (r) => r.description ?? undefined,
      render: (r) => <span dir="auto" className="text-muted-foreground">{(r.description ?? "").trim() || "—"}</span>,
    },
  ];
  if (canManageIngestion) {
    columns.push(
      actionsColumn<IngestionRequest>((r) => [{ label: "View request", icon: Eye, onSelect: () => openView(r) }], {
        label: (r) => `Actions for request #${r.id}`,
      }),
    );
  }

  const isFiltered = search.trim() !== "" || statusFilter !== "ALL" || orgFilter !== "ALL" || accountFilter !== "ALL";

  return (
    <Page width="wide">
      <PageHeading
        title="Ingestion"
        meta={isSuperAdmin && pendingCount > 0 ? <Badge variant="warning">{formatNumber(pendingCount)} pending</Badge> : undefined}
        description={
          isSuperAdmin && pendingCount > 0
            ? "Pending knowledge-base requests across all organizations: contact requesters by email or phone."
            : isSuperAdmin
              ? "Review ingestion requests across all organizations and contact requesters."
              : isDeveloper
                ? "Review and update ingestion requests for your organization."
                : "Knowledge base ingestion requests."
        }
        actions={
          canCreateRequest ? (
            <Button onClick={openCreate}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              New request
            </Button>
          ) : undefined
        }
      />

      <Tabs variant="segmented" value={statusFilter} onValueChange={setStatusFilter}>
        <TabsList aria-label="Filter by status">
          {STATUS_TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} count={isLoading ? undefined : formatNumber(statusCounts[t.value] ?? 0)}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataTable<IngestionRequest>
        aria-label="Ingestion requests"
        columns={columns}
        data={isError ? [] : filteredData}
        keyFn={(r) => r.id}
        loading={isLoading}
        itemLabel="requests"
        defaultSort={{ key: "created_at", dir: "desc" }}
        enableColumnVisibility
        persistKey="ingestion"
        onRowClick={canManageIngestion ? (r) => openView(r) : undefined}
        empty={
          isError
            ? {
                title: "Couldn't load ingestion requests",
                description: formatUserError(loadError),
                action: (
                  <Button variant="outline" size="sm" onClick={() => void refetch()}>
                    Try again
                  </Button>
                ),
              }
            : isFiltered
              ? {
                  title: "No requests match these filters",
                  action: (
                    <Button variant="outline" size="sm" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ),
                }
              : { icon: Inbox, title: "No ingestion requests yet", description: canCreateRequest ? "Use New request to ask for knowledge-base content." : undefined }
        }
        toolbar={
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder={isSuperAdmin ? "Search requester, account, organization, description…" : "Search requester, account, description…"}
            filters={[
              {
                id: "ingestion-org-filter",
                label: "Organization",
                value: orgFilter,
                onChange: setOrgFilter,
                hidden: !isSuperAdmin,
                options: [{ value: "ALL", label: "All" }, ...organizations.map((o) => ({ value: String(o.id), label: o.name }))],
              },
              {
                id: "ingestion-account-filter",
                label: "Account",
                value: accountFilter,
                onChange: setAccountFilter,
                options: [{ value: "ALL", label: "All" }, ...filterAccounts.map((a) => ({ value: String(a.id), label: a.name }))],
              },
            ]}
            onClear={clearFilters}
            isFiltered={isFiltered}
            totalCount={isFiltered ? data.length : undefined}
            filteredCount={filteredData.length}
            itemLabel="requests"
          />
        }
      />

      {canManageIngestion && (
        <Sheet open={viewOpen} onOpenChange={setViewOpen}>
          <SheetContent size="md">
            <SheetHeader>
              <SheetTitle>
                Ingestion request <span className="font-mono">#{viewing?.id ?? ""}</span>
              </SheetTitle>
              <SheetDescription>Contact the requester, then record the progress here.</SheetDescription>
            </SheetHeader>
            <SheetBody className="space-y-5">
              {viewing && (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <Status value={viewing.status} />
                    <PriorityBadge value={viewing.priority} />
                  </div>
                  <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                    <Fact label="Organization">
                      <bdi>{orgName(viewing)}</bdi>
                    </Fact>
                    <Fact label="Account">
                      <bdi>{viewing.account_name ?? `#${viewing.account_id}`}</bdi>
                    </Fact>
                    <Fact label="Requester">
                      <bdi>{viewing.requester_name ?? "—"}</bdi>
                    </Fact>
                    <Fact label="Submitted">{formatDateTime(viewing.created_at)}</Fact>
                    <Fact label="Email">
                      {viewing.requester_email ? (
                        <a href={`mailto:${viewing.requester_email}`} className="text-primary hover:underline">
                          {viewing.requester_email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </Fact>
                    <Fact label="Phone">
                      {viewing.requester_phone ? (
                        <a href={`tel:${viewing.requester_phone.replace(/\s+/g, "")}`} className="tabular-nums text-primary hover:underline">
                          {viewing.requester_phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </Fact>
                    <Fact label="Request type">{viewing.request_type ?? "—"}</Fact>
                  </dl>
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground">Knowledge base description</p>
                    <p dir="auto" className="whitespace-pre-wrap break-words rounded-md border border-border bg-surface-muted px-3 py-2 text-ui text-foreground">
                      {viewing.description?.trim() || "—"}
                    </p>
                  </div>
                  <Field label="Status" htmlFor="ingestion-view-status" className="border-t border-border pt-4">
                    <Select id="ingestion-view-status" value={viewStatus} onChange={(e) => setViewStatus(e.target.value)}>
                      {INGESTION_STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>
                          {humanizeStatus(s)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <ErrorAlert message={viewError} />
                </>
              )}
            </SheetBody>
            <SheetFooter>
              <Button variant="outline" onClick={() => setViewOpen(false)}>
                Close
              </Button>
              <Button onClick={handleSaveStatus} disabled={viewStatus === (viewing?.status ?? "")} loading={updateRequest.isPending}>
                Save status
              </Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      )}

      {canCreateRequest && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen} size="lg">
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New ingestion request</DialogTitle>
              <DialogDescription>Ask for content to be added to an account's knowledge base. A developer is notified by email.</DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-6">
              <ErrorAlert message={error} />
              <FormSection title="Request">
                <FieldGroup columns={2}>
                  <Field label="Account" htmlFor="ingestion-account">
                    <Select
                      id="ingestion-account"
                      value={form.account_id}
                      onChange={(e) => setForm({ ...form, account_id: e.target.value })}
                    >
                      <option value="">Select account</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                          {isSuperAdmin ? ` (${a.organization_name ?? `org ${a.organization_id}`})` : ""}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Request type" htmlFor="ingestion-type">
                    <Input
                      id="ingestion-type"
                      value={form.request_type}
                      onChange={(e) => setForm({ ...form, request_type: e.target.value })}
                    />
                  </Field>
                </FieldGroup>
                <Field
                  label="Knowledge base description"
                  htmlFor="ingestion-description"
                  required
                  hint="Tell the supervisor what this KB is about and what content should be included."
                >
                  <Textarea
                    id="ingestion-description"
                    dir="auto"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder={KB_DESCRIPTION_PLACEHOLDER}
                    rows={4}
                  />
                </Field>
              </FormSection>

              <FormSection title="Your contact details" description="Supervisors use this to reach you about the request.">
                <FieldGroup columns={2}>
                  <Field label="Name" htmlFor="ingestion-name">
                    <Input id="ingestion-name" value={displayName} readOnly />
                  </Field>
                  <Field label="Email" htmlFor="ingestion-email">
                    <Input id="ingestion-email" value={user?.email ?? ""} readOnly />
                  </Field>
                  <Field label="Phone" htmlFor="ingestion-phone" required>
                    <Input
                      id="ingestion-phone"
                      type="tel"
                      value={form.requester_phone}
                      onChange={(e) => setForm({ ...form, requester_phone: e.target.value })}
                      placeholder="+20 1xx xxx xxxx"
                    />
                  </Field>
                  <Field label="Date & time" htmlFor="ingestion-date" hint="Set automatically when you submit.">
                    <Input id="ingestion-date" value={submittedAt} readOnly />
                  </Field>
                </FieldGroup>
              </FormSection>

            </DialogBody>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} loading={createRequest.isPending}>
                {createRequest.isPending ? "Creating…" : "Create request"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Page>
  );
}
