import { useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Briefcase, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatUserError } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { ROLES } from "@/lib/roles";
import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount } from "@/hooks/useAccounts";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useLLMConfigs } from "@/hooks/useLLMConfigs";
import { useAccountUsers, useAssignAccount, useUnassignAccount, useUsers } from "@/hooks/useUsers";
import { filterRows } from "@/lib/table-filters";
import { Page, PageHeading } from "@/components/shell/page";
import { DataTable, actionsColumn, type Column, type DataTableEmpty } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Status } from "@/components/data/status";
import { EmptyState } from "@/components/data/empty-state";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { CorpusSelect } from "@/components/shared/CorpusSelect";
import { Avatar } from "@/components/ui/avatar";
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
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { InstallmentCalculatorEditor } from "@/components/accounts/InstallmentCalculatorEditor";
import { useDeepLinks } from "@/components/users/useDeepLinks";
import { useCorpora } from "@/hooks/useCorpora";
import { resolveCorpusDisplayName } from "@/lib/corpus";
import {
  ALL_CALCULATOR_TYPES,
  buildCalculatorProductsPayload,
  calculatorProductsFromAccount,
  defaultCalculatorProductsForm,
  type CalculatorProductForm,
  type CalculatorTypeKey,
} from "@/lib/calculatorDefaults";
import type { Account, LLMConfig, User, WidgetFeatures } from "@/types/api";
import { useReturnFocus } from "@/components/users/useReturnFocus";

function calculatorTypesFromAccount(acc: Account | null): CalculatorTypeKey[] {
  const types = acc?.widget_features?.installment_calculator?.types;
  if (Array.isArray(types) && types.length > 0) return [...types];
  return [...ALL_CALCULATOR_TYPES];
}

function widgetFeaturesFromForm(
  enabled: boolean,
  types: string[],
  products: Record<CalculatorTypeKey, CalculatorProductForm>,
): WidgetFeatures {
  const activeTypes: CalculatorTypeKey[] = enabled
    ? types.filter((t): t is CalculatorTypeKey =>
        ALL_CALCULATOR_TYPES.includes(t as CalculatorTypeKey),
      )
    : [];
  return {
    installment_calculator: {
      enabled,
      types: activeTypes,
      products: enabled ? buildCalculatorProductsPayload(activeTypes, products) : undefined,
    },
  };
}

function llmConfigLabel(c: LLMConfig): string {
  return `${c.provider} / ${c.model_name}${c.comment ? ` — ${c.comment}` : ""}`;
}

export function AccountsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const { data: orgs = [] } = useOrganizations(isSuperAdmin);
  const { data: llmConfigs = [] } = useLLMConfigs(isSuperAdmin);
  const { data: corpora = [] } = useCorpora();
  const accountsQuery = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const { data = [], isLoading } = accountsQuery;
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const assignAccount = useAssignAccount();
  const unassignAccount = useUnassignAccount();
  const returnFocus = useReturnFocus();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [membersAccount, setMembersAccount] = useState<Account | null>(null);
  const [addUserId, setAddUserId] = useState("");
  const [membersError, setMembersError] = useState<string | null>(null);
  const [editing, setEditing] = useState<Account | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [form, setForm] = useState({
    organization_id: "",
    name: "",
    description: "",
    corpus_id: "",
    llm_config_id: "",
    status: "ACTIVE",
    calculator_enabled: false,
    calculator_types: [...ALL_CALCULATOR_TYPES] as string[],
    calculator_products: defaultCalculatorProductsForm(),
  });
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [orgFilter, setOrgFilter] = useState("ALL");

  const { data: accountMembers = [], isLoading: membersLoading } = useAccountUsers(
    membersAccount?.id ?? null,
  );
  const { data: candidateUsers = [] } = useUsers(
    isSuperAdmin ? null : (membersAccount?.organization_id ?? null),
  );
  const availableUsers = candidateUsers.filter(
    (u) => u.status === "ACTIVE" && !accountMembers.some((m) => m.id === u.id),
  );

  const orgNameById = useMemo(() => new Map(orgs.map((o) => [o.id, o.name])), [orgs]);
  const llmConfigById = useMemo(() => new Map(llmConfigs.map((c) => [c.id, c])), [llmConfigs]);

  function resolveOrganizationName(account: Account): string {
    return (
      account.organization_name
      ?? orgNameById.get(account.organization_id)
      ?? `Organization #${account.organization_id}`
    );
  }

  function openMembers(acc: Account) {
    setMembersAccount(acc);
    setAddUserId("");
    setMembersError(null);
    setMembersOpen(true);
  }

  async function handleAddMember() {
    if (!membersAccount || !addUserId) return;
    setMembersError(null);
    const added = candidateUsers.find((u) => u.id === Number(addUserId));
    try {
      await assignAccount.mutateAsync({
        userId: Number(addUserId),
        body: { account_id: membersAccount.id },
      });
      setAddUserId("");
      toast.success(`Added ${added?.email ?? "user"} to ${membersAccount.name}`);
    } catch (e) {
      setMembersError(formatUserError(e));
    }
  }

  async function handleRemoveMember(member: User) {
    if (!membersAccount) return;
    setMembersError(null);
    try {
      await unassignAccount.mutateAsync({ userId: member.id, accountId: membersAccount.id });
      toast.success(`Removed ${member.email} from ${membersAccount.name}`);
    } catch (e) {
      setMembersError(formatUserError(e));
    }
  }

  function openCreate() {
    setEditing(null);
    setForm({
      organization_id: String(user?.organization_id ?? orgs[0]?.id ?? ""),
      name: "",
      description: "",
      corpus_id: "",
      llm_config_id: "",
      status: "ACTIVE",
      calculator_enabled: false,
      calculator_types: [...ALL_CALCULATOR_TYPES],
      calculator_products: defaultCalculatorProductsForm(),
    });
    setError(null);
    setDialogOpen(true);
  }

  function openEdit(acc: Account) {
    setEditing(acc);
    setForm({
      organization_id: String(acc.organization_id),
      name: acc.name,
      description: acc.description ?? "",
      corpus_id: acc.corpus_id ?? "",
      llm_config_id: acc.llm_config_id != null ? String(acc.llm_config_id) : "",
      status: acc.status,
      calculator_enabled: acc.widget_features?.installment_calculator?.enabled ?? false,
      calculator_types: calculatorTypesFromAccount(acc),
      calculator_products: calculatorProductsFromAccount(
        calculatorTypesFromAccount(acc),
        acc.widget_features?.installment_calculator?.products,
      ),
    });
    setError(null);
    setDialogOpen(true);
  }

  // Command palette: ?action=create opens the create dialog, ?q=<name> pre-fills the search.
  useDeepLinks({ onCreate: openCreate, onSearch: setSearch });

  const filteredData = useMemo(
    () =>
      filterRows(
        data,
        search,
        (a) =>
          [
            a.name,
            a.description ?? "",
            resolveOrganizationName(a),
            a.organization_code ?? "",
            resolveCorpusDisplayName(a.corpus_id, corpora),
            a.status,
          ].join(" "),
        [
          (a) => statusFilter === "ALL" || a.status === statusFilter,
          (a) => orgFilter === "ALL" || String(a.organization_id) === orgFilter,
        ],
      ),
    [data, search, statusFilter, orgFilter, corpora, orgNameById],
  );

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setOrgFilter("ALL");
  }

  async function handleSave() {
    setError(null);
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        corpus_id: form.corpus_id || null,
        llm_config_id: form.llm_config_id ? Number(form.llm_config_id) : null,
        status: form.status,
        widget_features: widgetFeaturesFromForm(
          form.calculator_enabled,
          form.calculator_types,
          form.calculator_products,
        ),
      };
      if (editing) {
        await updateAccount.mutateAsync({ id: editing.id, body });
        toast.success("Account updated", { description: form.name });
      } else {
        await createAccount.mutateAsync({ ...body, organization_id: Number(form.organization_id) });
        toast.success("Account created", { description: form.name });
      }
      setDialogOpen(false);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (createAccount.isPending || updateAccount.isPending) return;
    void handleSave();
  }

  /* ---- table ---------------------------------------------------------------------------- */

  const columns: Column<Account>[] = [
    { key: "id", header: "ID", numeric: true, sortable: true, defaultHidden: true, width: 72 },
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortValue: (a) => a.name.toLowerCase(),
      minWidth: 200,
      render: (a) => (
        <div className="min-w-0 max-w-[20rem]">
          <p className="truncate font-medium text-foreground" title={a.name}>
            <span dir="auto">{a.name}</span>
          </p>
          {a.description && (
            <p className="truncate text-xs text-muted-foreground" title={a.description}>
              <span dir="auto">{a.description}</span>
            </p>
          )}
        </div>
      ),
    },
    ...(isSuperAdmin
      ? [
          {
            key: "organization",
            header: "Organization",
            sortable: true,
            sortValue: (a: Account) => resolveOrganizationName(a).toLowerCase(),
            render: (a: Account) => (
              <span dir="auto" className="block max-w-[12rem] truncate" title={a.organization_code ?? undefined}>
                {resolveOrganizationName(a)}
              </span>
            ),
          } satisfies Column<Account>,
        ]
      : []),
    {
      key: "corpus_id",
      header: "Knowledge base",
      sortable: true,
      sortValue: (a) => (a.corpus_id ? resolveCorpusDisplayName(a.corpus_id, corpora) : null),
      render: (a) =>
        a.corpus_id ? (
          <span className="font-mono text-xs text-foreground" title={a.corpus_id}>
            {resolveCorpusDisplayName(a.corpus_id, corpora)}
          </span>
        ) : (
          <span className="text-subtle-foreground">None</span>
        ),
    },
    ...(isSuperAdmin
      ? [
          {
            key: "llm_config",
            header: "LLM config",
            sortable: true,
            sortValue: (a: Account) => (a.llm_config_id != null ? llmConfigById.get(a.llm_config_id)?.model_name ?? "" : null),
            render: (a: Account) => {
              if (a.llm_config_id == null) return <span className="text-subtle-foreground">None</span>;
              const config = llmConfigById.get(a.llm_config_id);
              if (!config) return <span className="text-muted-foreground">Config #{a.llm_config_id}</span>;
              return (
                <span className="block max-w-[14rem] truncate" title={llmConfigLabel(config)}>
                  {config.model_name}
                </span>
              );
            },
          } satisfies Column<Account>,
        ]
      : []),
    { key: "status", header: "Status", sortable: true, render: (a) => <Status value={a.status} /> },
    actionsColumn<Account>(
      (a) => [
        { label: "Edit", icon: Pencil, onSelect: () => openEdit(a) },
        { label: "Members", icon: Users, hidden: !isSuperAdmin, onSelect: () => openMembers(a) },
        {
          label: "Delete",
          icon: Trash2,
          destructive: true,
          separatorBefore: true,
          onSelect: () => {
            setDeleteError(null);
            setDeleteId(a.id);
          },
        },
      ],
      { label: (a) => `Actions for ${a.name}` },
    ),
  ];

  const isFiltered = search.trim() !== "" || statusFilter !== "ALL" || orgFilter !== "ALL";
  let empty: DataTableEmpty;
  if (accountsQuery.isError) {
    empty = {
      icon: AlertCircle,
      title: "Couldn't load accounts",
      description: formatUserError(accountsQuery.error),
      action: (
        <Button variant="outline" size="sm" onClick={() => void accountsQuery.refetch()}>
          Try again
        </Button>
      ),
    };
  } else if (data.length === 0) {
    empty = {
      icon: Briefcase,
      title: "No accounts yet",
      description: "An account is one client brand with its own knowledge base, model and widget.",
      action: (
        <Button size="sm" onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add account
        </Button>
      ),
    };
  } else {
    empty = {
      title: "No accounts match these filters",
      action: (
        <Button variant="outline" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      ),
    };
  }

  const deleteTarget = deleteId != null ? data.find((a) => a.id === deleteId) : undefined;
  const currentLlmMissing =
    form.llm_config_id !== "" && !llmConfigs.some((c) => String(c.id) === form.llm_config_id);

  return (
    <Page width="wide">
      <PageHeading
        title="Accounts"
        description="Client brands, each with its own knowledge base, model and widget settings."
        meta={
          isLoading ? (
            <Skeleton className="h-4 w-20" />
          ) : accountsQuery.isError ? null : (
            <span>
              {formatNumber(data.length)} {data.length === 1 ? "account" : "accounts"}
            </span>
          )
        }
        actions={
          <Button onClick={openCreate}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            Add account
          </Button>
        }
      />

      <DataTable<Account>
        aria-label="Accounts"
        columns={columns}
        data={accountsQuery.isError ? [] : filteredData}
        keyFn={(a) => a.id}
        loading={isLoading}
        empty={empty}
        onRowClick={openEdit}
        rowLabel={(a) => a.name}
        itemLabel="accounts"
        enableColumnVisibility
        persistKey="accounts"
        toolbar={
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search name, organization or knowledge base…"
            filters={[
              {
                id: "account-org-filter",
                label: "Organization",
                value: orgFilter,
                onChange: setOrgFilter,
                hidden: !isSuperAdmin,
                options: [
                  { value: "ALL", label: "All" },
                  ...orgs.map((o) => ({ value: String(o.id), label: o.name })),
                ],
              },
              {
                id: "account-status-filter",
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
            itemLabel="accounts"
          />
        }
      />

      {/* ---- create / edit ---- */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} size="lg">
        <DialogContent onCloseAutoFocus={returnFocus}>
          <form onSubmit={onSubmit} noValidate className="contents">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit account" : "Add account"}</DialogTitle>
              <DialogDescription>
                {editing ? (
                  <>
                    <bdi>{editing.name}</bdi>
                    {isSuperAdmin && (
                      <>
                        {" · "}
                        <bdi>{resolveOrganizationName(editing)}</bdi>
                      </>
                    )}
                  </>
                ) : (
                  "A client brand with its own knowledge base, model and widget settings."
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="space-y-6">
              <ErrorAlert message={error} />

              <FormSection title="General">
                {!editing && isSuperAdmin && (
                  <Field label="Organization">
                    <Select
                      value={form.organization_id}
                      onChange={(e) => setForm({ ...form, organization_id: e.target.value })}
                    >
                      {orgs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <FieldGroup>
                  <Field label="Name" required>
                    <Input dir="auto" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </Field>
                  <Field label="Status">
                    <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                      {form.status !== "ACTIVE" && form.status !== "INACTIVE" && (
                        <option value={form.status}>{form.status.replace(/_/g, " ")}</option>
                      )}
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </Select>
                  </Field>
                </FieldGroup>
                <Field label="Description">
                  <Input
                    dir="auto"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </Field>
              </FormSection>

              <FormSection title="Knowledge & AI" description="Where answers come from and which model writes them.">
                <FieldGroup>
                  <CorpusSelect
                    value={form.corpus_id}
                    onChange={(corpusId) => setForm({ ...form, corpus_id: corpusId })}
                  />
                  <Field label="LLM config">
                    <Select
                      value={form.llm_config_id}
                      onChange={(e) => setForm({ ...form, llm_config_id: e.target.value })}
                    >
                      <option value="">None</option>
                      {llmConfigs.map((c) => (
                        <option key={c.id} value={c.id}>
                          {llmConfigLabel(c)}
                        </option>
                      ))}
                      {currentLlmMissing && (
                        <option value={form.llm_config_id}>Current configuration (#{form.llm_config_id})</option>
                      )}
                    </Select>
                  </Field>
                </FieldGroup>
              </FormSection>

              <FormSection title="Installment calculator">
                <InstallmentCalculatorEditor
                  enabled={form.calculator_enabled}
                  types={form.calculator_types}
                  products={form.calculator_products}
                  onEnabledChange={(calculator_enabled) => setForm({ ...form, calculator_enabled })}
                  onTypesChange={(calculator_types) => setForm({ ...form, calculator_types })}
                  onProductsChange={(calculator_products) => setForm({ ...form, calculator_products })}
                />
              </FormSection>
            </DialogBody>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={createAccount.isPending || updateAccount.isPending}>
                {editing ? "Save changes" : "Create account"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ---- members (Super Admin) ---- */}
      <Dialog open={membersOpen} onOpenChange={setMembersOpen} size="md">
        <DialogContent onCloseAutoFocus={returnFocus}>
          <DialogHeader>
            <DialogTitle>Members</DialogTitle>
            <DialogDescription>
              Users who can work in <bdi className="font-medium text-foreground">{membersAccount?.name}</bdi>. Changes are
              saved immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <ErrorAlert message={membersError} />
            {membersLoading ? (
              <div className="divide-y divide-border rounded-lg border border-border" aria-busy="true">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                    <Skeleton className="h-7 w-7 rounded-full" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-48" />
                      <Skeleton className="h-3 w-28" />
                    </div>
                  </div>
                ))}
              </div>
            ) : accountMembers.length ? (
              <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border">
                {accountMembers.map((member) => {
                  const name = [member.first_name, member.last_name].filter(Boolean).join(" ");
                  return (
                    <li key={member.id} className="flex items-center gap-3 px-3 py-2">
                      <Avatar name={name || member.email} size="sm" title={false} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{member.email}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          <span dir="auto">{name || `User #${member.id}`}</span>
                        </p>
                      </div>
                      <IconButton
                        label={`Remove ${member.email}`}
                        icon={X}
                        size="sm"
                        className="hover:text-danger"
                        onClick={() => void handleRemoveMember(member)}
                        disabled={unassignAccount.isPending}
                      />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                size="sm"
                icon={Users}
                title="No users assigned to this account"
                className="rounded-lg border border-dashed border-border"
              />
            )}

            <div className="space-y-2">
              <div className="flex gap-2">
                <Select
                  aria-label="User to add"
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                  className="flex-1"
                  disabled={!membersLoading && availableUsers.length === 0}
                >
                  <option value="">
                    {!membersLoading && availableUsers.length === 0 ? "No active users available" : "Select user"}
                  </option>
                  {availableUsers.map((u: User) => (
                    <option key={u.id} value={u.id}>
                      {u.email}
                      {isSuperAdmin && u.organization_id !== membersAccount?.organization_id ? ` (org ${u.organization_id})` : ""}
                    </option>
                  ))}
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleAddMember()}
                  disabled={!addUserId}
                  loading={assignAccount.isPending}
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  Add
                </Button>
              </div>
              {isSuperAdmin && availableUsers.some((u) => u.organization_id !== membersAccount?.organization_id) && (
                <p className="text-xs text-muted-foreground">
                  Users from another organization are moved into organization #{membersAccount?.organization_id} when
                  assigned.
                </p>
              )}
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMembersOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId != null}
        title="Delete account"
        message={
          deleteTarget
            ? `Delete ${deleteTarget.name}? Assigned users and related account data will also be removed.`
            : "Assigned users and related account data will also be removed."
        }
        destructive
        confirmLabel="Delete"
        loading={deleteAccount.isPending}
        loadingLabel="Deleting…"
        error={deleteError}
        onCancel={() => {
          setDeleteId(null);
          setDeleteError(null);
        }}
        onConfirm={async () => {
          if (deleteId) {
            setDeleteError(null);
            try {
              await deleteAccount.mutateAsync(deleteId);
              toast.success("Account deleted", deleteTarget ? { description: deleteTarget.name } : undefined);
              setDeleteId(null);
            } catch (e) {
              setDeleteError(formatUserError(e));
            }
          }
        }}
      />
    </Page>
  );
}
