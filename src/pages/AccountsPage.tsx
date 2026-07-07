import { useMemo, useState } from "react";
import { Briefcase, Plus, Trash2, Users, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatUserError } from "@/lib/errors";
import { ROLES } from "@/lib/roles";
import { useAccounts, useCreateAccount, useDeleteAccount, useUpdateAccount } from "@/hooks/useAccounts";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useLLMConfigs } from "@/hooks/useLLMConfigs";
import { useAccountUsers, useAssignAccount, useUnassignAccount, useUsers } from "@/hooks/useUsers";
import { PageHeader } from "@/components/shared/PageHeader";
import { DataTable } from "@/components/shared/DataTable";
import { TableFilters } from "@/components/shared/TableFilters";
import { filterRows } from "@/lib/table-filters";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CorpusSelect } from "@/components/shared/CorpusSelect";
import { useCorpora } from "@/hooks/useCorpora";
import { resolveCorpusDisplayName } from "@/lib/corpus";
import {
  ALL_CALCULATOR_TYPES,
  buildCalculatorProductsPayload,
  CALCULATOR_TENOR_OPTIONS,
  CALCULATOR_TYPE_OPTIONS,
  calculatorProductsFromAccount,
  defaultCalculatorProductsForm,
  type CalculatorProductForm,
  type CalculatorTypeKey,
} from "@/lib/calculatorDefaults";
import type { Account, User, WidgetFeatures } from "@/types/api";

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

export function AccountsPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const { data: orgs = [] } = useOrganizations(isSuperAdmin);
  const { data: llmConfigs = [] } = useLLMConfigs(isSuperAdmin);
  const { data: corpora = [] } = useCorpora();
  const { data = [], isLoading } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const createAccount = useCreateAccount();
  const updateAccount = useUpdateAccount();
  const deleteAccount = useDeleteAccount();
  const assignAccount = useAssignAccount();
  const unassignAccount = useUnassignAccount();

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
    calculator_types: [...ALL_CALCULATOR_TYPES],
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
    try {
      await assignAccount.mutateAsync({
        userId: Number(addUserId),
        body: { account_id: membersAccount.id },
      });
      setAddUserId("");
    } catch (e) {
      setMembersError(formatUserError(e));
    }
  }

  async function handleRemoveMember(userId: number) {
    if (!membersAccount) return;
    setMembersError(null);
    try {
      await unassignAccount.mutateAsync({ userId, accountId: membersAccount.id });
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
      } else {
        await createAccount.mutateAsync({ ...body, organization_id: Number(form.organization_id) });
      }
      setDialogOpen(false);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Briefcase}
        title="Accounts"
        description="Manage customer accounts"
        actions={<Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" /> New Account</Button>}
      />

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, organization, or knowledge base…"
        filters={[
          ...(isSuperAdmin
            ? [
                {
                  id: "account-org-filter",
                  label: "Organization",
                  value: orgFilter,
                  onChange: setOrgFilter,
                  options: [
                    { value: "ALL", label: "All organizations" },
                    ...orgs.map((o) => ({ value: String(o.id), label: o.name })),
                  ],
                },
              ]
            : []),
          {
            id: "account-status-filter",
            label: "Status",
            value: statusFilter,
            onChange: setStatusFilter,
            options: [
              { value: "ALL", label: "All statuses" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ],
          },
        ]}
        onClear={clearFilters}
        totalCount={data.length}
        filteredCount={filteredData.length}
      />

      <DataTable<Account>
        columns={[
          { key: "id", header: "ID", sortable: true },
          { key: "name", header: "Name", sortable: true },
          {
            key: "organization_id",
            header: "Organization",
            sortable: true,
            render: (r) => (
              <span title={r.organization_code ?? undefined}>
                {resolveOrganizationName(r)}
              </span>
            ),
          },
          {
            key: "corpus_id",
            header: "Knowledge base",
            render: (r) => resolveCorpusDisplayName(r.corpus_id, corpora),
          },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          {
            key: "actions",
            header: "",
            render: (r) => (
              <div className="flex gap-2">
                {isSuperAdmin && (
                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openMembers(r); }}>
                    <Users className="mr-1 h-4 w-4" /> Members
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(r); }}>Edit</Button>
                <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDeleteId(r.id); }}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ),
          },
        ]}
        data={filteredData}
        keyFn={(r) => r.id}
        loading={isLoading}
        emptyMessage={data.length ? "No accounts match your search or filters" : "No accounts"}
        onRowClick={openEdit}
      />

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Account" : "New Account"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {!editing && isSuperAdmin && (
              <div>
                <Label>Organization</Label>
                <Select value={form.organization_id} onChange={(e) => setForm({ ...form, organization_id: e.target.value })} className="mt-1">
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </Select>
              </div>
            )}
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" /></div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" /></div>
            <CorpusSelect
              value={form.corpus_id}
              onChange={(corpusId) => setForm({ ...form, corpus_id: corpusId })}
            />
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.calculator_enabled}
                  onChange={(e) => setForm({ ...form, calculator_enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300"
                />
                <span className="text-sm font-medium text-slate-800">Installment calculator (widget)</span>
              </label>
              <p className="mt-1 text-xs text-muted-foreground">
                Enable for Hallan-style accounts. Other accounts can leave this off.
              </p>
              {form.calculator_enabled && (
                <div className="mt-3 space-y-3">
                  {CALCULATOR_TYPE_OPTIONS.map((opt) => {
                    const typeKey = opt.key as CalculatorTypeKey;
                    const on = form.calculator_types.includes(opt.key);
                    const product = form.calculator_products[typeKey];
                    return (
                      <div key={opt.key} className="rounded-lg border border-slate-200 bg-white p-3">
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => {
                              const next = on
                                ? form.calculator_types.filter((t) => t !== opt.key)
                                : [...form.calculator_types, opt.key];
                              if (next.length === 0) return;
                              setForm({ ...form, calculator_types: next });
                            }}
                            className="h-3.5 w-3.5 rounded border-slate-300"
                          />
                          <span className="text-sm font-medium text-slate-800">{opt.label}</span>
                        </label>
                        {on && (
                          <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
                            {opt.usesApr && (
                              <div>
                                <Label className="text-xs">APR (%)</Label>
                                <Input
                                  value={product.aprPercent}
                                  onChange={(e) =>
                                    setForm({
                                      ...form,
                                      calculator_products: {
                                        ...form.calculator_products,
                                        [typeKey]: { ...product, aprPercent: e.target.value },
                                      },
                                    })
                                  }
                                  placeholder="55"
                                  className="mt-1 h-9"
                                />
                              </div>
                            )}
                            <div>
                              <Label className="text-xs">Tenors (months)</Label>
                              <div className="mt-1 flex flex-wrap gap-1.5">
                                {CALCULATOR_TENOR_OPTIONS.map((month) => {
                                  const tenorOn = product.tenors.includes(month);
                                  return (
                                    <button
                                      key={month}
                                      type="button"
                                      onClick={() => {
                                        const nextTenors = tenorOn
                                          ? product.tenors.filter((t) => t !== month)
                                          : [...product.tenors, month];
                                        if (nextTenors.length === 0) return;
                                        setForm({
                                          ...form,
                                          calculator_products: {
                                            ...form.calculator_products,
                                            [typeKey]: { ...product, tenors: nextTenors },
                                          },
                                        });
                                      }}
                                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
                                        tenorOn
                                          ? "border-gochat bg-gochat/10 text-gochat"
                                          : "border-slate-300 bg-slate-50 text-slate-600"
                                      }`}
                                    >
                                      {month}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            {!opt.usesApr && (
                              <div>
                                <Label className="text-xs">Flat rate per month (%)</Label>
                                <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                  {product.tenors.map((month) => (
                                    <div key={month}>
                                      <span className="text-[10px] text-muted-foreground">{month} mo</span>
                                      <Input
                                        value={product.flatRatePercents[String(month)] ?? ""}
                                        onChange={(e) =>
                                          setForm({
                                            ...form,
                                            calculator_products: {
                                              ...form.calculator_products,
                                              [typeKey]: {
                                                ...product,
                                                flatRatePercents: {
                                                  ...product.flatRatePercents,
                                                  [String(month)]: e.target.value,
                                                },
                                              },
                                            },
                                          })
                                        }
                                        className="mt-0.5 h-8 text-xs"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div>
              <Label>LLM Config</Label>
              <Select value={form.llm_config_id} onChange={(e) => setForm({ ...form, llm_config_id: e.target.value })} className="mt-1">
                <option value="">None</option>
                {llmConfigs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.provider} / {c.model_name}{c.comment ? ` — ${c.comment}` : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="mt-1">
                <option value="ACTIVE">ACTIVE</option>
                <option value="INACTIVE">INACTIVE</option>
              </Select>
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave}>{editing ? "Save" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={membersOpen} onOpenChange={setMembersOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Manage Members — {membersAccount?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              {membersLoading ? (
                <p className="text-sm text-muted-foreground">Loading members...</p>
              ) : accountMembers.length ? (
                accountMembers.map((member) => (
                  <div key={member.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
                    <div>
                      <p className="text-sm font-medium">{member.email}</p>
                      <p className="text-xs text-muted-foreground">
                        {[member.first_name, member.last_name].filter(Boolean).join(" ") || `User #${member.id}`}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveMember(member.id)}
                      disabled={unassignAccount.isPending}
                    >
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No users assigned to this account.</p>
              )}
            </div>
            <div className="flex gap-2">
              <Select value={addUserId} onChange={(e) => setAddUserId(e.target.value)} className="flex-1">
                <option value="">Select user</option>
                {availableUsers.map((u: User) => (
                  <option key={u.id} value={u.id}>
                    {u.email}{isSuperAdmin && u.organization_id !== membersAccount?.organization_id ? ` (org ${u.organization_id})` : ""}
                  </option>
                ))}
              </Select>
              <Button
                type="button"
                variant="outline"
                onClick={handleAddMember}
                disabled={!addUserId || assignAccount.isPending}
              >
                Add
              </Button>
            </div>
            {!membersLoading && availableUsers.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No active users available to assign to this account.
              </p>
            )}
            {isSuperAdmin && availableUsers.some((u) => u.organization_id !== membersAccount?.organization_id) && (
              <p className="text-sm text-muted-foreground">
                Users from another organization will be moved into organization #{membersAccount?.organization_id} when assigned.
              </p>
            )}
            {membersError && <p className="text-sm text-red-600">{membersError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMembersOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId != null}
        title="Delete account"
        message="Assigned users and related account data will also be removed."
        destructive
        loading={deleteAccount.isPending}
        onCancel={() => { setDeleteId(null); setDeleteError(null); }}
        onConfirm={async () => {
          if (deleteId) {
            setDeleteError(null);
            try {
              await deleteAccount.mutateAsync(deleteId);
              setDeleteId(null);
            } catch (e) {
              setDeleteError(formatUserError(e));
              setDeleteId(null);
            }
          }
        }}
      />
      {deleteError && <p className="text-sm text-red-600">{deleteError}</p>}
    </div>
  );
}
