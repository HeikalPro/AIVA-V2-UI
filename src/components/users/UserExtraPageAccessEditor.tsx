import { NAV_PERMISSION_LABELS, type NavPermissionKey } from "@/lib/roles";

const NAV_KEYS = Object.keys(NAV_PERMISSION_LABELS) as NavPermissionKey[];

type Props = {
  roleNavPermissions: string[];
  extraNavPermissions: string[];
  onExtraChange: (keys: string[]) => void;
  disabled?: boolean;
  restrictedKeys?: string[];
};

export function UserExtraPageAccessEditor({
  roleNavPermissions,
  extraNavPermissions,
  onExtraChange,
  disabled = false,
  restrictedKeys = [],
}: Props) {
  const roleSet = new Set(roleNavPermissions);
  const restrictedSet = new Set(restrictedKeys);

  function toggleExtra(key: string) {
    if (disabled || roleSet.has(key) || restrictedSet.has(key)) return;
    if (extraNavPermissions.includes(key)) {
      onExtraChange(extraNavPermissions.filter((k) => k !== key));
    } else {
      onExtraChange([...extraNavPermissions, key]);
    }
  }

  const effective = new Set([...roleNavPermissions, ...extraNavPermissions]);

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Individual access (this user only)
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Applies only to this account — not the other 99 agents. Pages from the role stay locked; check any
          extra pages this person needs (e.g. Prompts for one senior agent).
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {NAV_KEYS.map((key) => {
          const fromRole = roleSet.has(key);
          const fromExtra = extraNavPermissions.includes(key);
          const checked = effective.has(key);
          const locked = disabled || fromRole || restrictedSet.has(key);
          const label = NAV_PERMISSION_LABELS[key];

          return (
            <label
              key={key}
              className={`flex items-start gap-2.5 rounded-md border px-2.5 py-2 text-sm ${
                checked ? "border-[#004080]/25 bg-white" : "border-slate-200 bg-white/60"
              } ${locked ? "opacity-80" : "cursor-pointer hover:border-slate-300"}`}
            >
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#004080] focus:ring-[#004080]/30"
                checked={checked}
                disabled={locked}
                onChange={() => toggleExtra(key)}
              />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-slate-800">{label}</span>
                {fromRole && (
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-400">
                    From role
                  </span>
                )}
                {fromExtra && !fromRole && (
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-[#004080]">
                    Only this user
                  </span>
                )}
                {restrictedSet.has(key) && !fromRole && (
                  <span className="block text-[10px] font-medium text-amber-700">Super Admin only</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
