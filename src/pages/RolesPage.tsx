import { useEffect, useMemo, useState } from "react";
import { Building2, CircleDot, FileDown, RotateCcw, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { formatUserError } from "@/lib/errors";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getDefaultNavPermissionsForRole, ROLES } from "@/lib/roles";
import {
  useDownloadRoleReportPdf,
  useNavPermissionCatalog,
  useResetRoleNavPermissions,
  useRoles,
  useUpdateRoleNavPermissions,
} from "@/hooks/useRoles";
import { Page, PageHeading } from "@/components/shell/page";
import { EmptyState } from "@/components/data/empty-state";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ErrorAlert } from "@/components/shared/ErrorAlert";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/toast";
import { PageAccessChecklist, resolvePageAccessEntries } from "@/components/users/PageAccessGroups";
import { roleLabel } from "@/components/users/role-label";
import type { RoleDefinition } from "@/types/api";

function permissionsMatch(a: string[], b: string[]) {
  return [...a].sort().join(",") === [...b].sort().join(",");
}

function isRoleAtDefault(role: RoleDefinition) {
  return permissionsMatch(role.nav_permissions, getDefaultNavPermissionsForRole(role.name));
}

/** A change that would drop unsaved edits, waiting for confirmation. */
type PendingSwitch = { kind: "role"; roleId: number } | { kind: "account"; accountId: number | null };

export function RolesPage() {
  const { user, refreshProfile } = useAuth();
  const workspace = useWorkspace();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN) ?? false;
  const canExportReport = isSuperAdmin || user?.roles.includes(ROLES.ORG_ADMIN);

  // The page follows the shell's workspace account, but holds on to the current one while
  // unsaved changes are pending until the user confirms (or the switch is reverted).
  const [pageAccountId, setPageAccountId] = useState<number | null>(workspace.accountId);
  const selectedAccountId = pageAccountId;
  const selectedAccount = workspace.accounts.find((a) => a.id === selectedAccountId);

  const { data: roles = [], isLoading } = useRoles(selectedAccountId, isSuperAdmin || canExportReport);
  const { data: catalog = [] } = useNavPermissionCatalog(isSuperAdmin);
  const updatePermissions = useUpdateRoleNavPermissions();
  const resetPermissions = useResetRoleNavPermissions();
  const downloadReport = useDownloadRoleReportPdf();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<PendingSwitch | null>(null);

  // Super Admin's access is fixed, so open the first role that can actually be configured.
  const firstRole = useMemo(() => roles.find((r) => r.name !== ROLES.SUPER_ADMIN) ?? roles[0] ?? null, [roles]);
  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedId) ?? firstRole,
    [roles, selectedId, firstRole],
  );

  useEffect(() => {
    if (firstRole && selectedId == null) {
      setSelectedId(firstRole.id);
    }
  }, [firstRole, selectedId]);

  useEffect(() => {
    if (selectedRole) {
      setDraft(selectedRole.nav_permissions);
      setError(null);
    }
  }, [selectedRole?.id, selectedRole?.nav_permissions.join(",")]);

  const isDirty =
    selectedRole != null &&
    [...draft].sort().join(",") !== [...selectedRole.nav_permissions].sort().join(",");

  // Workspace switched in the shell: follow it, or ask first when there are unsaved changes.
  useEffect(() => {
    if (workspace.accountId === pageAccountId) return;
    if (isDirty) {
      setPendingSwitch({ kind: "account", accountId: workspace.accountId });
    } else {
      setPageAccountId(workspace.accountId);
      setSelectedId(null);
    }
    // Only react to the shell's selection changing.
  }, [workspace.accountId]);

  const canEditSelected = isSuperAdmin && selectedRole != null && selectedRole.name !== ROLES.SUPER_ADMIN;

  function togglePermission(key: string) {
    if (!isSuperAdmin || selectedRole?.name === ROLES.SUPER_ADMIN) return;
    setDraft((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function toggleGroup(keys: string[], checked: boolean) {
    if (!isSuperAdmin || selectedRole?.name === ROLES.SUPER_ADMIN) return;
    setDraft((prev) => (checked ? [...prev, ...keys.filter((k) => !prev.includes(k))] : prev.filter((k) => !keys.includes(k))));
  }

  async function handleSave() {
    if (!selectedRole || !isSuperAdmin || selectedAccountId == null) return;
    setError(null);
    try {
      await updatePermissions.mutateAsync({
        roleId: selectedRole.id,
        accountId: selectedAccountId,
        body: { nav_permissions: draft },
      });
      toast.success("Page access saved", {
        description: `${roleLabel(selectedRole.name)} on ${selectedAccount?.name ?? "this account"}`,
      });
      await refreshProfile();
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  async function handleDownloadReport() {
    if (selectedAccountId == null) return;
    try {
      await downloadReport.mutateAsync({
        organizationId: isSuperAdmin ? undefined : user?.organization_id,
        accountId: selectedAccountId,
      });
    } catch (e) {
      toast.error("Couldn't generate the PDF report", { description: formatUserError(e) });
    }
  }

  async function handleReset(role: RoleDefinition) {
    if (!isSuperAdmin || selectedAccountId == null || role.name === ROLES.SUPER_ADMIN) return;
    setError(null);
    setResetError(null);
    try {
      await resetPermissions.mutateAsync({ roleId: role.id, accountId: selectedAccountId });
      if (role.id === selectedRole?.id) {
        setDraft(getDefaultNavPermissionsForRole(role.name));
      }
      setResetOpen(false);
      toast.success(`${roleLabel(role.name)} reset to default page access`, {
        description: selectedAccount?.name,
      });
      await refreshProfile();
    } catch (e) {
      setResetError(formatUserError(e));
    }
  }

  function requestRole(roleId: number) {
    if (roleId === selectedRole?.id) return;
    if (isDirty) setPendingSwitch({ kind: "role", roleId });
    else setSelectedId(roleId);
  }

  function confirmSwitch() {
    if (!pendingSwitch) return;
    if (pendingSwitch.kind === "role") {
      if (selectedRole) setDraft(selectedRole.nav_permissions);
      setSelectedId(pendingSwitch.roleId);
    } else {
      setPageAccountId(pendingSwitch.accountId);
      setSelectedId(null);
    }
    setPendingSwitch(null);
  }

  function cancelSwitch() {
    // Put the shell's workspace back on the account whose edits are still open.
    if (pendingSwitch?.kind === "account") workspace.setAccountId(pageAccountId);
    setPendingSwitch(null);
  }

  const entries = useMemo(
    () =>
      resolvePageAccessEntries(
        catalog.length ? catalog : (selectedRole?.nav_permissions ?? []).map((key) => ({ key, label: key })),
      ),
    [catalog, selectedRole],
  );

  const accountName = selectedAccount?.name ?? "this account";
  const pendingRole = pendingSwitch?.kind === "role" ? roles.find((r) => r.id === pendingSwitch.roleId) : undefined;
  const pendingAccount =
    pendingSwitch?.kind === "account" ? workspace.accounts.find((a) => a.id === pendingSwitch.accountId) : undefined;

  const heading = (
    <PageHeading
      title="Roles & Access"
      description={
        selectedAccount
          ? `Choose which pages each role can open on ${selectedAccount.name}. Extra pages for one person are set on the Users page.`
          : "Choose which pages each role can open, per account."
      }
      actions={
        canExportReport && selectedAccountId != null ? (
          <Button variant="outline" onClick={() => void handleDownloadReport()} loading={downloadReport.isPending}>
            {!downloadReport.isPending && <FileDown aria-hidden="true" className="h-4 w-4" />}
            {downloadReport.isPending ? "Generating…" : "Download PDF"}
          </Button>
        ) : undefined
      }
    />
  );

  if (!workspace.isLoading && selectedAccountId == null) {
    return (
      <Page width="wide">
        {heading}
        <EmptyState
          icon={Building2}
          title="No account selected"
          description="Role access is configured per account. Create an account first, or pick one in the sidebar."
        />
      </Page>
    );
  }

  const rolesLoading = workspace.isLoading || isLoading;

  return (
    <Page width="wide">
      {heading}

      <div className="grid items-start gap-5 lg:grid-cols-[17rem_minmax(0,1fr)]">
        {/* ---- role list ---- */}
        <nav aria-label="Roles" className="overflow-hidden rounded-lg border border-border bg-card lg:sticky lg:top-0">
          <p className="border-b border-border bg-surface-muted px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Roles
          </p>
          {rolesLoading ? (
            <div className="space-y-1 p-1.5" aria-busy="true">
              {Array.from({ length: 6 }, (_, i) => (
                <div key={i} className="space-y-1.5 px-2.5 py-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : roles.length === 0 ? (
            <p className="px-3 py-4 text-sm text-muted-foreground">No roles for this account.</p>
          ) : (
            <ul className="space-y-0.5 p-1.5">
              {roles.map((role) => {
                const active = role.id === (selectedRole?.id ?? -1);
                const isSA = role.name === ROLES.SUPER_ADMIN;
                const modified = !isSA && !isRoleAtDefault(role);
                const count = active && !isSA ? draft.length : role.nav_permissions.length;
                const unsaved = active && isDirty;
                return (
                  <li key={role.id}>
                    <button
                      type="button"
                      aria-current={active ? "true" : undefined}
                      onClick={() => requestRole(role.id)}
                      className={cn(
                        "flex w-full items-start gap-2 rounded-md px-2.5 py-2 text-left transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active ? "bg-primary-muted" : "hover:bg-muted",
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-sm font-medium",
                            active ? "text-primary-muted-foreground" : "text-foreground",
                          )}
                        >
                          {roleLabel(role.name)}
                        </span>
                        <span className="block text-xs tabular-nums text-muted-foreground">
                          {isSA ? "All pages" : `${formatNumber(count)} ${count === 1 ? "page" : "pages"}`}
                        </span>
                      </span>
                      {unsaved ? (
                        <Badge variant="warning" className="mt-0.5">
                          Unsaved
                        </Badge>
                      ) : modified ? (
                        <Badge variant="outline" className="mt-0.5 text-muted-foreground" title="Differs from the default page access">
                          Modified
                        </Badge>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>

        {/* ---- permissions ---- */}
        <section aria-labelledby="role-access-heading" className="min-w-0 rounded-lg border border-border bg-card">
          {rolesLoading || !selectedRole ? (
            <div className="space-y-4 p-5" aria-busy={rolesLoading || undefined}>
              {rolesLoading ? (
                <>
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-80" />
                  <div className="grid gap-3 lg:grid-cols-2">
                    {Array.from({ length: 4 }, (_, i) => (
                      <Skeleton key={i} className="h-32 w-full" />
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState size="sm" icon={Shield} title="Select a role to view its page access" />
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 id="role-access-heading" className="text-base font-semibold text-foreground">
                      {roleLabel(selectedRole.name)}
                    </h2>
                    {selectedRole.name !== ROLES.SUPER_ADMIN &&
                      (isRoleAtDefault(selectedRole) ? (
                        <Badge variant="neutral">Default access</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Modified from default
                        </Badge>
                      ))}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {selectedRole.name === ROLES.SUPER_ADMIN
                      ? "Built-in administrator role."
                      : `Users with this role on ${accountName} see only the checked pages.`}
                  </p>
                </div>
              </div>

              <div className="space-y-4 p-5">
                <ErrorAlert message={error} />
                {selectedRole.name === ROLES.SUPER_ADMIN ? (
                  <Alert tone="info">This role can't be changed. It includes every page, on every account.</Alert>
                ) : (
                  <>
                    {!isSuperAdmin && (
                      <Alert tone="neutral">Only Super Admin can change role access. You can view it here.</Alert>
                    )}
                    <PageAccessChecklist
                      entries={entries}
                      columns={2}
                      isChecked={(key) => draft.includes(key)}
                      isLocked={() => !canEditSelected}
                      onToggle={(key) => togglePermission(key)}
                      onToggleGroup={canEditSelected ? toggleGroup : undefined}
                    />
                  </>
                )}
              </div>

              {canEditSelected && (
                <div className="sticky bottom-0 z-[1] flex flex-wrap items-center gap-3 rounded-b-lg border-t border-border bg-card px-5 py-3">
                  <p className="flex items-center gap-1.5 text-ui text-muted-foreground" aria-live="polite">
                    {isDirty ? (
                      <>
                        <CircleDot aria-hidden="true" className="h-4 w-4 text-warning" />
                        <span className="font-medium text-foreground">Unsaved changes</span>
                      </>
                    ) : (
                      "No unsaved changes"
                    )}
                  </p>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {isDirty && (
                      <Button variant="ghost" onClick={() => setDraft(selectedRole.nav_permissions)}>
                        Discard
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      onClick={() => {
                        setResetError(null);
                        setResetOpen(true);
                      }}
                      disabled={isRoleAtDefault(selectedRole) || resetPermissions.isPending}
                    >
                      <RotateCcw aria-hidden="true" className="h-4 w-4" />
                      Reset to default
                    </Button>
                    <Button onClick={() => void handleSave()} disabled={!isDirty} loading={updatePermissions.isPending}>
                      {updatePermissions.isPending ? "Saving…" : "Save changes"}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      <ConfirmDialog
        open={resetOpen && selectedRole != null}
        title="Reset to default page access?"
        message={
          selectedRole
            ? `${roleLabel(selectedRole.name)} on ${accountName} goes back to its default pages.${
                isDirty ? " Your unsaved changes are discarded too." : ""
              }`
            : undefined
        }
        confirmLabel="Reset to default"
        loading={resetPermissions.isPending}
        loadingLabel="Resetting…"
        error={resetError}
        onCancel={() => {
          if (resetPermissions.isPending) return;
          setResetOpen(false);
          setResetError(null);
        }}
        onConfirm={() => {
          if (selectedRole) void handleReset(selectedRole);
        }}
      />

      <ConfirmDialog
        open={pendingSwitch != null}
        title="Discard unsaved changes?"
        message={
          selectedRole
            ? `You changed the page access of ${roleLabel(selectedRole.name)} on ${accountName} without saving. ${
                pendingSwitch?.kind === "account"
                  ? `Switching to ${pendingAccount?.name ?? "another account"} discards these changes.`
                  : `Opening ${pendingRole ? roleLabel(pendingRole.name) : "another role"} discards these changes.`
              }`
            : undefined
        }
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        destructive
        onConfirm={confirmSwitch}
        onCancel={cancelSwitch}
      />
    </Page>
  );
}
