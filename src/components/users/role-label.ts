import { ROLES } from "@/lib/roles";

const LABELS: Record<string, string> = {
  [ROLES.SUPER_ADMIN]: "Super Admin",
  [ROLES.ORG_ADMIN]: "Organization Admin",
  [ROLES.ACCOUNT_MANAGER]: "Account Manager",
  [ROLES.SUPERVISOR]: "Supervisor",
  [ROLES.DEVELOPER]: "Developer",
  [ROLES.AGENT]: "Agent",
};

/** "ACCOUNT_MANAGER" → "Account Manager"; unknown roles are humanised ("QA_LEAD" → "Qa lead"). */
export function roleLabel(name: string): string {
  if (LABELS[name]) return LABELS[name];
  const words = name.replace(/[_-]+/g, " ").trim().toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : name;
}
