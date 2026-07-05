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
  | "users"
  | "agents"
  | "roles"
  | "prompts"
  | "llm-configs"
  | "message-ratings"
  | "account-updates"
  | "chat"
  | "tickets"
  | "ingestion";

export type NavItem = {
  path: string;
  label: string;
  icon: string;
  permission: NavPermissionKey;
  /** Legacy role list — used when API permissions are unavailable. */
  roles: string[];
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
];

export type AccessUser = {
  roles: string[];
  permissions?: string[];
};

export function canAccess(roles: string[], required: string[]): boolean {
  if (required.length === 0) return true;
  if (roles.includes(ROLES.SUPER_ADMIN)) return true;
  return required.some((r) => roles.includes(r));
}

export function canAccessPermission(user: AccessUser, permission: NavPermissionKey): boolean {
  if (user.roles.includes(ROLES.SUPER_ADMIN)) return true;
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
  NAV_ITEMS.map((item) => [item.permission, item.label]),
) as Record<NavPermissionKey, string>;
