import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity,
  Briefcase,
  Building2,
  Bell,
  Cpu,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Package,
  Shield,
  ThumbsUp,
  Ticket,
  Upload,
  ScrollText,
  UserCheck,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { NAV_ITEMS, ROLES, canAccessNav, displayRole } from "@/lib/roles";
import { useIngestionPendingCount } from "@/hooks/useIngestion";
import { useTicketOpenCount } from "@/hooks/useTickets";
import { Button } from "@/components/ui/button";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Building2,
  Briefcase,
  Users,
  FileText,
  Cpu,
  MessageSquare,
  Ticket,
  ThumbsUp,
  Upload,
  Bell,
  Shield,
  ScrollText,
  UserCheck,
  Activity,
  Package,
};

function NavItem({
  to,
  label,
  icon: Icon,
  isActive,
  collapsed,
  onNavigate,
  badgeCount,
}: {
  to: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
  badgeCount?: number;
}) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={`group relative flex w-full items-center ${collapsed ? "justify-center px-2" : "gap-3 px-3"} py-2.5 rounded-lg text-sm font-medium transition-all ${
        isActive ? "bg-primary/10 text-[#004080] font-semibold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-800"
      }`}
    >
      {isActive && !collapsed && (
        <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#004080]" />
      )}
      <span
        className={`relative flex h-8 w-8 items-center justify-center rounded-md transition-colors ${
          isActive ? "bg-[#004080] text-white shadow-sm" : "text-slate-500 group-hover:bg-slate-100 group-hover:text-slate-700"
        }`}
      >
        <Icon className="h-[18px] w-[18px] shrink-0" />
        {collapsed && badgeCount != null && badgeCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-0.5 text-[10px] font-semibold leading-none text-white">
            {badgeCount > 9 ? "9+" : badgeCount}
          </span>
        )}
      </span>
      {!collapsed && (
        <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span>{label}</span>
          {badgeCount != null && badgeCount > 0 && (
            <span className="shrink-0 rounded-full bg-red-600 px-2 py-0.5 text-[11px] font-semibold text-white tabular-nums">
              {badgeCount > 99 ? "99+" : badgeCount}
            </span>
          )}
        </span>
      )}
    </NavLink>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN) ?? false;
  const { data: ticketOpenBadge } = useTicketOpenCount(isSuperAdmin);
  const { data: ingestionPendingBadge } = useIngestionPendingCount(isSuperAdmin);
  const openTicketCount = ticketOpenBadge?.open_count ?? 0;
  const pendingIngestionCount = ingestionPendingBadge?.pending_count ?? 0;
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 1024);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 1024);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(true);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const navItems = NAV_ITEMS.filter((item) => user && canAccessNav(user, item));
  const displayName =
    user?.first_name || user?.last_name
      ? [user.first_name, user.last_name].filter(Boolean).join(" ")
      : user?.email ?? "User";

  const currentPage = navItems.find((item) =>
    item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path),
  );

  return (
    <div className="flex h-dvh min-h-screen w-full overflow-hidden bg-background">
      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-slate-100 bg-white shadow-[1px_0_8px_rgba(0,0,0,0.04)] transition-all duration-300 ${
          isMobile
            ? `w-full ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`
            : `translate-x-0 ${sidebarOpen ? "w-64" : "w-16"}`
        }`}
      >
        <div className={`flex h-16 shrink-0 items-center gap-3 ${sidebarOpen ? "px-5" : "justify-center"}`}>
          <Link to="/" className="shrink-0">
            <img src="/GoChat247_blue_transparent.png" alt="GoChat247" className="h-9 w-9 object-contain" />
          </Link>
          {sidebarOpen && <span className="truncate text-[15px] font-bold tracking-tight text-slate-800">AIVA</span>}
          {isMobile && sidebarOpen && (
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close menu"
              className="ml-auto shrink-0 rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {sidebarOpen && (
          <div className="mx-4 mb-1">
            <div className="border-b border-slate-100" />
          </div>
        )}

        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {sidebarOpen && (
            <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Menu</p>
          )}
          {navItems.map(({ path, label, icon }) => {
            const Icon = ICONS[icon] ?? LayoutDashboard;
            const active = path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);
            const navBadge =
              path === "/tickets" && isSuperAdmin
                ? openTicketCount
                : path === "/ingestion" && isSuperAdmin
                  ? pendingIngestionCount
                  : undefined;
            return (
              <NavItem
                key={path}
                to={path}
                label={label}
                icon={Icon}
                isActive={active}
                collapsed={!sidebarOpen}
                badgeCount={navBadge}
                onNavigate={() => isMobile && setSidebarOpen(false)}
              />
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-slate-100 p-3">
          {sidebarOpen ? (
            <div className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#004080] text-xs font-bold uppercase text-white">
                {displayName.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-700">{displayName}</p>
                <p className="text-[11px] font-medium text-slate-400">{user ? displayRole(user.roles) : ""}</p>
              </div>
              <button type="button" onClick={() => logout()} className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-red-500" title="Logout">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => logout()} className="mx-auto block rounded-md p-1.5 text-slate-400 hover:bg-slate-50 hover:text-red-500" title="Logout">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </aside>

      <div className={`flex min-h-0 min-w-0 flex-1 flex-col transition-all duration-300 ${sidebarOpen ? "lg:ml-64" : "lg:ml-16"} ${isMobile ? "ml-0" : ""}`}>
        <header className={`fixed top-0 z-40 flex h-16 items-center border-b border-border bg-background px-4 lg:px-6 right-0 ${sidebarOpen ? "lg:left-64" : "lg:left-16"} left-0`}>
          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Toggle sidebar">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="ml-3 min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-800">{currentPage?.label ?? "AIVA"}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden pt-16">
          <div className="min-h-full w-full p-4 sm:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
