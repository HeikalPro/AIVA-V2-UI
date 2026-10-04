import type { ReactNode } from "react";
import { Inbox, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type EmptyStateProps = {
  /** lucide icon (default Inbox). */
  icon?: LucideIcon;
  /** Short operational sentence: "No users found", "No documents imported yet". */
  title: ReactNode;
  description?: ReactNode;
  /** e.g. a Button ("Clear filters", "Import documents"). */
  action?: ReactNode;
  /** sm for table bodies / small cards, md (default) for page sections. */
  size?: "sm" | "md";
  className?: string;
};

/**
 * Compact empty / no-results state. No illustrations. Inside a table, render it in a single
 * full-width cell: <TableRow><TableCell colSpan={n}><EmptyState size="sm" … /></TableCell></TableRow>.
 */
export function EmptyState({ icon: Icon = Inbox, title, description, action, size = "md", className }: EmptyStateProps) {
  const sm = size === "sm";
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        sm ? "gap-1.5 px-4 py-6" : "gap-2 px-6 py-10",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mb-1 inline-flex items-center justify-center rounded-lg border border-border bg-surface-muted text-muted-foreground",
          sm ? "h-8 w-8" : "h-10 w-10",
        )}
      >
        <Icon className={sm ? "h-4 w-4" : "h-5 w-5"} />
      </span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className={sm ? "mt-1" : "mt-2"}>{action}</div>}
    </div>
  );
}
