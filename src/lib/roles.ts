export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ORG_ADMIN: "ORGANIZATION_ADMIN",
  ACCOUNT_MANAGER: "ACCOUNT_MANAGER",
  SUPERVISOR: "SUPERVISOR",
  AGENT: "AGENT",
  DEVELOPER: "DEVELOPER",
} as const;

export type NavItem = {
  path: string;
  label: string;
  icon: string;
  roles: string[];
};

export const NAV_ITEMS: NavItem[] = [
  {
    path: "/",
    label: "Dashboard",
    icon: "LayoutDashboard",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR, ROLES.DEVELOPER],
  },
  { path: "/organizations", label: "Organizations", icon: "Building2", roles: [ROLES.SUPER_ADMIN] },
  { path: "/accounts", label: "Accounts", icon: "Briefcase", roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER] },
  { path: "/users", label: "Users", icon: "Users", roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER] },
  { path: "/prompts", label: "Prompts", icon: "FileText", roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER] },
  { path: "/llm-configs", label: "LLM Configs", icon: "Cpu", roles: [ROLES.SUPER_ADMIN] },
  { path: "/message-ratings", label: "Message feedback", icon: "ThumbsUp", roles: [ROLES.SUPER_ADMIN] },
  { path: "/chat", label: "Chat", icon: "MessageSquare", roles: [ROLES.AGENT, ROLES.SUPERVISOR] },
  { path: "/tickets", label: "Tickets", icon: "Ticket", roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR, ROLES.DEVELOPER] },
  {
    path: "/ingestion",
    label: "Ingestion",
    icon: "Upload",
    roles: [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR, ROLES.DEVELOPER],
  },
];

export function canAccess(roles: string[], required: string[]): boolean {
  if (required.length === 0) return true;
  if (roles.includes(ROLES.SUPER_ADMIN)) return true;
  return required.some((r) => roles.includes(r));
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
