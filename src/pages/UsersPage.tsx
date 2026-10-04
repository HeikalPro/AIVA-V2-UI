import { useCallback, useMemo, useRef, useState, type FormEvent } from "react";
import {
  AlertCircle,
  ChevronDown,
  FileDown,
  Pencil,
  Plus,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatUserError } from "@/lib/errors";
import { formatDate, formatNumber } from "@/lib/format";
import { ROLES, canAccessPermission } from "@/lib/roles";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useAssignAccount,
  useUnassignAccount,
  useSetUserRole,
  useSetUserNavPermissions,
} from "@/hooks/useUsers";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useAccounts } from "@/hooks/useAccounts";
import { filterRows } from "@/lib/table-filters";
import { buildLoginEmail, parseLoginLocalPart } from "@/lib/login-email";
import { passwordHint } from "@/lib/password-hint";
import { useRoles, useDownloadRoleReportPdf } from "@/hooks/useRoles";
import { Page, PageHeading } from "@/components/shell/page";
import { DataTable, actionsColumn, type Column, type DataTableEmpty } from "@/components/data/data-table";
import { FilterBar } from "@/components/data/filter-bar";
import { Status } from "@/components/data/status";
import { EmptyState } from "@/components/data/empty-state";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { LoginEmailField } from "@/components/auth/LoginEmailField";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Field, FieldGroup } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RolePageAccessPreview } from "@/components/users/RolePageAccessPreview";
import { UserExtraPageAccessEditor } from "@/components/users/UserExtraPageAccessEditor";
import { OverflowChips } from "@/components/users/OverflowChips";
import { roleLabel } from "@/components/users/role-label";
import { useDeepLinks } from "@/components/users/useDeepLinks";
import { TraineeDialog } from "@/components/agents/TraineeDialog";
import type { User } from "@/types/api";
import { useReturnFocus } from "@/components/users/useReturnFocus";

function primaryRoleId(user: User, roleOptions: { id: number; name: string }[]): string {
  const primaryName = user.roles[0];
  const match = roleOptions.find((r) => r.name === primaryName);
  const agent = roleOptions.find((r) => r.name === "AGENT");
  return String(match?.id ?? agent?.id ?? roleOptions[0]?.id ?? "");
}

function defaultAgentRoleId(roleOptions: { id: number; name: string }[]): string {
  const agent = roleOptions.find((r) => r.name === "AGENT");
  return String(agent?.id ?? roleOptions[0]?.id ?? "");
}

function fullName(u: Pick<User, "first_name" | "last_name">): string {
  return [u.first_name, u.last_name].filter(Boolean).join(" ");
}

const ORG_ADMIN_RESTRICTED_NAV = ["organizations", "roles", "message-ratings", "llm-configs"];
// Roles an account manager may assign, and the only roles they may re-role.
const ACCOUNT_MANAGER_ROLES: string[] = [ROLES.SUPERVISOR, ROLES.AGENT];

type DetailsTab = "overview" | "access" | "accounts";

export function UsersPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const isOrgAdmin = user?.roles.includes(ROLES.ORG_ADMIN);
  const isAccountManager = user?.roles.includes(ROLES.ACCOUNT_MANAGER);
  const canCreateUsers = isSuperAdmin || isOrgAdmin || isAccountManager;
  const canDeleteUsers = isSuperAdmin || isOrgAdmin;
  const canAssignAccounts = isSuperAdmin || isOrgAdmin || isAccountManager;
  const canManagePageAccess = isSuperAdmin || isOrgAdmin;
  const canExportReport = isSuperAdmin || isOrgAdmin;
  const canManageAgents = user ? canAccessPermission(user, "agents") : false;
  const orgsQuery = useOrganizations(isSuperAdmin);
  const { data: orgs = [] } = orgsQuery;
  const accountsQuery = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const { data: accounts = [] } = accountsQuery;
  const usersQuery = useUsers(isSuperAdmin ? null : user?.organization_id);
  const { data = [], isLoading } = usersQuery;
  const createUser = useCreateUser();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const assignAccount = useAssignAccount();
  const unassignAccount = useUnassignAccount();
  const setUserRole = useSetUserRole();
  const setUserNavPermissions = useSetUserNavPermissions();
  const downloadReport = useDownloadRoleReportPdf();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState<DetailsTab>("overview");
  const [editing, setEditing] = useState<User | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [addAccountId, setAddAccountId] = useState("");
  const [form, setForm] = useState({
    organization_id: "",
    emailLocal: "",
    password: "",
    first_name: "",
    last_name: "",
    status: "ACTIVE",
    role_id: "",
    account_id: "",
  });
  const [extraNavPermissions, setExtraNavPermissions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [orgFilter, setOrgFilter] = useState("ALL");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [accountFilter, setAccountFilter] = useState("ALL");
  const [traineeOpen, setTraineeOpen] = useState(false);
  const sheetFormRef = useRef<HTMLFormElement>(null);
  const returnFocus = useReturnFocus();
  const saving = createUser.isPending || updateUser.isPending || setUserRole.isPending || setUserNavPermissions.isPending;

  const createOrgId = !editing && form.organization_id ? Number(form.organization_id) : null;
  const createAccounts = createOrgId
    ? accounts.filter((a) => a.organization_id === createOrgId)
    : accounts;
  const rolesAccountId = editing
    ? (editing.account_ids[0] ?? createAccounts[0]?.id ?? null)
    : (form.account_id ? Number(form.account_id) : createAccounts[0]?.id ?? null);
  const rolesQuery = useRoles(
    rolesAccountId,
    (canCreateUsers || isSuperAdmin) && rolesAccountId != null,
  );
  const { data: roleDefinitions = [] } = rolesQuery;
  const roleOptions = useMemo(
    () =>
      roleDefinitions
        .filter((r) => (isSuperAdmin || isOrgAdmin ? true : ACCOUNT_MANAGER_ROLES.includes(r.name)))
        .map((r) => ({ id: r.id, name: r.name, nav_permissions: r.nav_permissions })),
    [roleDefinitions, isSuperAdmin, isOrgAdmin],
  );
  // Account managers may only re-role supervisors and agents; the backend enforces
  // this too, along with the "must share an account" rule it can check properly.
  const canEditRoleOf = useCallback(
    (target: User | null) => {
      if (isSuperAdmin) return true;
      if (!isAccountManager || !target) return false;
      return target.roles.every((r) => ACCOUNT_MANAGER_ROLES.includes(r));
    },
    [isSuperAdmin, isAccountManager],
  );
  const canEditEditingRole = canEditRoleOf(editing);
  const selectedRolePreview = useMemo(
    () => roleOptions.find((r) => String(r.id) === form.role_id),
    [roleOptions, form.role_id],
  );
  const editingRolePreview = useMemo(() => {
    if (!editing) return selectedRolePreview;
    const roleName = editing.roles[0];
    return roleOptions.find((r) => r.name === roleName) ?? selectedRolePreview;
  }, [editing, roleOptions, selectedRolePreview]);
  // Read-only "pages from this role" for editors who cannot grant extra pages: the role picked in
  // the form when they may change it, otherwise the user's current role (unfiltered definitions).
  const accessPreviewRole = useMemo(() => {
    if (!editing) return selectedRolePreview;
    if (canEditEditingRole) return selectedRolePreview;
    return roleDefinitions.find((r) => r.name === editing.roles[0]);
  }, [editing, canEditEditingRole, selectedRolePreview, roleDefinitions]);
  const extrasDirty = useMemo(() => {
    if (!editing) return false;
    const saved = [...(editing.extra_nav_permissions ?? [])].sort().join(",");
    const draft = [...extraNavPermissions].sort().join(",");
    return saved !== draft;
  }, [editing, extraNavPermissions]);

  const editOrgId = editing?.organization_id ?? null;
  const editAccounts = isSuperAdmin
    ? accounts
    : editOrgId
      ? accounts.filter((a) => a.organization_id === editOrgId)
      : accounts;
  const accountNameById = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  const orgNameById = useMemo(() => new Map(orgs.map((o) => [o.id, o.name])), [orgs]);
  const availableAccounts = editAccounts.filter((a) => !(editing?.account_ids ?? []).includes(a.id));

  const resolveOrganizationName = useCallback(
    (u: User): string => u.organization_name ?? orgNameById.get(u.organization_id) ?? `Organization #${u.organization_id}`,
    [orgNameById],
  );

  function accountName(id: number): string {
    return accountNameById.get(id) ?? `Account #${id}`;
  }

  function defaultCreateOrganizationId(): string {
    if (!isSuperAdmin) return String(user?.organization_id ?? "");
    const orgWithAccounts = orgs.find((o) => accounts.some((a) => a.organization_id === o.id));
    return String(orgWithAccounts?.id ?? orgs[0]?.id ?? "");
  }

  function openCreate() {
    setEditing(null);
    setForm({
      organization_id: defaultCreateOrganizationId(),
      emailLocal: "",
      password: "",
      first_name: "",
      last_name: "",
      status: "ACTIVE",
      role_id: defaultAgentRoleId(roleOptions),
      account_id: "",
    });
    setExtraNavPermissions([]);
    setError(null);
    setAddAccountId("");
    setTab("overview");
    setDialogOpen(true);
  }

  function openEdit(u: User) {
    setEditing(u);
    setExtraNavPermissions(u.extra_nav_permissions ?? []);
    setForm({
      organization_id: String(u.organization_id),
      emailLocal: parseLoginLocalPart(u.email),
      password: "",
      first_name: u.first_name ?? "",
      last_name: u.last_name ?? "",
      status: u.status,
      role_id: primaryRoleId(u, roleOptions),
      account_id: "",
    });
    setError(null);
    setAddAccountId("");
    setTab("overview");
    setDialogOpen(true);
  }

  // Command palette: /users?action=create opens the create sheet once the data its defaults
  // come from (organizations, accounts, roles) has loaded; /users?q=<email> pre-fills the search.
  const createDefaultsReady =
    !accountsQuery.isLoading && !(isSuperAdmin && orgsQuery.isLoading) && !rolesQuery.isLoading;
  useDeepLinks({
    onCreate: openCreate,
    canCreate: Boolean(canCreateUsers),
    onSearch: setSearch,
    ready: createDefaultsReady,
  });

  async function handleAddAccount() {
    if (!editing || !addAccountId) return;
    setError(null);
    try {
      const updated = await assignAccount.mutateAsync({
        userId: editing.id,
        body: { account_id: Number(addAccountId) },
      });
      setEditing(updated);
      // Assigning a cross-org account moves the user into that account's organization.
      // Resync the form so handleSave does not see a phantom org change and revert it.
      setForm((f) => ({ ...f, organization_id: String(updated.organization_id) }));
      setAddAccountId("");
      toast.success(`Added to ${accountName(Number(addAccountId))}`);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  async function handleRemoveAccount(accountId: number) {
    if (!editing) return;
    setError(null);
    try {
      const updated = await unassignAccount.mutateAsync({ userId: editing.id, accountId });
      setEditing(updated);
      toast.success(`Removed from ${accountName(accountId)}`);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  const filteredData = useMemo(
    () =>
      filterRows(
        data,
        search,
        (u) =>
          [
            u.email,
            u.first_name ?? "",
            u.last_name ?? "",
            resolveOrganizationName(u),
            u.organization_code ?? "",
            u.status,
            ...u.roles,
            ...u.roles.map(roleLabel),
            ...u.account_ids.map((id) => accountNameById.get(id) ?? ""),
          ].join(" "),
        [
          (u) => statusFilter === "ALL" || u.status === statusFilter,
          (u) => orgFilter === "ALL" || String(u.organization_id) === orgFilter,
          (u) => roleFilter === "ALL" || u.roles.includes(roleFilter),
          (u) =>
            accountFilter === "ALL" ||
            (accountFilter === "NONE" ? u.account_ids.length === 0 : u.account_ids.includes(Number(accountFilter))),
        ],
      ),
    [data, search, statusFilter, orgFilter, roleFilter, accountFilter, accountNameById, resolveOrganizationName],
  );

  function clearFilters() {
    setSearch("");
    setStatusFilter("ALL");
    setOrgFilter("ALL");
    setRoleFilter("ALL");
    setAccountFilter("ALL");
  }

  async function handleSave() {
    setError(null);
    const email = buildLoginEmail(form.emailLocal).toLowerCase();
    if (!email) {
      setError("Email is required.");
      setTab("overview");
      return;
    }
    try {
      if (editing) {
        const orgChanged =
          isSuperAdmin && Number(form.organization_id) !== editing.organization_id;
        const updated = await updateUser.mutateAsync({
          id: editing.id,
          body: {
            ...(orgChanged ? { organization_id: Number(form.organization_id) } : {}),
            email,
            first_name: form.first_name || null,
            last_name: form.last_name || null,
            status: form.status,
          },
        });
        setEditing(updated);
        if (canEditEditingRole) {
          const roleId = Number(form.role_id || defaultAgentRoleId(roleOptions));
          if (roleId) {
            await setUserRole.mutateAsync({
              userId: editing.id,
              body: { role_id: roleId },
            });
          }
        }
        if (canManagePageAccess && extrasDirty) {
          await setUserNavPermissions.mutateAsync({
            userId: editing.id,
            body: { extra_nav_permissions: extraNavPermissions },
          });
        }
        toast.success("User updated", { description: email });
      } else {
        const roleId = Number(form.role_id || defaultAgentRoleId(roleOptions));
        if (!roleId) {
          setError("Select a role for the new user.");
          setTab("access");
          return;
        }
        await createUser.mutateAsync({
          organization_id: Number(form.organization_id),
          email,
          password: form.password,
          first_name: form.first_name || null,
          last_name: form.last_name || null,
          status: form.status,
          role_id: roleId,
          account_id: form.account_id ? Number(form.account_id) : null,
        });
        toast.success("User created", { description: email });
      }
      setDialogOpen(false);
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (saving) return;
    void handleSave();
  }

  async function handleDownloadReport() {
    try {
      await downloadReport.mutateAsync({
        organizationId: isSuperAdmin ? undefined : user?.organization_id,
      });
    } catch (e) {
      toast.error("Couldn't generate the PDF report", { description: formatUserError(e) });
    }
  }

  /* ---- table ---------------------------------------------------------------------------- */

  const columns: Column<User>[] = [
    {
      key: "id",
      header: "ID",
      numeric: true,
      sortable: true,
      defaultHidden: true,
      width: 72,
    },
    {
      key: "name",
      header: "Name",
      sortable: true,
      sortValue: (u) => (fullName(u) || u.email).toLowerCase(),
      minWidth: 200,
      render: (u) => {
        const name = fullName(u);
        return (
          <div className="flex min-w-0 max-w-[18rem] items-center gap-2.5">
            <Avatar name={name || u.email} size="sm" title={false} />
            {name ? (
              <span dir="auto" className="truncate font-medium text-foreground" title={name}>
                {name}
              </span>
            ) : (
              <span className="truncate text-muted-foreground">No name</span>
            )}
          </div>
        );
      },
    },
    {
      key: "email",
      header: "Email",
      sortable: true,
      truncate: true,
      maxWidth: "17rem",
    },
    ...(isSuperAdmin
      ? [
          {
            key: "organization",
            header: "Organization",
            sortable: true,
            sortValue: (u: User) => resolveOrganizationName(u).toLowerCase(),
            render: (u: User) => (
              <span dir="auto" className="block max-w-[12rem] truncate" title={u.organization_code ?? undefined}>
                {resolveOrganizationName(u)}
              </span>
            ),
          } satisfies Column<User>,
        ]
      : []),
    {
      key: "role",
      header: "Role",
      sortable: true,
      sortValue: (u) => roleLabel(u.roles[0] ?? ""),
      render: (u) => (
        <div className="flex flex-wrap items-center gap-1">
          {u.roles.length === 0 && <span className="text-subtle-foreground">—</span>}
          {u.roles.map((role) => (
            <Badge key={role} variant={role === ROLES.SUPER_ADMIN ? "primary" : "neutral"}>
              {roleLabel(role)}
            </Badge>
          ))}
          {u.is_trainee && <Badge variant="outline">Trainee</Badge>}
        </div>
      ),
    },
    {
      key: "accounts",
      header: "Accounts",
      sortable: true,
      sortValue: (u) => u.account_ids.length,
      render: (u) => (
        <OverflowChips noun="accounts" items={u.account_ids.map((id) => ({ key: id, label: accountName(id) }))} />
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (u) => <Status value={u.status} />,
    },
    {
      key: "created_at",
      header: "Created",
      sortable: true,
      defaultHidden: true,
      render: (u) => (u.created_at ? formatDate(u.created_at) : "—"),
    },
    actionsColumn<User>(
      (u) => [
        { label: "Edit", icon: Pencil, onSelect: () => openEdit(u) },
        {
          label: "Delete",
          icon: Trash2,
          destructive: true,
          separatorBefore: true,
          hidden: !(canDeleteUsers && u.id !== user?.id),
          onSelect: () => {
            setDeleteError(null);
            setDeleteId(u.id);
          },
        },
      ],
      { label: (u) => `Actions for ${u.email}` },
    ),
  ];

  const isFiltered =
    search.trim() !== "" || statusFilter !== "ALL" || orgFilter !== "ALL" || roleFilter !== "ALL" || accountFilter !== "ALL";

  let empty: DataTableEmpty;
  if (usersQuery.isError) {
    empty = {
      icon: AlertCircle,
      title: "Couldn't load users",
      description: formatUserError(usersQuery.error),
      action: (
        <Button variant="outline" size="sm" onClick={() => void usersQuery.refetch()}>
          Try again
        </Button>
      ),
    };
  } else if (data.length === 0) {
    empty = {
      icon: Users,
      title: "No users yet",
      description: canCreateUsers ? "Add the first user to give them access to AIVA." : undefined,
      action: canCreateUsers ? (
        <Button size="sm" onClick={openCreate}>
          <Plus aria-hidden="true" className="h-4 w-4" />
          Add user
        </Button>
      ) : undefined,
    };
  } else {
    empty = {
      title: "No users match these filters",
      action: (
        <Button variant="outline" size="sm" onClick={clearFilters}>
          Clear filters
        </Button>
      ),
    };
  }

  /* ---- details sheet pieces ------------------------------------------------------------- */

  const editingName = editing ? fullName(editing) : "";
  const deleteTarget = deleteId != null ? data.find((u) => u.id === deleteId) : undefined;

  const statusField = (
    <Field label="Status">
      <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
        {form.status !== "ACTIVE" && form.status !== "INACTIVE" && (
          <option value={form.status}>{form.status.replace(/_/g, " ")}</option>
        )}
        <option value="ACTIVE">Active</option>
        <option value="INACTIVE">Inactive</option>
      </Select>
    </Field>
  );

  return (
    <Page width="wide">
      <PageHeading
        title="Users"
        description="Manage users and their access across AIVA."
        meta={
          isLoading ? (
            <Skeleton className="h-4 w-16" />
          ) : usersQuery.isError ? null : (
            <span>
              {formatNumber(data.length)} {data.length === 1 ? "user" : "users"}
            </span>
          )
        }
        actions={
          <>
            {canExportReport && (
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" loading={downloadReport.isPending}>
                    {!downloadReport.isPending && <FileDown aria-hidden="true" className="h-4 w-4" />}
                    {downloadReport.isPending ? "Generating…" : "Export"}
                    <ChevronDown aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem icon={FileDown} onSelect={() => void handleDownloadReport()}>
                    Download PDF report
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {canManageAgents && (
              <Button variant="outline" onClick={() => setTraineeOpen(true)}>
                <UserPlus aria-hidden="true" className="h-4 w-4" />
                Add trainee
              </Button>
            )}
            {canCreateUsers && (
              <Button onClick={openCreate}>
                <Plus aria-hidden="true" className="h-4 w-4" />
                Add user
              </Button>
            )}
          </>
        }
      />

      <DataTable<User>
        aria-label="Users"
        columns={columns}
        data={usersQuery.isError ? [] : filteredData}
        keyFn={(u) => u.id}
        loading={isLoading}
        empty={empty}
        onRowClick={openEdit}
        rowLabel={(u) => u.email}
        itemLabel="users"
        enableColumnVisibility
        persistKey="users"
        toolbar={
          <FilterBar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search name, email, role or account…"
            filters={[
              {
                id: "user-role-filter",
                label: "Role",
                value: roleFilter,
                onChange: setRoleFilter,
                options: [
                  { value: "ALL", label: "All" },
                  ...roleOptions.map((r) => ({ value: r.name, label: roleLabel(r.name) })),
                ],
              },
              {
                id: "user-account-filter",
                label: "Account",
                value: accountFilter,
                onChange: setAccountFilter,
                options: [
                  { value: "ALL", label: "All" },
                  ...accounts.map((a) => ({ value: String(a.id), label: a.name })),
                  { value: "NONE", label: "No account" },
                ],
              },
              {
                id: "user-status-filter",
                label: "Status",
                value: statusFilter,
                onChange: setStatusFilter,
                options: [
                  { value: "ALL", label: "All" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ],
              },
              {
                id: "user-org-filter",
                label: "Organization",
                value: orgFilter,
                onChange: setOrgFilter,
                hidden: !isSuperAdmin,
                options: [
                  { value: "ALL", label: "All" },
                  ...orgs.map((o) => ({ value: String(o.id), label: o.name })),
                ],
              },
            ]}
            onClear={clearFilters}
            isFiltered={isFiltered}
            totalCount={isFiltered ? data.length : undefined}
            filteredCount={filteredData.length}
            itemLabel="users"
          />
        }
      />

      <TraineeDialog
        open={traineeOpen}
        onOpenChange={setTraineeOpen}
        accounts={isSuperAdmin ? accounts : accounts.filter((a) => a.organization_id === user?.organization_id)}
      />

      <Sheet open={dialogOpen} onOpenChange={setDialogOpen}>
        <SheetContent
          size="lg"
          onCloseAutoFocus={returnFocus}
          onOpenAutoFocus={(event) => {
            // Start in the first field rather than on the tab list.
            const field = sheetFormRef.current?.querySelector<HTMLElement>(
              "[role=tabpanel] input, [role=tabpanel] select, [role=tabpanel] textarea",
            );
            if (field) {
              event.preventDefault();
              field.focus();
            }
          }}
        >
          <form ref={sheetFormRef} onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
            <SheetHeader className="border-b-0 pb-1">
              {editing ? (
                <div className="flex items-center gap-3">
                  <Avatar name={editingName || editing.email} title={false} />
                  <div className="min-w-0">
                    <SheetTitle className="truncate">
                      <span dir="auto">{editingName || editing.email}</span>
                    </SheetTitle>
                    <SheetDescription className="truncate">
                      {editing.email}
                      {isSuperAdmin && (
                        <>
                          {" · "}
                          <span dir="auto">{resolveOrganizationName(editing)}</span>
                        </>
                      )}
                    </SheetDescription>
                  </div>
                  <Status value={editing.status} className="ml-auto shrink-0" />
                </div>
              ) : (
                <>
                  <SheetTitle>Add user</SheetTitle>
                  <SheetDescription>Create a sign-in, choose a role and give access to an account.</SheetDescription>
                </>
              )}
            </SheetHeader>

            <Tabs
              value={tab}
              onValueChange={(v) => setTab(v as DetailsTab)}
              className="flex min-h-0 flex-1 flex-col gap-0"
            >
              <TabsList aria-label="User details" className="shrink-0 px-5">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="access">Access</TabsTrigger>
                <TabsTrigger value="accounts" count={editing ? editing.account_ids.length : undefined}>
                  Accounts
                </TabsTrigger>
              </TabsList>

              <SheetBody className="space-y-4">
                <ErrorAlert message={error} />

                <TabsContent value="overview" className="mt-0 space-y-4">
                  {isSuperAdmin && (
                    <Field label="Organization">
                      <Select
                        value={form.organization_id}
                        onChange={(e) => setForm({ ...form, organization_id: e.target.value, account_id: "" })}
                      >
                        {orgs.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  {isSuperAdmin && !editing && createOrgId && createAccounts.length === 0 && (
                    <Alert tone="warning">
                      No accounts in this organization. Create an account first, or pick another organization (e.g.
                      GoChat247 for Halan).
                    </Alert>
                  )}
                  {isSuperAdmin && editing && Number(form.organization_id) !== editing.organization_id && (
                    <Alert tone="warning">
                      Changing organization removes account access for accounts outside the new organization.
                    </Alert>
                  )}
                  <LoginEmailField
                    localPart={form.emailLocal}
                    onLocalPartChange={(emailLocal) => setForm({ ...form, emailLocal })}
                  />
                  {!editing && (
                    <Field label="Password" hint={passwordHint()}>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                      />
                    </Field>
                  )}
                  <FieldGroup>
                    <Field label="First name">
                      <Input
                        dir="auto"
                        value={form.first_name}
                        onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                      />
                    </Field>
                    <Field label="Last name">
                      <Input
                        dir="auto"
                        value={form.last_name}
                        onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                      />
                    </Field>
                  </FieldGroup>
                  <FieldGroup>{statusField}</FieldGroup>
                </TabsContent>

                <TabsContent value="access" className="mt-0 space-y-5">
                  {editing && !canEditEditingRole && editing.roles[0] && (
                    <Field
                      label="Role"
                      hint={
                        canManagePageAccess
                          ? "Role is managed by Super Admin. You can still grant extra pages to this user below."
                          : "Role is managed by Super Admin."
                      }
                    >
                      <div className="flex flex-wrap gap-1">
                        {editing.roles.map((role) => (
                          <Badge key={role} variant="neutral">
                            {roleLabel(role)}
                          </Badge>
                        ))}
                      </div>
                    </Field>
                  )}
                  {(!editing || canEditEditingRole) && (
                    <Field
                      label="Role"
                      hint={
                        editing
                          ? "Replaces the user's current role. Account access is unchanged."
                          : "Sets the pages this user can open. You can grant extra pages after the user is created."
                      }
                    >
                      <Select value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}>
                        {roleOptions.map((r) => (
                          <option key={r.id} value={r.id}>
                            {roleLabel(r.name)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                  {!editing && selectedRolePreview && (
                    <RolePageAccessPreview navPermissions={selectedRolePreview.nav_permissions} compact />
                  )}
                  {editing && editing.roles.includes(ROLES.SUPER_ADMIN) && (
                    <Alert tone="info">Super Admin always has access to every page.</Alert>
                  )}
                  {editing &&
                    canManagePageAccess &&
                    editingRolePreview &&
                    !editing.roles.includes(ROLES.SUPER_ADMIN) && (
                      <UserExtraPageAccessEditor
                        roleNavPermissions={editingRolePreview.nav_permissions}
                        extraNavPermissions={extraNavPermissions}
                        onExtraChange={setExtraNavPermissions}
                        restrictedKeys={isSuperAdmin ? [] : ORG_ADMIN_RESTRICTED_NAV}
                      />
                    )}
                  {editing &&
                    !canManagePageAccess &&
                    accessPreviewRole &&
                    !editing.roles.includes(ROLES.SUPER_ADMIN) && (
                      <RolePageAccessPreview navPermissions={accessPreviewRole.nav_permissions} compact />
                    )}
                </TabsContent>

                <TabsContent value="accounts" className="mt-0 space-y-4">
                  {!editing && (
                    <Field
                      label="Account"
                      hint={
                        createAccounts.length === 0
                          ? "No accounts in this organization yet."
                          : "Optional. You can add more accounts after the user is created."
                      }
                    >
                      <Select value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })}>
                        <option value="">None</option>
                        {createAccounts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}

                  {editing && (
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-ui font-medium text-foreground">Account access</p>
                        <p className="text-xs text-muted-foreground">
                          {canAssignAccounts
                            ? "Changes here are saved immediately."
                            : "Accounts this user can work in."}
                        </p>
                      </div>
                      {editing.account_ids.length ? (
                        <ul className="divide-y divide-border rounded-lg border border-border">
                          {editing.account_ids.map((accountId) => (
                            <li key={accountId} className="flex min-h-11 items-center justify-between gap-2 px-3 py-1.5">
                              <span dir="auto" className="min-w-0 truncate text-sm text-foreground">
                                {accountName(accountId)}
                              </span>
                              {canAssignAccounts && (
                                <IconButton
                                  label={`Remove ${accountName(accountId)}`}
                                  icon={X}
                                  size="sm"
                                  className="hover:text-danger"
                                  onClick={() => void handleRemoveAccount(accountId)}
                                  disabled={unassignAccount.isPending}
                                />
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <EmptyState size="sm" title="No accounts assigned" className="rounded-lg border border-dashed border-border" />
                      )}

                      {canAssignAccounts && (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <Select
                              aria-label="Account to add"
                              value={addAccountId}
                              onChange={(e) => setAddAccountId(e.target.value)}
                              className="flex-1"
                              disabled={availableAccounts.length === 0}
                            >
                              <option value="">
                                {availableAccounts.length === 0 ? "No more accounts available" : "Select account"}
                              </option>
                              {availableAccounts.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.name}
                                  {isSuperAdmin && a.organization_id !== editing.organization_id
                                    ? ` (org ${a.organization_id})`
                                    : ""}
                                </option>
                              ))}
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => void handleAddAccount()}
                              disabled={!addAccountId}
                              loading={assignAccount.isPending}
                            >
                              <Plus aria-hidden="true" className="h-4 w-4" />
                              Add
                            </Button>
                          </div>
                          {isSuperAdmin &&
                            availableAccounts.some((a) => a.organization_id !== editing.organization_id) && (
                              <p className="text-xs text-muted-foreground">
                                Assigning an account from another organization moves this user into that account&apos;s
                                organization.
                              </p>
                            )}
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>
              </SheetBody>
            </Tabs>

            <SheetFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving}>
                {editing ? "Save changes" : "Create user"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={deleteId != null}
        title="Delete user"
        message={
          deleteTarget
            ? `This permanently removes ${deleteTarget.email} and cannot be undone.`
            : "This permanently removes the user and cannot be undone."
        }
        destructive
        loading={deleteBusy}
        loadingLabel="Deleting…"
        confirmLabel="Delete"
        error={deleteError}
        onCancel={() => {
          if (deleteBusy) return;
          setDeleteId(null);
          setDeleteError(null);
        }}
        onConfirm={async () => {
          if (!deleteId || deleteBusy) return;
          setDeleteError(null);
          setDeleteBusy(true);
          try {
            await deleteUser.mutateAsync(deleteId);
            toast.success("User deleted", deleteTarget ? { description: deleteTarget.email } : undefined);
            setDeleteId(null);
            setDeleteError(null);
          } catch (e) {
            setDeleteError(formatUserError(e));
          } finally {
            setDeleteBusy(false);
          }
        }}
      />
    </Page>
  );
}
