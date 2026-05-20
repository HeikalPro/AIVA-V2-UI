import { useMemo, useState } from "react";
import { Eye, Plus, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { ROLES } from "@/lib/roles";
import { useAccounts } from "@/hooks/useAccounts";
import { useOrganizations } from "@/hooks/useOrganizations";
import {
  useIngestionRequests,
  useIngestionPendingCount,
  useCreateIngestionRequest,
  useUpdateIngestionRequest,
} from "@/hooks/useIngestion";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { TableFilters } from "@/components/shared/TableFilters";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { filterRows } from "@/lib/table-filters";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { DeveloperNotify, IngestionRequest } from "@/types/api";

const INGESTION_STATUS_OPTIONS = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
] as const;

const KB_DESCRIPTION_PLACEHOLDER =
  "Example: Product FAQs, onboarding guides, and policy documents for the Halan mobile app. " +
  "Include common customer issues, refund rules, and troubleshooting steps you want in the knowledge base.";

function requesterName(
  first: string | null | undefined,
  last: string | null | undefined,
  email: string,
): string {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || email;
}

export function IngestionPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const isDeveloper = user?.roles.includes(ROLES.DEVELOPER);
  const canManageIngestion = isSuperAdmin || isDeveloper;
  const canCreateRequest =
    !isSuperAdmin &&
    !!user &&
    (user.roles.includes(ROLES.ACCOUNT_MANAGER) || user.roles.includes(ROLES.SUPERVISOR));

  const { data: pendingBadge } = useIngestionPendingCount(isSuperAdmin ?? false);
  const pendingCount = pendingBadge?.pending_count ?? 0;
  const { data: organizations = [] } = useOrganizations(isSuperAdmin ?? false);
  const { data: accounts = [] } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const { data = [], isLoading } = useIngestionRequests();
  const createRequest = useCreateIngestionRequest();
  const updateRequest = useUpdateIngestionRequest();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewing, setViewing] = useState<IngestionRequest | null>(null);
  const [viewStatus, setViewStatus] = useState("PENDING");
  const [viewError, setViewError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [orgFilter, setOrgFilter] = useState("ALL");
  const [submittedAt, setSubmittedAt] = useState(() => new Date().toLocaleString());
  const [form, setForm] = useState({
    account_id: "",
    request_type: "DOCUMENT",
    description: "",
    requester_phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [emailNotify, setEmailNotify] = useState<DeveloperNotify | null>(null);

  const organizationNameById = useMemo(
    () => new Map(organizations.map((o) => [o.id, o.name])),
    [organizations],
  );

  const filteredData = useMemo(
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
          (r) => statusFilter === "ALL" || r.status === statusFilter,
          (r) => orgFilter === "ALL" || String(r.organization_id) === orgFilter,
        ],
      ),
    [data, search, statusFilter, orgFilter, organizationNameById],
  );

  function openCreate() {
    setSubmittedAt(new Date().toLocaleString());
    setForm({
      account_id: "",
      request_type: "DOCUMENT",
      description: "",
      requester_phone: "",
    });
    setError(null);
    setEmailNotify(null);
    setDialogOpen(true);
  }

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setOrgFilter("ALL");
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
      const updated = await updateRequest.mutateAsync({
        id: viewing.id,
        body: { status: viewStatus },
      });
      setViewing(updated);
      setViewOpen(false);
    } catch (e) {
      setViewError(e instanceof Error ? e.message : String(e));
    }
  }

  function formatCreatedAt(value: string | null | undefined): string {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
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
      setEmailNotify(created.developer_notify);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const displayName = user
    ? requesterName(user.first_name, user.last_name, user.email)
    : "";

  const stickyActionHead =
    "sticky right-0 z-10 w-12 min-w-[3rem] bg-slate-50/80 text-center normal-case tracking-normal";
  const stickyActionCell =
    "sticky right-0 z-10 w-12 min-w-[3rem] bg-white text-center shadow-[-6px_0_10px_-6px_rgba(0,0,0,0.08)] group-hover:bg-slate-50";

  const columns = useMemo(() => {
    if (isSuperAdmin) {
      return [
        { key: "id", header: "ID", sortable: true, className: "whitespace-nowrap w-14" },
        {
          key: "organization_name",
          header: "Organization",
          sortable: true,
          className: "min-w-[7rem] max-w-[10rem]",
          cellClassName: "min-w-[7rem] max-w-[10rem] truncate",
          render: (r) =>
            r.organization_name ?? organizationNameById.get(r.organization_id ?? -1) ?? "—",
        },
        {
          key: "account_name",
          header: "Account",
          sortable: true,
          className: "min-w-[6rem] max-w-[9rem]",
          cellClassName: "min-w-[6rem] max-w-[9rem] truncate",
          render: (r) => r.account_name ?? `#${r.account_id}`,
        },
        {
          key: "requester_name",
          header: "Requester",
          className: "min-w-[6rem] max-w-[9rem]",
          cellClassName: "min-w-[6rem] max-w-[9rem] truncate",
          render: (r) => r.requester_name ?? "—",
        },
        {
          key: "created_at",
          header: "Date & time",
          sortable: true,
          sortValue: (r) => r.created_at ?? "",
          className: "whitespace-nowrap min-w-[9rem]",
          render: (r) => formatCreatedAt(r.created_at),
        },
        {
          key: "status",
          header: "Status",
          className: "whitespace-nowrap",
          render: (r) => <StatusBadge status={r.status} />,
        },
        {
          key: "description",
          header: "KB description",
          className: "min-w-[8rem] max-w-[14rem]",
          cellClassName: "min-w-[8rem] max-w-[14rem] truncate text-muted-foreground",
          render: (r) => (
            <span title={r.description ?? undefined}>{(r.description ?? "").trim() || "—"}</span>
          ),
        },
        {
          key: "actions",
          header: "View",
          headClassName: stickyActionHead,
          cellClassName: stickyActionCell,
          render: (r) => (
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0"
              title="View request"
              aria-label="View request"
              onClick={(e) => {
                e.stopPropagation();
                openView(r);
              }}
            >
              <Eye className="h-4 w-4" />
            </Button>
          ),
        },
      ] satisfies Parameters<typeof DataTable<IngestionRequest>>[0]["columns"];
    }

    const cols: Parameters<typeof DataTable<IngestionRequest>>[0]["columns"] = [
      { key: "id", header: "ID", sortable: true },
      {
        key: "account_name",
        header: "Account",
        sortable: true,
        render: (r) => r.account_name ?? `#${r.account_id}`,
      },
      {
        key: "requester_name",
        header: "Requester",
        render: (r) => r.requester_name ?? "—",
      },
      {
        key: "requester_email",
        header: "Email",
        render: (r) =>
          r.requester_email ? (
            <a href={`mailto:${r.requester_email}`} className="text-[#004080] hover:underline">
              {r.requester_email}
            </a>
          ) : (
            "—"
          ),
      },
      {
        key: "requester_phone",
        header: "Phone",
        className: "whitespace-nowrap",
        render: (r) => r.requester_phone ?? "—",
      },
      { key: "request_type", header: "Type", render: (r) => r.request_type ?? "—" },
      {
        key: "created_at",
        header: "Date & time",
        sortable: true,
        sortValue: (r) => r.created_at ?? "",
        className: "whitespace-nowrap",
        render: (r) => formatCreatedAt(r.created_at),
      },
      { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
      {
        key: "description",
        header: "KB description",
        className: "max-w-xs",
        cellClassName: "max-w-xs truncate",
        render: (r) => (
          <span title={r.description ?? undefined}>{(r.description ?? "").slice(0, 60) || "—"}</span>
        ),
      },
    ];

    if (canManageIngestion) {
      cols.push({
        key: "actions",
        header: "View",
        headClassName: stickyActionHead,
        cellClassName: stickyActionCell,
        render: (r) => (
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 shrink-0"
            title="View request"
            aria-label="View request"
            onClick={(e) => {
              e.stopPropagation();
              openView(r);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        ),
      });
    }

    return cols satisfies Parameters<typeof DataTable<IngestionRequest>>[0]["columns"];
  }, [isSuperAdmin, canManageIngestion, organizationNameById]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Upload}
        title="Ingestion"
        description={
          isSuperAdmin && pendingCount > 0
            ? `${pendingCount} pending ingestion request${pendingCount === 1 ? "" : "s"} — contact requesters using email or phone`
            : isSuperAdmin
              ? "Review ingestion requests across all organizations and contact requesters"
              : isDeveloper
                ? "Review and update ingestion requests for your organization"
                : "Knowledge base ingestion requests"
        }
        actions={
          canCreateRequest ? (
            <Button onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" /> New Request
            </Button>
          ) : undefined
        }
      />

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder={
          isSuperAdmin
            ? "Search by requester, email, phone, account, organization, or description…"
            : "Search by requester, email, phone, account, or description…"
        }
        filters={[
          ...(isSuperAdmin
            ? [
                {
                  id: "ingestion-org-filter",
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
            id: "ingestion-status-filter",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "ALL", label: "All statuses" },
              { value: "PENDING", label: "Pending" },
              { value: "IN_PROGRESS", label: "In progress" },
              { value: "COMPLETED", label: "Completed" },
              { value: "FAILED", label: "Failed" },
              { value: "CANCELLED", label: "Cancelled" },
            ],
          },
        ]}
        onClear={clearFilters}
      />

      <DataTable<IngestionRequest>
        columns={columns}
        data={filteredData}
        keyFn={(r) => r.id}
        loading={isLoading}
      />

      {canManageIngestion && (
        <Dialog open={viewOpen} onOpenChange={setViewOpen} size="max-w-2xl">
          <DialogContent className="flex max-h-[min(90vh,calc(100dvh-2rem))] flex-col overflow-hidden p-0">
            <DialogHeader className="mb-0 border-b border-slate-100 px-6 py-4">
              <DialogTitle>
                Ingestion request #{viewing?.id ?? ""}
              </DialogTitle>
            </DialogHeader>
            <DialogBody className="min-h-0 flex-1 px-6 py-4">
            {viewing && (
              <div className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Organization</p>
                    <p className="mt-0.5 font-medium">
                      {viewing.organization_name
                        ?? organizationNameById.get(viewing.organization_id ?? -1)
                        ?? "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Account</p>
                    <p className="mt-0.5 font-medium">{viewing.account_name ?? `#${viewing.account_id}`}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Requester</p>
                    <p className="mt-0.5">{viewing.requester_name ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Submitted</p>
                    <p className="mt-0.5">{formatCreatedAt(viewing.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Email</p>
                    <p className="mt-0.5">
                      {viewing.requester_email ? (
                        <a href={`mailto:${viewing.requester_email}`} className="text-[#004080] hover:underline">
                          {viewing.requester_email}
                        </a>
                      ) : (
                        "—"
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Phone</p>
                    <p className="mt-0.5">{viewing.requester_phone ?? "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Request type</p>
                    <p className="mt-0.5">{viewing.request_type ?? "—"}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-muted-foreground">Knowledge base description</p>
                  <p className="mt-1 whitespace-pre-wrap rounded-md border border-input bg-muted/20 px-3 py-2">
                    {viewing.description?.trim() || "—"}
                  </p>
                </div>

                <div>
                  <Label>Status</Label>
                  <Select
                    value={viewStatus}
                    onChange={(e) => setViewStatus(e.target.value)}
                    className="mt-1"
                  >
                    {INGESTION_STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
                    ))}
                  </Select>
                </div>

                {viewError && <p className="text-sm text-red-600">{viewError}</p>}
              </div>
            )}
            </DialogBody>
            <DialogFooter className="mt-0 border-t border-slate-100 px-6 py-4">
              <Button variant="outline" onClick={() => setViewOpen(false)}>Close</Button>
              <Button
                onClick={handleSaveStatus}
                disabled={updateRequest.isPending || viewStatus === (viewing?.status ?? "")}
              >
                Save status
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {canCreateRequest && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen} size="max-w-2xl">
          <DialogContent className="flex max-h-[min(90vh,calc(100dvh-2rem))] flex-col overflow-hidden p-0">
            <DialogHeader className="mb-0 border-b border-slate-100 px-6 py-4">
              <DialogTitle>New Ingestion Request</DialogTitle>
            </DialogHeader>
            <DialogBody className="min-h-0 flex-1 px-6 py-4">
            <div className="space-y-4">
              <div>
                <Label>Account</Label>
                <Select
                  value={form.account_id}
                  onChange={(e) => setForm({ ...form, account_id: e.target.value })}
                  className="mt-1"
                >
                  <option value="">Select account</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </Select>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-sm font-medium">Your contact details</p>
                <p className="text-xs text-muted-foreground">
                  Supervisors use this to reach you about the request.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Name</Label>
                    <Input value={displayName} readOnly className="mt-1 bg-background" />
                  </div>
                  <div>
                    <Label>Email</Label>
                    <Input value={user?.email ?? ""} readOnly className="mt-1 bg-background" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label>Phone</Label>
                    <Input
                      value={form.requester_phone}
                      onChange={(e) => setForm({ ...form, requester_phone: e.target.value })}
                      placeholder="+20 1xx xxx xxxx"
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Request Type</Label>
                  <Input
                    value={form.request_type}
                    onChange={(e) => setForm({ ...form, request_type: e.target.value })}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label>Date & time</Label>
                  <Input value={submittedAt} readOnly className="mt-1 bg-background" />
                  <p className="mt-1 text-xs text-muted-foreground">Set automatically when you submit.</p>
                </div>
              </div>
              <div>
                <Label>Knowledge base description</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tell the supervisor what this KB is about and what content should be included.
                </p>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder={KB_DESCRIPTION_PLACEHOLDER}
                  rows={3}
                  className="mt-2 w-full rounded-md border border-input px-3 py-2 text-sm"
                />
              </div>
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
                  <Button onClick={handleCreate} disabled={createRequest.isPending}>
                    {createRequest.isPending ? "Creating…" : "Create"}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
