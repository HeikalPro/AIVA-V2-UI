import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-6 w-6" } as const;

type SpinnerProps = {
  size?: keyof typeof SIZE;
  /** Accessible text (default "Loading"). Visible only when `showLabel` is set. */
  label?: string;
  showLabel?: boolean;
  className?: string;
};

/** Indeterminate activity indicator (role="status"). For page/table loading prefer Skeleton. */
export function Spinner({ size = "md", label = "Loading", showLabel = false, className }: SpinnerProps) {
  return (
    <span role="status" className={cn("inline-flex items-center gap-2 text-muted-foreground", className)}>
      <Loader2 aria-hidden="true" className={cn("animate-spin", SIZE[size])} />
      {showLabel ? <span className="text-sm">{label}</span> : <span className="sr-only">{label}</span>}
    </span>
  );
}
