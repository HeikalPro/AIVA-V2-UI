import { cn } from "@/lib/utils";

const TONE = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
} as const;

const HEIGHT = { sm: "h-1", md: "h-1.5", lg: "h-2" } as const;

type ProgressProps = {
  /** Current value. Omit / null for an indeterminate bar. */
  value?: number | null;
  max?: number;
  tone?: keyof typeof TONE;
  size?: keyof typeof HEIGHT;
  /** Accessible name, e.g. "Upload progress". */
  label?: string;
  className?: string;
};

/** Determinate or indeterminate progress bar (role="progressbar"). */
export function Progress({ value, max = 100, tone = "primary", size = "md", label, className }: ProgressProps) {
  const current = typeof value === "number" && Number.isFinite(value) ? value : null;
  const indeterminate = current == null;
  const pct = current == null ? 0 : Math.min(100, Math.max(0, (current / (max || 100)) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={current ?? undefined}
      aria-busy={indeterminate || undefined}
      className={cn("relative w-full overflow-hidden rounded-full bg-muted", HEIGHT[size], className)}
    >
      {indeterminate ? (
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-2/5 rounded-full motion-safe:animate-progress-indeterminate motion-reduce:w-full motion-reduce:opacity-40",
            TONE[tone],
          )}
        />
      ) : (
        <div
          className={cn("h-full rounded-full transition-[width] duration-300 ease-out", TONE[tone])}
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  );
}
