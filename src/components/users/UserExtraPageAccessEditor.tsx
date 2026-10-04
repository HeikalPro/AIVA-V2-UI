import { NAV_PERMISSION_LABELS } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { PageAccessChecklist, resolvePageAccessEntries } from "./PageAccessGroups";

/** Every grantable page (NAV_PERMISSION_LABELS only holds the grantable, non-locked pages). */
const ENTRIES = resolvePageAccessEntries(Object.keys(NAV_PERMISSION_LABELS).map((key) => ({ key })));

type Props = {
  roleNavPermissions: string[];
  extraNavPermissions: string[];
  onExtraChange: (keys: string[]) => void;
  disabled?: boolean;
  restrictedKeys?: string[];
};

/**
 * Extra pages for one user on top of their role. Pages from the role are checked and locked;
 * restricted pages (Super Admin only) are locked for other editors.
 */
export function UserExtraPageAccessEditor({
  roleNavPermissions,
  extraNavPermissions,
  onExtraChange,
  disabled = false,
  restrictedKeys = [],
}: Props) {
  const roleSet = new Set(roleNavPermissions);
  const restrictedSet = new Set(restrictedKeys);
  const effective = new Set([...roleNavPermissions, ...extraNavPermissions]);

  function isLocked(key: string) {
    return disabled || roleSet.has(key) || restrictedSet.has(key);
  }

  function toggleExtra(key: string) {
    if (isLocked(key)) return;
    if (extraNavPermissions.includes(key)) {
      onExtraChange(extraNavPermissions.filter((k) => k !== key));
    } else {
      onExtraChange([...extraNavPermissions, key]);
    }
  }

  function toggleGroup(keys: string[], checked: boolean) {
    const editable = keys.filter((key) => !isLocked(key));
    if (checked) {
      onExtraChange([...extraNavPermissions, ...editable.filter((key) => !extraNavPermissions.includes(key))]);
    } else {
      onExtraChange(extraNavPermissions.filter((key) => !editable.includes(key)));
    }
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-ui font-medium text-foreground">Individual page access</p>
        <p className="text-xs text-muted-foreground">
          Extra pages for this user only, on top of their role. Pages that come from the role stay locked here.
        </p>
      </div>
      <PageAccessChecklist
        entries={ENTRIES}
        isChecked={(key) => effective.has(key)}
        isLocked={isLocked}
        onToggle={(key) => toggleExtra(key)}
        onToggleGroup={disabled ? undefined : toggleGroup}
        renderTag={(key) => {
          if (roleSet.has(key)) return <Badge variant="neutral">From role</Badge>;
          if (extraNavPermissions.includes(key)) return <Badge variant="primary">Only this user</Badge>;
          if (restrictedSet.has(key)) return <Badge variant="warning">Super Admin only</Badge>;
          return null;
        }}
      />
    </div>
  );
}
