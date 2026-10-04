import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { NAV_GROUPS, NAV_ITEMS, type NavGroupKey } from "@/lib/roles";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

/*
 * Page access presented the way the sidebar is organised: pages grouped by NAV_GROUPS, labelled
 * with the sidebar (NAV_ITEMS) names. Role-locked pages (Document Import, SharePoint Sync,
 * Monitoring) can never be granted, so they are left out, exactly like the editors always did.
 */

export type PageAccessEntry = {
  key: string;
  label: string;
  description?: string;
  group: NavGroupKey | "other";
};

export type PageAccessGroup = {
  key: NavGroupKey | "other";
  label: string;
  entries: PageAccessEntry[];
};

const ORDER = new Map(NAV_ITEMS.map((item, index) => [item.permission as string, index]));

/**
 * Display entries for page-permission keys. `label` (e.g. the backend catalog label) is only used
 * for keys the UI does not know; known keys use the sidebar label. Locked pages are dropped.
 */
export function resolvePageAccessEntries(items: { key: string; label?: string }[]): PageAccessEntry[] {
  const seen = new Set<string>();
  const out: PageAccessEntry[] = [];
  for (const item of items) {
    if (seen.has(item.key)) continue;
    seen.add(item.key);
    const nav = NAV_ITEMS.find((n) => n.permission === item.key);
    if (nav?.lockedRoles) continue;
    out.push({
      key: item.key,
      label: nav?.label ?? item.label ?? item.key,
      description: nav?.description,
      group: nav?.group ?? "other",
    });
  }
  return out.sort((a, b) => {
    const oa = ORDER.get(a.key) ?? Number.MAX_SAFE_INTEGER;
    const ob = ORDER.get(b.key) ?? Number.MAX_SAFE_INTEGER;
    return oa - ob || a.label.localeCompare(b.label);
  });
}

/** Entries grouped in sidebar order; unknown keys go to a trailing "Other" group. */
export function groupPageAccessEntries(entries: PageAccessEntry[]): PageAccessGroup[] {
  const groups: PageAccessGroup[] = NAV_GROUPS.map((g) => ({
    key: g.key,
    label: g.label,
    entries: entries.filter((e) => e.group === g.key),
  }));
  groups.push({ key: "other", label: "Other", entries: entries.filter((e) => e.group === "other") });
  return groups.filter((g) => g.entries.length > 0);
}

/* =============================================================================================
 * Read-only summary
 * ============================================================================================= */

type PageAccessSummaryProps = {
  /** Granted page keys. */
  keys: string[];
  emptyText?: string;
  className?: string;
};

/** Granted pages, one line per sidebar group: "OPERATIONS  Agents & Trainees · Tickets". */
export function PageAccessSummary({ keys, emptyText = "No pages assigned to this role.", className }: PageAccessSummaryProps) {
  const groups = groupPageAccessEntries(resolvePageAccessEntries(keys.map((key) => ({ key }))));
  if (groups.length === 0) {
    return <p className={cn("text-sm text-muted-foreground", className)}>{emptyText}</p>;
  }
  return (
    <dl className={cn("divide-y divide-border rounded-lg border border-border", className)}>
      {groups.map((group) => (
        <div key={group.key} className="grid gap-1.5 px-3 py-2 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-3">
          <dt className="pt-0.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.label}</dt>
          <dd className="flex flex-wrap gap-1">
            {group.entries.map((entry) => (
              <Badge key={entry.key} variant="neutral">
                {entry.label}
              </Badge>
            ))}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/* =============================================================================================
 * Editable checklist
 * ============================================================================================= */

type PageAccessChecklistProps = {
  entries: PageAccessEntry[];
  isChecked: (key: string) => boolean;
  /** Item cannot be changed (shown checked/unchecked as is, disabled). */
  isLocked?: (key: string) => boolean;
  onToggle: (key: string, checked: boolean) => void;
  /** Enables a "select all" checkbox per group (applies to the group's unlocked pages). */
  onToggleGroup?: (keys: string[], checked: boolean) => void;
  /** Small right-aligned note per item ("From role", "Only this user" …). */
  renderTag?: (key: string) => ReactNode;
  /** Group cards per row from the lg breakpoint (default 1). */
  columns?: 1 | 2;
  className?: string;
};

/** Checkbox list grouped like the sidebar, with optional group-level select all (indeterminate). */
export function PageAccessChecklist({
  entries,
  isChecked,
  isLocked = () => false,
  onToggle,
  onToggleGroup,
  renderTag,
  columns = 1,
  className,
}: PageAccessChecklistProps) {
  const baseId = useId();
  const groups = groupPageAccessEntries(entries);
  return (
    // Two columns use CSS columns so short and long groups pack without gaps (sidebar order runs
    // down the first column, then the second).
    <div className={cn(columns === 2 ? "gap-3 lg:columns-2 [&>section+section]:mt-3 lg:[&>section]:break-inside-avoid" : "space-y-3", className)}>
      {groups.map((group) => {
        const checkedCount = group.entries.filter((e) => isChecked(e.key)).length;
        const editable = group.entries.filter((e) => !isLocked(e.key));
        // Select-all reflects the pages it can change; a fully locked group mirrors its pages.
        const basis = editable.length > 0 ? editable : group.entries;
        const basisChecked = basis.filter((e) => isChecked(e.key)).length;
        const groupState: boolean | "indeterminate" =
          basisChecked === basis.length ? true : basisChecked > 0 ? "indeterminate" : false;
        const headingId = `${baseId}-${group.key}`;
        return (
          <section key={group.key} aria-labelledby={headingId} className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2.5 border-b border-border bg-surface-muted px-3 py-2">
              {onToggleGroup && (
                <Checkbox
                  aria-label={`All ${group.label} pages`}
                  checked={groupState}
                  disabled={editable.length === 0}
                  onCheckedChange={() =>
                    onToggleGroup(
                      editable.map((e) => e.key),
                      groupState !== true,
                    )
                  }
                />
              )}
              <h4 id={headingId} className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {group.label}
              </h4>
              <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                {formatNumber(checkedCount)} of {formatNumber(group.entries.length)}
              </span>
            </div>
            <ul className="divide-y divide-border">
              {group.entries.map((entry) => {
                const locked = isLocked(entry.key);
                const checked = isChecked(entry.key);
                const id = `${baseId}-${entry.key}`;
                const tag = renderTag?.(entry.key);
                return (
                  <li key={entry.key}>
                    <label
                      htmlFor={id}
                      className={cn(
                        "flex items-start gap-3 px-3 py-2.5 transition-colors",
                        locked ? "cursor-default" : "cursor-pointer hover:bg-muted/50",
                      )}
                    >
                      <Checkbox
                        id={id}
                        className="mt-0.5"
                        checked={checked}
                        disabled={locked}
                        onCheckedChange={(value) => onToggle(entry.key, value === true)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className={cn("block text-ui font-medium", locked && !checked ? "text-muted-foreground" : "text-foreground")}>
                          {entry.label}
                        </span>
                        {entry.description && (
                          <span className="block text-xs text-muted-foreground">{entry.description}</span>
                        )}
                      </span>
                      {tag != null && tag !== false && <span className="shrink-0 pt-px">{tag}</span>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
