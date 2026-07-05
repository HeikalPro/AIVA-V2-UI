import { NAV_PERMISSION_LABELS, type NavPermissionKey } from "@/lib/roles";

type Props = {
  navPermissions: string[];
  compact?: boolean;
};

export function RolePageAccessPreview({ navPermissions, compact = false }: Props) {
  if (!navPermissions.length) {
    return <p className="text-xs text-muted-foreground">No pages assigned to this role.</p>;
  }

  const sorted = [...navPermissions].sort((a, b) => {
    const la = NAV_PERMISSION_LABELS[a as NavPermissionKey] ?? a;
    const lb = NAV_PERMISSION_LABELS[b as NavPermissionKey] ?? b;
    return la.localeCompare(lb);
  });

  return (
    <div className={`rounded-lg border border-slate-200 bg-slate-50/80 ${compact ? "p-2.5" : "p-3"}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Page access</p>
      <ul className={`mt-2 flex flex-wrap gap-1.5 ${compact ? "" : "gap-2"}`}>
        {sorted.map((key) => (
          <li
            key={key}
            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700"
          >
            {NAV_PERMISSION_LABELS[key as NavPermissionKey] ?? key}
          </li>
        ))}
      </ul>
    </div>
  );
}
