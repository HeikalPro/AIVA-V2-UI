import { cn } from "@/lib/utils";
import { PageAccessSummary } from "./PageAccessGroups";

type Props = {
  navPermissions: string[];
  /** Tighter spacing (inside forms). */
  compact?: boolean;
  /** Heading above the list (default "Pages from this role"). Pass null to omit. */
  title?: string | null;
  className?: string;
};

/** Read-only page access of a role, grouped like the sidebar. */
export function RolePageAccessPreview({ navPermissions, compact = false, title = "Pages from this role", className }: Props) {
  return (
    <div className={cn(compact ? "space-y-1.5" : "space-y-2", className)}>
      {title && <p className="text-ui font-medium text-foreground">{title}</p>}
      <PageAccessSummary keys={navPermissions} />
    </div>
  );
}
