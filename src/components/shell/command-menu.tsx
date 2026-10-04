import { useMemo, useState, type ComponentType, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Briefcase,
  Building2,
  Cpu,
  FilePlus2,
  FileUp,
  LogOut,
  Megaphone,
  Moon,
  Sun,
  TicketPlus,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useOrganizations } from "@/hooks/useOrganizations";
import { useUsers } from "@/hooks/useUsers";
import { ROLES, canAccessPermission, navGroupLabel, type NavPermissionKey } from "@/lib/roles";
import { Avatar } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Spinner } from "@/components/ui/spinner";
import { useNavSections } from "./app-sidebar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, matchScore } from "./command";
import { navIcon } from "./nav-icons";
import { userDisplayName } from "./user-menu";

/*
 * Ctrl/⌘ + K command palette.
 *
 * Deep links it emits (page agents honour them):
 *   /users?action=create  /accounts?action=create  /organizations?action=create  /tickets?action=create
 *   /account-updates?action=create  /prompts?action=create  /llm-configs?action=create
 *   /users?q=<email>  /accounts?q=<name>  /organizations?q=<name>
 *
 * Entity search uses data the pages already load (no backend search endpoint exists); add a
 * source to ENTITY_SOURCES to search more entity types (tickets, documents, …).
 */

/** Max results per entity group. */
const ENTITY_LIMIT = 6;
/** Workspaces listed before the user types (all of them match once they do). */
const IDLE_WORKSPACE_LIMIT = 5;

type Run = (action: () => void) => void;

type ActionDef = {
  id: string;
  label: string;
  icon: LucideIcon;
  to: string;
  permission: NavPermissionKey;
  keywords: string[];
};

const CREATE_ACTIONS: ActionDef[] = [
  { id: "create-user", label: "Create user", icon: UserPlus, to: "/users?action=create", permission: "users", keywords: ["add user", "new user", "invite"] },
  { id: "create-account", label: "Create account", icon: Briefcase, to: "/accounts?action=create", permission: "accounts", keywords: ["add account", "new account", "brand", "client"] },
  { id: "create-organization", label: "Create organization", icon: Building2, to: "/organizations?action=create", permission: "organizations", keywords: ["add organization", "new organization", "tenant"] },
  { id: "create-ticket", label: "Create ticket", icon: TicketPlus, to: "/tickets?action=create", permission: "tickets", keywords: ["new ticket", "report issue", "support"] },
  { id: "publish-update", label: "Publish update", icon: Megaphone, to: "/account-updates?action=create", permission: "account-updates", keywords: ["new update", "announcement", "post"] },
  { id: "new-prompt", label: "New prompt", icon: FilePlus2, to: "/prompts?action=create", permission: "prompts", keywords: ["create prompt", "add prompt", "system prompt"] },
  { id: "new-llm-config", label: "New LLM config", icon: Cpu, to: "/llm-configs?action=create", permission: "llm-configs", keywords: ["create llm configuration", "add model", "provider"] },
  { id: "import-document", label: "Import document", icon: FileUp, to: "/document-import", permission: "document-import", keywords: ["upload document", "pdf", "word", "knowledge base"] },
];

/** Shared row layout: leading icon/visual, title + optional secondary text, trailing hint. */
function ItemRow({
  icon: Icon,
  visual,
  title,
  detail,
  hint,
}: {
  icon?: LucideIcon;
  visual?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <>
      {visual ?? (Icon ? <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" /> : null)}
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span className="shrink-0 font-medium">{title}</span>
        {detail && <span className="min-w-0 truncate text-ui text-muted-foreground">{detail}</span>}
      </span>
      {hint && <span className="shrink-0 text-xs text-muted-foreground">{hint}</span>}
    </>
  );
}

// ---------------------------------------------------------------------------------------------
// Entity sources (real data only; mounted while the palette is open and the query is non-empty).
// ---------------------------------------------------------------------------------------------

type EntityResultsProps = { search: string; run: Run; go: (to: string) => void };

type EntitySource = {
  key: string;
  /** Only searched when the user can open this page (results deep-link into it). */
  permission: NavPermissionKey;
  Results: ComponentType<EntityResultsProps>;
};

function rank<T>(items: T[], search: string, text: (item: T) => string): T[] {
  return items
    .map((item) => ({ item, score: matchScore(text(item), search) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, ENTITY_LIMIT)
    .map((entry) => entry.item);
}

function EntityLoading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <Spinner size="sm" label={label} showLabel className="[&>span]:text-xs" />
    </div>
  );
}

function UserResults({ search, go }: EntityResultsProps) {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN) ?? false;
  // Same scoping as UsersPage, so the React Query cache is shared.
  const { data, isLoading } = useUsers(isSuperAdmin ? null : user?.organization_id);
  const matches = useMemo(
    () => rank(data ?? [], search, (u) => `${userDisplayName(u)} ${u.email}`),
    [data, search],
  );
  if (isLoading) return <EntityLoading label="Searching users" />;
  if (matches.length === 0) return null;
  return (
    <CommandGroup heading="Users">
      {matches.map((u) => {
        const name = userDisplayName(u);
        return (
          <CommandItem
            key={u.id}
            value={`user-${u.id}`}
            keywords={[name, u.email]}
            onSelect={() => go(`/users?q=${encodeURIComponent(u.email)}`)}
          >
            <ItemRow
              visual={<Avatar name={name} size="sm" className="h-6 w-6" />}
              title={<span dir="auto">{name}</span>}
              detail={name !== u.email ? u.email : undefined}
              hint={u.organization_name ?? undefined}
            />
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}

function AccountResults({ search, go }: EntityResultsProps) {
  const { accounts } = useWorkspace();
  const matches = useMemo(
    () => rank(accounts, search, (a) => `${a.name} ${a.organization_name ?? ""} ${a.organization_code ?? ""}`),
    [accounts, search],
  );
  if (matches.length === 0) return null;
  return (
    <CommandGroup heading="Accounts">
      {matches.map((a) => (
        <CommandItem
          key={a.id}
          value={`account-${a.id}`}
          keywords={[a.name, a.organization_name ?? "", a.organization_code ?? ""]}
          onSelect={() => go(`/accounts?q=${encodeURIComponent(a.name)}`)}
        >
          <ItemRow icon={Briefcase} title={<span dir="auto">{a.name}</span>} hint={a.organization_name ?? undefined} />
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

function OrganizationResults({ search, go }: EntityResultsProps) {
  const { data, isLoading } = useOrganizations();
  const matches = useMemo(() => rank(data ?? [], search, (o) => `${o.name} ${o.code}`), [data, search]);
  if (isLoading) return <EntityLoading label="Searching organizations" />;
  if (matches.length === 0) return null;
  return (
    <CommandGroup heading="Organizations">
      {matches.map((o) => (
        <CommandItem
          key={o.id}
          value={`organization-${o.id}`}
          keywords={[o.name, o.code]}
          onSelect={() => go(`/organizations?q=${encodeURIComponent(o.name)}`)}
        >
          <ItemRow icon={Building2} title={<span dir="auto">{o.name}</span>} detail={o.code} />
        </CommandItem>
      ))}
    </CommandGroup>
  );
}

const ENTITY_SOURCES: EntitySource[] = [
  { key: "users", permission: "users", Results: UserResults },
  { key: "accounts", permission: "accounts", Results: AccountResults },
  { key: "organizations", permission: "organizations", Results: OrganizationResults },
];

// ---------------------------------------------------------------------------------------------

type CommandMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where focus goes on close (Radix only restores focus to its own Trigger). */
  onCloseAutoFocus?: (event: Event) => void;
};

export function CommandMenu({ open, onOpenChange, onCloseAutoFocus }: CommandMenuProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideClose
        className="max-w-[640px] overflow-hidden p-0"
        overlayClassName="items-start pt-[12vh]"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogTitle className="sr-only">Command menu</DialogTitle>
        {/* Mounted only while open, so the query resets every time the palette opens. */}
        {open && <CommandMenuBody close={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function CommandMenuBody({ close }: { close: () => void }) {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { accounts, accountId, setAccountId } = useWorkspace();
  const sections = useNavSections();
  const query = search.trim();

  const run: Run = (action) => {
    close();
    action();
  };
  const go = (to: string) => run(() => navigate(to));

  const actions = user ? CREATE_ACTIONS.filter((a) => canAccessPermission(user, a.permission)) : [];
  const otherAccounts = accounts.filter((a) => a.id !== accountId);
  const workspaceItems = query ? otherAccounts : otherAccounts.slice(0, IDLE_WORKSPACE_LIMIT);
  const multiOrg = new Set(accounts.map((a) => a.organization_id)).size > 1;
  const sources = query && user ? ENTITY_SOURCES.filter((s) => canAccessPermission(user, s.permission)) : [];
  const ThemeIcon = theme === "dark" ? Sun : Moon;

  return (
    <Command label="Command menu" loop className="max-h-[min(560px,76vh)]">
      <CommandInput
        value={search}
        onValueChange={setSearch}
        placeholder="Search pages, actions, people…"
        aria-label="Search pages, actions and people"
      />
      <CommandList className="min-h-0 flex-1">
        <CommandEmpty>
          No results for “<span dir="auto">{query}</span>”.
        </CommandEmpty>

        <CommandGroup heading="Pages">
          {sections.flatMap(({ group, items }) =>
            items.map((item) => (
              <CommandItem
                key={item.path}
                value={`page:${item.path}`}
                keywords={[item.label, navGroupLabel(group.key), item.description ?? "", ...(item.keywords ?? [])]}
                onSelect={() => go(item.path)}
              >
                <ItemRow icon={navIcon(item.icon)} title={item.label} detail={item.description} hint={group.label} />
              </CommandItem>
            )),
          )}
        </CommandGroup>

        <CommandGroup heading="Actions">
          {actions.map((action) => (
            <CommandItem
              key={action.id}
              value={`action:${action.id}`}
              keywords={[action.label, ...action.keywords]}
              onSelect={() => go(action.to)}
            >
              <ItemRow icon={action.icon} title={action.label} />
            </CommandItem>
          ))}
          <CommandItem
            value="action:toggle-theme"
            keywords={[
              theme === "dark" ? "Switch to light theme" : "Switch to dark theme",
              "toggle theme",
              "dark mode",
              "light mode",
              "appearance",
            ]}
            onSelect={() => run(toggleTheme)}
          >
            <ItemRow icon={ThemeIcon} title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"} />
          </CommandItem>
          <CommandItem
            value="action:sign-out"
            keywords={["Sign out", "log out", "logout"]}
            onSelect={() => run(() => void logout())}
          >
            <ItemRow icon={LogOut} title="Sign out" />
          </CommandItem>
        </CommandGroup>

        {workspaceItems.length > 0 && (
          <CommandGroup heading="Workspace">
            {workspaceItems.map((a) => (
              <CommandItem
                key={a.id}
                value={`workspace:${a.id}`}
                keywords={[`Switch workspace to ${a.name}`, a.organization_name ?? "", "account"]}
                onSelect={() => run(() => setAccountId(a.id))}
              >
                <ItemRow
                  icon={Briefcase}
                  title={
                    <>
                      Switch workspace to <span dir="auto">{a.name}</span>
                    </>
                  }
                  hint={multiOrg ? (a.organization_name ?? undefined) : undefined}
                />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {sources.map(({ key, Results }) => (
          <Results key={key} search={query} run={run} go={go} />
        ))}
      </CommandList>

      <div className="flex shrink-0 items-center gap-4 border-t border-border px-3 py-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span className="ml-0.5">to navigate</span>
        </span>
        <span className="flex items-center gap-1">
          <Kbd>Enter</Kbd>
          <span className="ml-0.5">to open</span>
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Kbd>Esc</Kbd>
          <span className="ml-0.5">to close</span>
        </span>
      </div>
    </Command>
  );
}
