import { forwardRef, useMemo, useState, type ComponentPropsWithoutRef } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/api";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "./command";

/** Above this many accounts the switcher becomes a filterable list. */
const FILTER_THRESHOLD = 8;

function initialOf(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

/** Square tile with the account's initial. */
function WorkspaceMark({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary-muted text-xs font-semibold text-primary-muted-foreground",
        className,
      )}
    >
      {initialOf(name)}
    </span>
  );
}

type OrgGroup = { key: string; label: string | null; accounts: Account[] };

/** Accounts grouped by organization (one unlabeled group when they all share one). */
function groupByOrganization(accounts: Account[]): OrgGroup[] {
  const groups = new Map<string, OrgGroup>();
  for (const account of accounts) {
    const key = String(account.organization_id);
    const label = account.organization_name ?? `Organization #${account.organization_id}`;
    if (!groups.has(key)) groups.set(key, { key, label, accounts: [] });
    groups.get(key)!.accounts.push(account);
  }
  const list = [...groups.values()];
  if (list.length === 1) list[0].label = null;
  return list;
}

function isInactive(account: Account): boolean {
  return Boolean(account.status) && account.status.toUpperCase() !== "ACTIVE";
}

type TriggerProps = ComponentPropsWithoutRef<"button"> & {
  account: Account;
  secondary: string;
  collapsed: boolean;
};

/** The button showing the current workspace (expanded: name + secondary line; collapsed: tile). */
const SwitcherTrigger = forwardRef<HTMLButtonElement, TriggerProps>(
  ({ account, secondary, collapsed, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-label={`Workspace: ${account.name}. Switch workspace`}
      className={cn(
        "group flex items-center rounded-md text-left transition-colors",
        "hover:bg-sidebar-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=open]:bg-sidebar-hover",
        collapsed
          ? "h-9 w-9 justify-center"
          : "w-full gap-2.5 border border-sidebar-border px-2 py-1.5",
        className,
      )}
      {...props}
    >
      <WorkspaceMark name={account.name} />
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1">
            <span dir="auto" className="block truncate text-ui font-medium text-foreground">
              {account.name}
            </span>
            <span dir="auto" className="block truncate text-xs leading-4 text-sidebar-muted">
              {secondary}
            </span>
          </span>
          <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-sidebar-muted" />
        </>
      )}
    </button>
  ),
);
SwitcherTrigger.displayName = "SwitcherTrigger";

type AccountSwitcherProps = {
  /** Icon-rail mode: a compact tile with a tooltip. */
  collapsed?: boolean;
};

/**
 * Sidebar workspace (account) switcher bound to WorkspaceContext.
 * 0 accounts → nothing; 1 → static text; ≤ 8 → menu; more → filterable list.
 */
export function AccountSwitcher({ collapsed = false }: AccountSwitcherProps) {
  const { accounts, account, accountId, setAccountId, isLoading } = useWorkspace();
  const [filterOpen, setFilterOpen] = useState(false);
  const groups = useMemo(() => groupByOrganization(accounts), [accounts]);

  if (isLoading) {
    return collapsed ? (
      <Skeleton className="mx-auto h-7 w-7" />
    ) : (
      <div className="flex items-center gap-2.5 rounded-md border border-sidebar-border px-2 py-1.5">
        <Skeleton className="h-7 w-7" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
    );
  }
  if (!account || accounts.length === 0) return null;

  const multiOrg = groups.length > 1;
  const secondary = multiOrg ? (account.organization_name ?? "Workspace") : "Workspace";
  const tooltip = `Workspace: ${account.name}`;

  // One account: nothing to switch to.
  if (accounts.length === 1) {
    if (collapsed) {
      return (
        <Tooltip content={tooltip} side="right">
          <span role="img" aria-label={tooltip} className="mx-auto flex h-9 w-9 items-center justify-center">
            <WorkspaceMark name={account.name} />
          </span>
        </Tooltip>
      );
    }
    return (
      <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
        <WorkspaceMark name={account.name} />
        <div className="min-w-0 flex-1">
          <p dir="auto" className="truncate text-ui font-medium text-foreground">
            {account.name}
          </p>
          <p dir="auto" className="truncate text-xs leading-4 text-sidebar-muted">
            {secondary}
          </p>
        </div>
      </div>
    );
  }

  const side = collapsed ? "right" : "bottom";
  const trigger = <SwitcherTrigger account={account} secondary={secondary} collapsed={collapsed} />;

  if (accounts.length > FILTER_THRESHOLD) {
    return (
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <Tooltip content={collapsed ? tooltip : null} side="right">
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        </Tooltip>
        <PopoverContent side={side} align="start" sideOffset={collapsed ? 10 : 6} className="w-72 p-0">
          <Command label="Switch workspace" loop>
            <CommandInput placeholder="Filter workspaces…" aria-label="Filter workspaces" />
            <CommandList className="max-h-80">
              <CommandEmpty className="py-6">No workspace matches.</CommandEmpty>
              {groups.map((group) => (
                <CommandGroup key={group.key} heading={group.label ?? undefined} value={`org-${group.key}`}>
                  {group.accounts.map((a) => (
                    <CommandItem
                      key={a.id}
                      value={`account-${a.id}`}
                      keywords={[a.name, group.label ?? "", a.organization_code ?? ""]}
                      onSelect={() => {
                        setAccountId(a.id);
                        setFilterOpen(false);
                      }}
                    >
                      <WorkspaceMark name={a.name} className="h-6 w-6" />
                      <span dir="auto" className="min-w-0 flex-1 truncate">
                        {a.name}
                      </span>
                      {isInactive(a) && <span className="text-xs text-muted-foreground">Inactive</span>}
                      {a.id === accountId && <Check aria-label="Current" className="h-4 w-4 text-primary" />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <DropdownMenu>
      <Tooltip content={collapsed ? tooltip : null} side="right">
        <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent side={side} align="start" sideOffset={collapsed ? 10 : 4} className="w-64">
        <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={accountId != null ? String(accountId) : ""} onValueChange={(v) => setAccountId(Number(v))}>
          {groups.map((group, index) => (
            <DropdownMenuGroup key={group.key}>
              {group.label && (
                <DropdownMenuLabel className={cn("pb-1 pt-2", index === 0 && "pt-1")}>
                  <span dir="auto">{group.label}</span>
                </DropdownMenuLabel>
              )}
              {group.accounts.map((a) => (
                <DropdownMenuRadioItem key={a.id} value={String(a.id)}>
                  <span dir="auto" className="min-w-0 flex-1 truncate">
                    {a.name}
                  </span>
                  {isInactive(a) && <span className="text-xs text-muted-foreground">Inactive</span>}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuGroup>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
