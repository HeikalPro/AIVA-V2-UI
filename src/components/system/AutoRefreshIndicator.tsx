import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

type Props = {
  /** The polling interval the data hooks already use (display only; it does not change polling). */
  intervalMs: number | false | null | undefined;
  /** True while a background refetch is in flight (the dot pulses). */
  fetching?: boolean;
  className?: string;
};

function intervalText(ms: number): string {
  if (ms < 60_000) return `${Math.round(ms / 1000)}s`;
  const minutes = Math.round(ms / 60_000);
  return `${minutes}m`;
}

/** "Auto refresh ● 30s" — tells operators the view updates itself and how often. */
export function AutoRefreshIndicator({ intervalMs, fetching = false, className }: Props) {
  const on = typeof intervalMs === "number" && intervalMs > 0;
  const text = on ? intervalText(intervalMs) : "Off";
  const description = on
    ? `This view refreshes automatically every ${intervalText(intervalMs)}${fetching ? " (refreshing now)" : ""}.`
    : "This view does not refresh automatically.";
  return (
    <Tooltip content={description}>
      <span
        tabIndex={0}
        aria-label={description}
        className={cn(
          "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          className,
        )}
      >
        Auto refresh
        <span aria-hidden="true" className="relative inline-flex h-1.5 w-1.5">
          {on && fetching && <span className="absolute inset-0 rounded-full bg-success opacity-70 motion-safe:animate-ping" />}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full", on ? "bg-success" : "bg-neutral")} />
        </span>
        <span className="tabular-nums text-foreground">{text}</span>
      </span>
    </Tooltip>
  );
}
