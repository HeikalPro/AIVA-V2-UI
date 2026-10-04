import { formatDateTime, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Props = {
  value: string | null | undefined;
  /** Text when there is no timestamp (default "—"). */
  fallback?: string;
  className?: string;
};

/** "3m ago" with the full local date/time in the tooltip and a machine-readable <time>. */
export function RelativeTime({ value, fallback = "—", className }: Props) {
  if (!value) return <span className={cn("text-muted-foreground", className)}>{fallback}</span>;
  return (
    <time dateTime={value} title={formatDateTime(value)} className={cn("whitespace-nowrap tabular-nums", className)}>
      {formatRelativeTime(value)}
    </time>
  );
}
