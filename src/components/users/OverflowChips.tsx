import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";

export type ChipItem = { key: string | number; label: string };

type OverflowChipsProps = {
  items: ChipItem[];
  /** Chips shown before the "+N" chip (default 2). */
  max?: number;
  variant?: BadgeVariant;
  /** Rendered when there are no items (default an em dash). */
  empty?: ReactNode;
  /** Noun for the "+N" accessible name ("accounts", "queues"). */
  noun?: string;
  /** Max width of one chip before it truncates (CSS length). */
  chipMaxWidth?: string;
  className?: string;
};

/**
 * Concise chip list for table cells: the first `max` items as badges, then a "+N" chip whose
 * tooltip lists the rest (focusable, so the list is reachable by keyboard too). Labels may be
 * Arabic, so each one is isolated with dir="auto".
 */
export function OverflowChips({
  items,
  max = 2,
  variant = "neutral",
  empty,
  noun = "more",
  chipMaxWidth = "10rem",
  className,
}: OverflowChipsProps) {
  if (items.length === 0) {
    return <>{empty ?? <span className="text-subtle-foreground">—</span>}</>;
  }
  const shown = items.slice(0, max);
  const rest = items.slice(max);
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      {shown.map((item) => (
        <Badge key={item.key} variant={variant} className="min-w-0" style={{ maxWidth: chipMaxWidth }} title={item.label}>
          <span dir="auto" className="truncate">
            {item.label}
          </span>
        </Badge>
      ))}
      {rest.length > 0 && (
        <Tooltip
          content={
            <ul className="space-y-0.5">
              {rest.map((item) => (
                <li key={item.key}>
                  <span dir="auto">{item.label}</span>
                </li>
              ))}
            </ul>
          }
        >
          <Badge
            variant="outline"
            tabIndex={0}
            data-row-click-ignore
            aria-label={`${rest.length} more ${noun}: ${rest.map((i) => i.label).join(", ")}`}
            className="cursor-default tabular-nums text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            +{rest.length}
          </Badge>
        </Tooltip>
      )}
    </div>
  );
}
