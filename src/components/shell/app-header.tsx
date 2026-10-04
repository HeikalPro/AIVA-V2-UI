import { useRef, type MouseEvent } from "react";
import { useLocation } from "react-router-dom";
import { CircleHelp, Keyboard, Moon, Search, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useWorkspace } from "@/contexts/WorkspaceContext";
import { useAuth } from "@/contexts/AuthContext";
import { canAccessNav, findNavItemForPath, navGroupLabel } from "@/lib/roles";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { controlBase, controlSizes } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { commandMenuShortcutLabel } from "./keyboard";
import { UserMenu } from "./user-menu";

/** "Group / Page" (+ " / Account" on account-scoped pages). */
function Breadcrumb() {
  const location = useLocation();
  const { user } = useAuth();
  const { account } = useWorkspace();
  const match = findNavItemForPath(location.pathname);
  // Not while ProtectedRoute shows the "no pages" state for a page the user cannot open.
  const item = match && user && canAccessNav(user, match) ? match : undefined;
  if (!item) return <span className="text-sm font-medium text-foreground">AIVA</span>;

  const separator = (className?: string) => (
    <li aria-hidden="true" className={cn("shrink-0 text-subtle-foreground", className)}>
      /
    </li>
  );
  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="hidden shrink-0 text-muted-foreground md:block">{navGroupLabel(item.group)}</li>
        {separator("hidden md:block")}
        <li aria-current="page" className="min-w-0 truncate font-medium text-foreground">
          {item.label}
        </li>
        {item.accountScoped && account && (
          <>
            {separator()}
            <li className="min-w-0 truncate text-muted-foreground">
              <span dir="auto">{account.name}</span>
            </li>
          </>
        )}
      </ol>
    </nav>
  );
}

type AppHeaderProps = {
  sidebarToggle: {
    label: string;
    icon: LucideIcon;
    onClick: (event: MouseEvent<HTMLButtonElement>) => void;
    expanded?: boolean;
  };
  /** `from` = the element focus returns to when the overlay closes. */
  onOpenCommandMenu: (from?: HTMLElement | null) => void;
  onOpenShortcuts: (from?: HTMLElement | null) => void;
};

/** Compact topbar: sidebar toggle · breadcrumb · search · help · theme · user menu. */
export function AppHeader({ sidebarToggle, onOpenCommandMenu, onOpenShortcuts }: AppHeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const shortcut = commandMenuShortcutLabel();
  const helpRef = useRef<HTMLButtonElement>(null);

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 lg:px-4">
      <IconButton
        label={sidebarToggle.label}
        icon={sidebarToggle.icon}
        onClick={sidebarToggle.onClick}
        aria-expanded={sidebarToggle.expanded}
        tooltipSide="bottom"
      />
      <div className="ml-1 min-w-0 flex-1">
        <Breadcrumb />
      </div>

      <button
        type="button"
        onClick={(event) => onOpenCommandMenu(event.currentTarget)}
        aria-keyshortcuts="Control+K Meta+K"
        className={cn(
          controlBase,
          controlSizes.sm,
          "hidden w-56 cursor-pointer items-center gap-2 text-left text-muted-foreground md:flex xl:w-72",
        )}
      >
        <Search aria-hidden="true" className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate">Search…</span>
        <Kbd aria-hidden="true">{shortcut}</Kbd>
        <span className="sr-only">({shortcut})</span>
      </button>
      <IconButton
        label="Search"
        icon={Search}
        onClick={(event) => onOpenCommandMenu(event.currentTarget)}
        className="md:hidden"
        tooltipSide="bottom"
      />

      <div className="flex items-center gap-0.5">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <IconButton ref={helpRef} label="Help" icon={CircleHelp} tooltipSide="bottom" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem icon={Search} shortcut={shortcut} onSelect={() => onOpenCommandMenu(helpRef.current)}>
              Command menu
            </DropdownMenuItem>
            <DropdownMenuItem icon={Keyboard} shortcut="?" onSelect={() => onOpenShortcuts(helpRef.current)}>
              Keyboard shortcuts
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <IconButton
          label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          icon={theme === "dark" ? Sun : Moon}
          onClick={toggleTheme}
          tooltipSide="bottom"
        />
        <UserMenu />
      </div>
    </header>
  );
}
