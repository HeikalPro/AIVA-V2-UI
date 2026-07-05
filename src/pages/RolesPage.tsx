import { useEffect, useMemo, useState } from "react";
import { Check, Download, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatUserError } from "@/lib/errors";
import { ROLES } from "@/lib/roles";
import { useDownloadRoleReportPdf, useNavPermissionCatalog, useRoles, useUpdateRoleNavPermissions } from "@/hooks/useRoles";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  const isOrgAdmin = user?.roles.includes(ROLES.ORG_ADMIN) ?? false;
  const canExportReport = isSuperAdmin || isOrgAdmin;
  const { data: roles = [], isLoading } = useRoles(true);
  const { data: catalog = [] } = useNavPermissionCatalog(isSuperAdmin);
  const updatePermissions = useUpdateRoleNavPermissions();
  const downloadReport = useDownloadRoleReportPdf();

  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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
      setSaved(false);
      setError(null);
    }
  }, [selectedRole?.id, selectedRole?.nav_permissions.join(",")]);

  function togglePermission(key: string) {
    if (!isSuperAdmin || selectedRole?.name === ROLES.SUPER_ADMIN) return;
    setDraft((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
    setSaved(false);
  }

  async function handleSave() {
    if (!selectedRole || !isSuperAdmin) return;
    setError(null);
    try {
      await updatePermissions.mutateAsync({
        roleId: selectedRole.id,
        body: { nav_permissions: draft },
      });
      setSaved(true);
      await refreshProfile();
    } catch (e) {
      setError(formatUserError(e));
    }
  }

  async function handleDownloadReport() {
    setError(null);
    try {
      const orgId = isSuperAdmin ? undefined : user?.organization_id;
      await downloadReport.mutateAsync(orgId);
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
        description="Set default pages per role. To give one specific user extra pages (e.g. Prompts for a single agent), use Users → Edit user → Individual access."
        icon={Shield}
        actions={
          canExportReport ? (
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

      <div className="rounded-xl border border-[#004080]/15 bg-[#004080]/5 px-4 py-3 text-sm text-slate-700">
        <p className="font-medium text-[#004080]">Two levels of access</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-slate-600">
          <li>
            <strong>Role</strong> (this page) — all users with that role, e.g. every Agent gets Chat.
          </li>
          <li>
            <strong>Individual user</strong> (Users → Edit) — one person only, e.g. 1 of 100 agents also gets
            Prompts.
          </li>
        </ul>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-xl border bg-white p-3 shadow-sm">
          <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Roles</p>
          {isLoading ? (
            <p className="px-2 py-4 text-sm text-muted-foreground">Loading roles…</p>
          ) : (
            <ul className="space-y-1">
              {roles.map((role: RoleDefinition) => {
                const active = role.id === (selectedRole?.id ?? -1);
                return (
                  <li key={role.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(role.id)}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
                        active
                          ? "bg-primary/10 font-semibold text-[#004080]"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span>{roleDisplayName(role.name)}</span>
                      <Badge variant="muted" className="text-[10px] tabular-nums">
                        {role.nav_permissions.length}
                      </Badge>
                    </button>
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
                      : "Users with this role see only the checked pages in the menu."}
                  </p>
                </div>
                {isSuperAdmin && selectedRole.name !== ROLES.SUPER_ADMIN && (
                  <Button
                    onClick={handleSave}
                    disabled={!isDirty || updatePermissions.isPending}
                  >
                    {updatePermissions.isPending ? "Saving…" : "Save changes"}
                  </Button>
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
              {saved && !error && (
                <p className="mt-4 text-sm text-emerald-700">Page access updated. Active sessions may need a refresh.</p>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
