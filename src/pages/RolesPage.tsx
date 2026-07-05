import { useEffect, useMemo, useState } from "react";
import { Check, Download, RotateCcw, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatUserError } from "@/lib/errors";
import { getDefaultNavPermissionsForRole, ROLES } from "@/lib/roles";
import { useAccounts } from "@/hooks/useAccounts";
import {
  useDownloadRoleReportPdf,
  useNavPermissionCatalog,
  useResetRoleNavPermissions,
  useRoles,
  useUpdateRoleNavPermissions,
} from "@/hooks/useRoles";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { RoleDefinition } from "@/types/api";

function roleDisplayName(name: string): string {
  if (name === ROLES.SUPER_ADMIN) return "Super Admin";
  if (name === ROLES.ORG_ADMIN) return "Organization Admin";
  if (name === ROLES.ACCOUNT_MANAGER) return "Account Manager";
  if (name === ROLES.SUPERVISOR) return "Supervisor";
  if (name === ROLES.DEVELOPER) return "Developer";
  if (name === ROLES.AGENT) return "Agent";
  return name;
}

export function RolesPage() {
  const { user, refreshProfile } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN) ?? false;
  const canExportReport = isSuperAdmin || user?.roles.includes(ROLES.ORG_ADMIN);
  const { data: accounts = [] } = useAccounts(isSuperAdmin ? null : user?.organization_id);
  const [accountId, setAccountId] = useState<number | null>(null);
  const selectedAccountId = accountId ?? accounts[0]?.id ?? null;
  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const { data: roles = [], isLoading } = useRoles(selectedAccountId, isSuperAdmin || canExportReport);
  const { data: catalog = [] } = useNavPermissionCatalog(isSuperAdmin);
  const updatePermissions = useUpdateRoleNavPermissions();
  const resetPermissions = useResetRoleNavPermissions();
  const downloadReport = useDownloadRoleReportPdf();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === selectedId) ?? roles[0] ?? null,
    [roles, selectedId],
  );

  useEffect(() => {
    if (roles.length && selectedId == null) {
      setSelectedId(roles[0].id);
    }
  }, [roles, selectedId]);

  useEffect(() => {
    if (selectedRole) {
      setDraft(selectedRole.nav_permissions);
      setSuccessMessage(null);
      setError(null);
    }
  }, [selectedRole?.id, selectedRole?.nav_permissions.join(",")]);

  function togglePermission(key: string) {
    if (!isSuperAdmin || selectedRole?.name === ROLES.SUPER_ADMIN) return;
    setDraft((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setSuccessMessage(null);
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
      setSuccessMessage("Page access updated for this account.");
      await refreshProfile();
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  async function handleDownloadReport() {
    if (selectedAccountId == null) return;
    setError(null);
    try {
      await downloadReport.mutateAsync({
        organizationId: isSuperAdmin ? undefined : user?.organization_id,
        accountId: selectedAccountId,
      });
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  function permissionsMatch(a: string[], b: string[]) {
    return [...a].sort().join(",") === [...b].sort().join(",");
  }

  function isRoleAtDefault(role: RoleDefinition) {
    return permissionsMatch(role.nav_permissions, getDefaultNavPermissionsForRole(role.name));
  }

  async function handleReset(role: RoleDefinition) {
    if (!isSuperAdmin || selectedAccountId == null || role.name === ROLES.SUPER_ADMIN) return;
    const accountName = selectedAccount?.name ?? "this account";
    const confirmed = window.confirm(
      `Reset "${roleDisplayName(role.name)}" on ${accountName} to its default page access?`,
    );
    if (!confirmed) return;

    setError(null);
    setSuccessMessage(null);
    try {
      await resetPermissions.mutateAsync({ roleId: role.id, accountId: selectedAccountId });
      if (role.id === selectedRole?.id) {
        setDraft(getDefaultNavPermissionsForRole(role.name));
      }
      setSuccessMessage(`"${roleDisplayName(role.name)}" reset to default page access.`);
      await refreshProfile();
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  const isDirty =
    selectedRole != null &&
    [...draft].sort().join(",") !== [...selectedRole.nav_permissions].sort().join(",");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & access"
        description="Configure page access per account — e.g. Hallan supervisors can differ from another account."
        icon={Shield}
        actions={
          canExportReport && selectedAccountId != null ? (
            <Button
              variant="outline"
              onClick={handleDownloadReport}
              disabled={downloadReport.isPending}
            >
              <Download className="mr-2 h-4 w-4" />
              {downloadReport.isPending ? "Generating…" : "Download PDF report"}
            </Button>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[260px]">
          <Label>Account</Label>
          <Select
            value={selectedAccountId != null ? String(selectedAccountId) : ""}
            onChange={(e) => {
              setAccountId(Number(e.target.value));
              setSelectedId(null);
            }}
            className="mt-1"
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="rounded-xl border border-[#004080]/15 bg-[#004080]/5 px-4 py-3 text-sm text-slate-700">
        <p className="font-medium text-[#004080]">
          Account: {selectedAccount?.name ?? "—"}
        </p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-slate-600">
          <li>
            <strong>Role on this account</strong> — e.g. Agent on Hallan gets Chat only here.
          </li>
          <li>
            <strong>Individual user</strong> (Users → Edit) — extra pages for one person on top of their role.
          </li>
        </ul>
      </div>

      {!selectedAccountId ? (
        <p className="text-sm text-muted-foreground">Select an account to configure role access.</p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="rounded-xl border bg-white p-3 shadow-sm">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Roles</p>
            {isLoading ? (
              <p className="px-2 py-4 text-sm text-muted-foreground">Loading roles…</p>
            ) : (
              <ul className="space-y-1">
                {roles.map((role: RoleDefinition) => {
                  const active = role.id === (selectedRole?.id ?? -1);
                  const canReset = isSuperAdmin && role.name !== ROLES.SUPER_ADMIN;
                  const atDefault = isRoleAtDefault(role);
                  return (
                    <li key={role.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setSelectedId(role.id)}
                        className={`flex min-w-0 flex-1 items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                          active
                            ? "bg-primary/10 font-semibold text-[#004080]"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span className="truncate">{roleDisplayName(role.name)}</span>
                        <Badge variant="muted" className="ml-2 shrink-0 text-[10px] tabular-nums">
                          {role.nav_permissions.length}
                        </Badge>
                      </button>
                      {canReset && (
                        <button
                          type="button"
                          title={atDefault ? "Already at default permissions" : "Reset to default"}
                          aria-label={`Reset ${roleDisplayName(role.name)} to default`}
                          onClick={() => handleReset(role)}
                          disabled={atDefault || resetPermissions.isPending}
                          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#004080] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <section className="rounded-xl border bg-white p-5 shadow-sm">
            {!selectedRole ? (
              <p className="text-sm text-muted-foreground">Select a role to view page access.</p>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{roleDisplayName(selectedRole.name)}</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedRole.name === ROLES.SUPER_ADMIN
                        ? "Super Admin always has access to every page."
                        : `Users with this role on ${selectedAccount?.name ?? "this account"} see only the checked pages.`}
                    </p>
                  </div>
                  {isSuperAdmin && selectedRole.name !== ROLES.SUPER_ADMIN && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleReset(selectedRole)}
                        disabled={isRoleAtDefault(selectedRole) || resetPermissions.isPending}
                      >
                        <RotateCcw className="mr-2 h-4 w-4" />
                        {resetPermissions.isPending ? "Resetting…" : "Reset to default"}
                      </Button>
                      <Button
                        onClick={handleSave}
                        disabled={!isDirty || updatePermissions.isPending}
                      >
                        {updatePermissions.isPending ? "Saving…" : "Save changes"}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {(catalog.length ? catalog : selectedRole.nav_permissions.map((key) => ({ key, label: key }))).map(
                    (item) => {
                      const checked = draft.includes(item.key);
                      const locked = !isSuperAdmin || selectedRole.name === ROLES.SUPER_ADMIN;
                      return (
                        <label
                          key={item.key}
                          className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 transition-colors ${
                            checked ? "border-[#004080]/30 bg-[#004080]/5" : "border-slate-200 bg-white hover:border-slate-300"
                          } ${locked ? "cursor-default opacity-90" : ""}`}
                        >
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#004080] focus:ring-[#004080]/30"
                            checked={checked}
                            disabled={locked}
                            onChange={() => togglePermission(item.key)}
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-medium text-slate-900">{item.label}</span>
                            <span className="block text-xs text-slate-500">{item.key}</span>
                          </span>
                          {checked && <Check className="ml-auto h-4 w-4 shrink-0 text-[#004080]" />}
                        </label>
                      );
                    },
                  )}
                </div>

                {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
                {successMessage && !error && (
                  <p className="mt-4 text-sm text-emerald-700">{successMessage}</p>
                )}
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
