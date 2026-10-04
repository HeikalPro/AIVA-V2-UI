import { useEffect, useId, useMemo, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useAuth } from "@/contexts/AuthContext";
import { useIngestionPendingCount } from "@/hooks/useIngestion";
import { useTicketOpenCount } from "@/hooks/useTickets";
import {
  NAV_GROUPS,
  NAV_ITEMS,
  ROLES,
  canAccessNav,
  findNavItemForPath,
  getHomePath,
  type NavGroup,
  type NavItem,
} from "@/lib/roles";
import { cn } from "@/lib/utils";
import { IconButton } from "@/components/ui/icon-button";
import { Tooltip } from "@/components/ui/tooltip";
import { AccountSwitcher } from "./account-switcher";
import { navIcon } from "./nav-icons";

export const SIDEBAR_WIDTH_EXPANDED = "w-60"; // 240px
export const SIDEBAR_WIDTH_COLLAPSED = "w-[68px]";

type NavBadge = { count: number; label: string };

/** Count badges (Super Admin only, as before): open tickets and pending ingestion requests. */
function useNavBadges(): Partial<Record<string, NavBadge>> {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN) ?? false;
  const { data: tickets } = useTicketOpenCount(isSuperAdmin);
  const { data: ingestion } = useIngestionPendingCount(isSuperAdmin);
  return useMemo(() => {
    if (!isSuperAdmin) return {};
    const badges: Partial<Record<string, NavBadge>> = {};
    const open = tickets?.open_count ?? 0;
    const pending = ingestion?.pending_count ?? 0;
    if (open > 0) badges["/tickets"] = { count: open, label: `${open} open` };
    if (pending > 0) badges["/ingestion"] = { count: pending, label: `${pending} pending` };
    return badges;
  }, [isSuperAdmin, tickets?.open_count, ingestion?.pending_count]);
}

type Section = { group: NavGroup; items: NavItem[] };

/** Groups with at least one page the user may open, in sidebar order. */
export function useNavSections(): Section[] {
  const { user } = useAuth();
  return useMemo(() => {
    if (!user) return [];
    return NAV_GROUPS.map((group) => ({
      group,
      items: NAV_ITEMS.filter((item) => item.group === group.key && canAccessNav(user, item)),
    })).filter((section) => section.items.length > 0);
  }, [user]);
}

/** The GoChat247 mark on a light tile so it stays legible in dark mode. */
function BrandMark() {
  return (
    <span className="theme-light inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-surface">
      <img src="/GoChat247_blue_transparent.png" alt="" className="h-7 w-7 object-contain" />
    </span>
  );
}

function SidebarNavItem({
  item,
  active,
  collapsed,
  badge,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
  badge?: NavBadge;
  onNavigate?: () => void;
}) {
  const Icon = navIcon(item.icon);
  // Plain <Link> with a string className: NavLink's function className/children do not survive
  // the Tooltip's Slot (it stringifies functions) in the collapsed rail.
  const link = (
    <Link
      to={item.path}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? (badge ? `${item.label}, ${badge.label}` : item.label) : undefined}
      className={cn(
        "group relative flex items-center rounded-md text-ui font-medium text-sidebar-foreground transition-colors",
        "hover:bg-sidebar-hover hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        collapsed ? "mx-auto h-9 w-9 justify-center" : "h-8 w-full gap-2.5 px-2.5",
        active &&
          "bg-sidebar-active text-sidebar-active-foreground hover:bg-sidebar-active hover:text-sidebar-active-foreground",
        // Active indicator: a short bar on the inner left edge.
        active &&
          "before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-r-full before:bg-primary",
      )}
    >
      <span className="relative inline-flex shrink-0">
        <Icon
          aria-hidden="true"
          className={cn(
            "h-4 w-4",
            active ? "text-sidebar-active-foreground" : "text-sidebar-muted group-hover:text-foreground",
          )}
        />
        {collapsed && badge && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar"
          />
        )}
      </span>
      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          {badge && (
            <span
              className={cn(
                "inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-medium tabular-nums",
                active ? "bg-primary text-primary-foreground" : "bg-neutral-muted text-neutral",
              )}
            >
              <span aria-hidden="true">{badge.count > 99 ? "99+" : badge.count}</span>
              <span className="sr-only">, {badge.label}</span>
            </span>
          )}
        </>
      )}
    </Link>
  );
  if (!collapsed) return link;
  return (
    <Tooltip content={badge ? `${item.label} · ${badge.label}` : item.label} side="right">
      {link}
    </Tooltip>
  );
}

type SidebarPanelProps = {
  collapsed: boolean;
  /** Called after a nav link is followed (closes the mobile drawer). */
  onNavigate?: () => void;
  /** Mobile drawer: shows a close button next to the brand. */
  onClose?: () => void;
};

/**
 * Brand, workspace switcher and grouped navigation (shared by the rail and the drawer).
 * The collapse toggle lives only in the topbar (spec §14) — one control, one place.
 */
function SidebarPanel({ collapsed, onNavigate, onClose }: SidebarPanelProps) {
  const { user } = useAuth();
  const sections = useNavSections();
  const badges = useNavBadges();
  const home = user ? getHomePath(user) : "/";
  const idPrefix = useId();
  const navRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const activePath = findNavItemForPath(pathname)?.path;

  // Keep the active page visible when the nav list is taller than the viewport.
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) return;
    const navBox = nav.getBoundingClientRect();
    const box = active.getBoundingClientRect();
    if (box.top < navBox.top || box.bottom > navBox.bottom) {
      nav.scrollTop += box.top - navBox.top - (navBox.height - box.height) / 2;
    }
  }, [pathname, collapsed]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("flex h-14 shrink-0 items-center gap-2.5", collapsed ? "justify-center px-2" : "px-4")}>
        <Link
          to={home}
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="AIVA home"
        >
          <BrandMark />
          {!collapsed && <span className="text-base font-semibold tracking-tight text-foreground">AIVA</span>}
        </Link>
        {onClose && (
          <IconButton label="Close navigation" icon={X} size="sm" className="ml-auto" onClick={onClose} tooltip={false} />
        )}
      </div>

      <div className={cn("shrink-0 pb-2", collapsed ? "px-2" : "px-3")}>
        <AccountSwitcher collapsed={collapsed} />
      </div>

      <nav
        ref={navRef}
        aria-label="Main"
        className={cn(
          "min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-3 [scrollbar-width:thin]",
          collapsed ? "px-2" : "px-3",
        )}
      >
        {sections.map(({ group, items }, index) => {
          const headingId = `${idPrefix}-group-${group.key}`;
          return (
            <div key={group.key} role="group" aria-labelledby={collapsed ? undefined : headingId} aria-label={collapsed ? group.label : undefined}>
              {collapsed ? (
                index > 0 && <div aria-hidden="true" className="mx-2 my-2 h-px bg-sidebar-border" />
              ) : (
                <p
                  id={headingId}
                  className={cn(
                    "px-2.5 pb-1 text-xs font-medium uppercase tracking-wide text-sidebar-muted",
                    index === 0 ? "pt-2" : "pt-3",
                  )}
                >
                  {group.label}
                </p>
              )}
              <ul className={cn("space-y-0.5", collapsed && index === 0 && "pt-1")}>
                {items.map((item) => (
                  <li key={item.path}>
                    <SidebarNavItem
                      item={item}
                      active={item.path === activePath}
                      collapsed={collapsed}
                      badge={badges[item.path]}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </div>
  );
}

/** Desktop sidebar (≥ 1024px): 240px expanded, 68px icon rail when collapsed (toggled from the topbar). */
export function AppSidebar({ collapsed }: { collapsed: boolean }) {
  return (
    <aside
      aria-label="Sidebar"
      className={cn(
        "hidden h-full shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:block",
        collapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED,
      )}
    >
      <SidebarPanel collapsed={collapsed} />
    </aside>
  );
}

/** Off-canvas navigation drawer (< 1024px). Closes on navigation, Escape and overlay click. */
export function MobileSidebar({
  open,
  onOpenChange,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay/50 motion-safe:animate-overlay-in lg:hidden" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onCloseAutoFocus={onCloseAutoFocus}
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-lg",
            "focus:outline-none motion-safe:animate-overlay-in lg:hidden",
          )}
        >
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <SidebarPanel collapsed={false} onNavigate={() => onOpenChange(false)} onClose={() => onOpenChange(false)} />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
