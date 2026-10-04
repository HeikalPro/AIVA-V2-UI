export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ORG_ADMIN: "ORGANIZATION_ADMIN",
  ACCOUNT_MANAGER: "ACCOUNT_MANAGER",
  SUPERVISOR: "SUPERVISOR",
  AGENT: "AGENT",
  DEVELOPER: "DEVELOPER",
} as const;

export type NavPermissionKey =
  | "dashboard"
  | "organizations"
  | "accounts"
  | "widget-customization"
  | "users"
  | "agents"
  | "roles"
  | "prompts"
  | "llm-configs"
  | "message-ratings"
  | "account-updates"
  | "chat"
  | "tickets"
  | "ingestion"
  | "logs"
  | "system"
  | "document-import"
  | "sharepoint-sync"
  | "monitoring";

/** Sidebar sections, in display order (see NAV_GROUPS). */
export type NavGroupKey = "overview" | "operations" | "knowledge" | "ai" | "administration" | "system";

export type NavGroup = {
  key: NavGroupKey;
  /** Sentence-case label ("Operations"); the sidebar may render it uppercase. */
  label: string;
};

/** Sidebar / command-palette sections in display order. */
export const NAV_GROUPS: readonly NavGroup[] = [
  { key: "overview", label: "Overview" },
  { key: "operations", label: "Operations" },
  { key: "knowledge", label: "Knowledge" },
  { key: "ai", label: "AI" },
  { key: "administration", label: "Administration" },
  { key: "system", label: "System" },
];

export type NavItem = {
  path: string;
  label: string;
  icon: string;
  permission: NavPermissionKey;
  /** Legacy role list — used when API permissions are unavailable. */
  roles: string[];
  /**
   * Role-locked page: only these roles (Super Admin always passes) can open it, and page
   * permissions from the API never grant it. Locked pages are left out of the role defaults
   * and the page-access editors, so they cannot be granted to anyone.
   */
  lockedRoles?: string[];
  /** Sidebar section. */
  group: NavGroupKey;
  /** The page works on the shell's selected workspace (account); the breadcrumb shows it. */
  accountScoped?: boolean;
  /** One line, shown in the command palette. */
  description?: string;
  /** Extra command-palette search terms. */
  keywords?: string[];
};

/** Ordered by NAV_GROUPS, then by position inside the group. */
export const NAV_ITEMS: NavItem[] = [
  // Overview
  {
    path: "/",
    label: "Dashboard",
    icon: "LayoutDashboard",
    permission: "dashboard",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR, ROLES.DEVELOPER],
    group: "overview",
    accountScoped: true,
    description: "Usage, answer quality, latency and cost",
    keywords: ["home", "overview", "analytics", "kpi", "usage", "cost"],
  },
  // Operations
  {
    path: "/agents",
    label: "Agents & Trainees",
    icon: "UserCheck",
    permission: "agents",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR],
    group: "operations",
    accountScoped: true,
    description: "Agents, trainees and their queue access",
    keywords: ["agent", "trainee", "queues", "team"],
  },
  {
    path: "/account-updates",
    label: "Updates",
    icon: "Bell",
    permission: "account-updates",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR],
    group: "operations",
    description: "Announcements shown to agents in the widget",
    keywords: ["announcements", "news", "broadcast", "account updates"],
  },
  {
    path: "/tickets",
    label: "Tickets",
    icon: "Ticket",
    permission: "tickets",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR, ROLES.DEVELOPER],
    group: "operations",
    description: "Support tickets and their status",
    keywords: ["issues", "support", "bugs", "requests"],
  },
  {
    path: "/chat",
    label: "Chat",
    icon: "MessageSquare",
    permission: "chat",
    roles: [ROLES.AGENT, ROLES.SUPERVISOR],
    group: "operations",
    accountScoped: true,
    description: "Chat with the AI assistant",
    keywords: ["assistant", "conversation", "ask", "sessions"],
  },
  // Knowledge
  {
    path: "/ingestion",
    label: "Ingestion",
    icon: "Upload",
    permission: "ingestion",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR, ROLES.DEVELOPER],
    group: "knowledge",
    description: "Knowledge-base ingestion requests and jobs",
    keywords: ["knowledge base", "kb", "upload", "requests", "jobs"],
  },
  {
    path: "/document-import",
    label: "Document Import",
    icon: "FileUp",
    permission: "document-import",
    roles: [ROLES.SUPER_ADMIN],
    lockedRoles: [ROLES.SUPER_ADMIN],
    group: "knowledge",
    description: "Upload PDF and Word documents to a knowledge base",
    keywords: ["documents", "files", "pdf", "upload", "kb"],
  },
  {
    path: "/sharepoint-sync",
    label: "SharePoint Sync",
    icon: "FolderSync",
    permission: "sharepoint-sync",
    roles: [ROLES.SUPER_ADMIN],
    lockedRoles: [ROLES.SUPER_ADMIN],
    group: "knowledge",
    description: "Sync SharePoint and OneDrive folders on a schedule",
    keywords: ["sharepoint", "sources", "sync", "microsoft"],
  },
  // AI
  {
    path: "/prompts",
    label: "Prompts",
    icon: "FileText",
    permission: "prompts",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.DEVELOPER],
    group: "ai",
    accountScoped: true,
    description: "Built-in system prompt and custom prompts per account",
    keywords: ["system prompt", "instructions"],
  },
  {
    path: "/llm-configs",
    label: "LLM Configs",
    icon: "Cpu",
    permission: "llm-configs",
    roles: [ROLES.SUPER_ADMIN, ROLES.DEVELOPER],
    group: "ai",
    description: "LLM provider configurations",
    keywords: ["llm configurations", "models", "provider"],
  },
  {
    path: "/message-ratings",
    label: "Message Feedback",
    icon: "ThumbsUp",
    permission: "message-ratings",
    roles: [ROLES.SUPER_ADMIN],
    group: "ai",
    description: "Thumbs up/down ratings from the widget",
    keywords: ["ratings", "thumbs", "feedback", "quality"],
  },
  {
    path: "/widget-customization",
    label: "Widget Configuration",
    icon: "SlidersHorizontal",
    permission: "widget-customization",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.DEVELOPER],
    group: "ai",
    accountScoped: true,
    description: "Widget features and their values per account",
    keywords: ["widget customization", "branding", "calculator", "locations", "queues"],
  },
  // Administration
  {
    path: "/organizations",
    label: "Organizations",
    icon: "Building2",
    permission: "organizations",
    roles: [ROLES.SUPER_ADMIN],
    group: "administration",
    description: "Tenant organizations",
    keywords: ["tenants", "orgs", "companies"],
  },
  {
    path: "/accounts",
    label: "Accounts",
    icon: "Briefcase",
    permission: "accounts",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER],
    group: "administration",
    description: "Client brands, their knowledge base and model",
    keywords: ["brands", "clients", "workspaces"],
  },
  {
    path: "/users",
    label: "Users",
    icon: "Users",
    permission: "users",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER],
    group: "administration",
    description: "People, roles and account assignments",
    keywords: ["people", "members", "staff", "accounts"],
  },
  {
    path: "/roles",
    label: "Roles & Access",
    icon: "Shield",
    permission: "roles",
    roles: [ROLES.SUPER_ADMIN],
    group: "administration",
    accountScoped: true,
    description: "Page access per role and account",
    keywords: ["permissions", "page access", "rbac"],
  },
  // System
  {
    path: "/logs",
    label: "Logs & Health",
    icon: "ScrollText",
    permission: "logs",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR, ROLES.DEVELOPER],
    group: "system",
    description: "Audit, API traffic, AI requests, errors and system health",
    keywords: ["system health", "audit", "errors", "api requests", "ai metrics", "rag", "sign-in"],
  },
  {
    path: "/monitoring",
    label: "Monitoring",
    icon: "Activity",
    permission: "monitoring",
    roles: [ROLES.SUPER_ADMIN, ROLES.DEVELOPER],
    lockedRoles: [ROLES.SUPER_ADMIN, ROLES.DEVELOPER],
    group: "system",
    description: "Document intelligence services, import failures and diagnostics",
    keywords: ["doc intel", "services", "failures", "diagnostics", "health"],
  },
];

/** Pages that role/user page permissions can grant: every nav item except the role-locked ones. */
const GRANTABLE_NAV_ITEMS = NAV_ITEMS.filter((item) => !item.lockedRoles);

/** The roles a locked page is restricted to, or undefined when the page is grantable. */
function lockedRolesFor(permission: NavPermissionKey): string[] | undefined {
  return NAV_ITEMS.find((item) => item.permission === permission && item.lockedRoles)?.lockedRoles;
}

export type AccessUser = {
  roles: string[];
  permissions?: string[];
};

export function getDefaultNavPermissionsForRole(roleName: string): NavPermissionKey[] {
  if (roleName === ROLES.SUPER_ADMIN) {
    return GRANTABLE_NAV_ITEMS.map((item) => item.permission);
  }
  return GRANTABLE_NAV_ITEMS.filter((item) => item.roles.includes(roleName)).map((item) => item.permission);
}

export function canAccess(roles: string[], required: string[]): boolean {
  if (required.length === 0) return true;
  if (roles.includes(ROLES.SUPER_ADMIN)) return true;
  return required.some((r) => roles.includes(r));
}

export function canAccessPermission(user: AccessUser, permission: NavPermissionKey): boolean {
  if (user.roles.includes(ROLES.SUPER_ADMIN)) return true;
  const lockedRoles = lockedRolesFor(permission);
  if (lockedRoles) {
    // Role check only; the API permissions list is ignored. An empty list locks the page to Super Admin.
    return lockedRoles.length > 0 && canAccess(user.roles, lockedRoles);
  }
  if (user.permissions && user.permissions.length > 0) {
    return user.permissions.includes(permission);
  }
  const item = NAV_ITEMS.find((n) => n.permission === permission);
  if (!item) return false;
  return canAccess(user.roles, item.roles);
}

export function canAccessNav(user: AccessUser, item: NavItem): boolean {
  return canAccessPermission(user, item.permission);
}

/** Nav items in sidebar order (NAV_GROUPS order, then item order inside each group). */
function navItemsInGroupOrder(): NavItem[] {
  return NAV_GROUPS.flatMap((group) => NAV_ITEMS.filter((item) => item.group === group.key));
}

/**
 * Where a user lands: the first page they can open, in sidebar order. Falls back to "/" when the
 * user can open nothing (ProtectedRoute then shows a "no access" state instead of redirecting).
 */
export function getHomePath(user: AccessUser): string {
  return navItemsInGroupOrder().find((item) => canAccessNav(user, item))?.path ?? "/";
}

/** The nav item that owns a pathname ("/users/12" → Users; "/" only matches exactly). */
export function findNavItemForPath(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) =>
    item.path === "/" ? pathname === "/" : pathname === item.path || pathname.startsWith(`${item.path}/`),
  );
}

/** The label of a nav group ("operations" → "Operations"). */
export function navGroupLabel(key: NavGroupKey): string {
  return NAV_GROUPS.find((group) => group.key === key)?.label ?? key;
}

export function displayRole(roles: string[]): string {
  if (roles.includes(ROLES.SUPER_ADMIN)) return "Super Admin";
  if (roles.includes(ROLES.ORG_ADMIN)) return "Org Admin";
  if (roles.includes(ROLES.ACCOUNT_MANAGER)) return "Account Manager";
  if (roles.includes(ROLES.SUPERVISOR)) return "Supervisor";
  if (roles.includes(ROLES.DEVELOPER)) return "Developer";
  if (roles.includes(ROLES.AGENT)) return "Agent";
  return roles[0] ?? "User";
}

export const NAV_PERMISSION_LABELS: Record<NavPermissionKey, string> = Object.fromEntries(
  GRANTABLE_NAV_ITEMS.map((item) => [item.permission, item.label]),
) as Record<NavPermissionKey, string>;
