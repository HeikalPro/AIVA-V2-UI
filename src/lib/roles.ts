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
};

export const NAV_ITEMS: NavItem[] = [
  {
    path: "/",
    label: "Dashboard",
    icon: "LayoutDashboard",
    permission: "dashboard",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR, ROLES.DEVELOPER],
  },
  {
    path: "/organizations",
    label: "Organizations",
    icon: "Building2",
    permission: "organizations",
    roles: [ROLES.SUPER_ADMIN],
  },
  {
    path: "/accounts",
    label: "Accounts",
    icon: "Briefcase",
    permission: "accounts",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER],
  },
  {
    path: "/widget-customization",
    label: "Widget customization",
    icon: "SlidersHorizontal",
    permission: "widget-customization",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.DEVELOPER],
  },
  {
    path: "/users",
    label: "Users",
    icon: "Users",
    permission: "users",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER],
  },
  {
    path: "/agents",
    label: "Agents",
    icon: "UserCheck",
    permission: "agents",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR],
  },
  {
    path: "/roles",
    label: "Roles & access",
    icon: "Shield",
    permission: "roles",
    roles: [ROLES.SUPER_ADMIN],
  },
  {
    path: "/prompts",
    label: "Prompts",
    icon: "FileText",
    permission: "prompts",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.DEVELOPER],
  },
  {
    path: "/llm-configs",
    label: "LLM Configs",
    icon: "Cpu",
    permission: "llm-configs",
    roles: [ROLES.SUPER_ADMIN, ROLES.DEVELOPER],
  },
  {
    path: "/message-ratings",
    label: "Message feedback",
    icon: "ThumbsUp",
    permission: "message-ratings",
    roles: [ROLES.SUPER_ADMIN],
  },
  {
    path: "/account-updates",
    label: "Updates",
    icon: "Bell",
    permission: "account-updates",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR],
  },
  { path: "/chat", label: "Chat", icon: "MessageSquare", permission: "chat", roles: [ROLES.AGENT, ROLES.SUPERVISOR] },
  {
    path: "/tickets",
    label: "Tickets",
    icon: "Ticket",
    permission: "tickets",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR, ROLES.DEVELOPER],
  },
  {
    path: "/ingestion",
    label: "Ingestion",
    icon: "Upload",
    permission: "ingestion",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR, ROLES.DEVELOPER],
  },
  {
    path: "/logs",
    label: "Logs / System health",
    icon: "ScrollText",
    permission: "logs",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR, ROLES.DEVELOPER],
  },
  {
    path: "/document-import",
    label: "Document Import",
    icon: "FileUp",
    permission: "document-import",
    roles: [ROLES.SUPER_ADMIN],
    lockedRoles: [ROLES.SUPER_ADMIN],
  },
  {
    path: "/sharepoint-sync",
    label: "SharePoint Sync",
    icon: "FolderSync",
    permission: "sharepoint-sync",
    roles: [ROLES.SUPER_ADMIN],
    lockedRoles: [ROLES.SUPER_ADMIN],
  },
  {
    path: "/monitoring",
    label: "Monitoring",
    icon: "Activity",
    permission: "monitoring",
    roles: [ROLES.SUPER_ADMIN, ROLES.DEVELOPER],
    lockedRoles: [ROLES.SUPER_ADMIN, ROLES.DEVELOPER],
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
