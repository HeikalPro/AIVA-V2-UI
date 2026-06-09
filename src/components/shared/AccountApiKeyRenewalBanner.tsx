import { Calendar } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAccounts } from "@/hooks/useAccounts";
import { ROLES, canAccess } from "@/lib/roles";
import { formatRenewalDate } from "@/components/shared/ApiKeyRenewalCard";

const RENEWAL_VIEW_ROLES = [ROLES.SUPER_ADMIN, ROLES.ORG_ADMIN, ROLES.ACCOUNT_MANAGER, ROLES.SUPERVISOR, ROLES.DEVELOPER];

export function AccountApiKeyRenewalBanner() {
  const { user } = useAuth();
  const isSuperAdmin = user?.roles.includes(ROLES.SUPER_ADMIN);
  const canView = canAccess(user?.roles ?? [], RENEWAL_VIEW_ROLES) && !isSuperAdmin;
  const { data: accounts = [] } = useAccounts(
    isSuperAdmin ? null : user?.organization_id,
    canView,
  );

  if (!canView || accounts.length === 0) return null;

  return (
    <div className="hidden items-center gap-3 text-xs text-muted-foreground xl:flex">
      <Calendar className="h-3.5 w-3.5 shrink-0 text-indigo-600" />
      <div className="flex max-w-md flex-wrap gap-x-3 gap-y-1">
        {accounts.map((account) => (
          <span key={account.id} className="whitespace-nowrap">
            <span className="font-medium text-foreground">{account.name}:</span>{" "}
            {formatRenewalDate(account.api_key_renewal_date)}
          </span>
        ))}
      </div>
    </div>
  );
}
