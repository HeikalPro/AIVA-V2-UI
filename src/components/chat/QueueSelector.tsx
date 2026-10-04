import { useEffect, useId, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { QueueGroup } from "@/types/api";
import { Button } from "@/components/ui/button";

type Props = {
  queues: QueueGroup[];
  selected: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
  /** Visible group label (default "KB queues"). */
  label?: string;
  /** Hide the visible label (still used as the group's accessible name). */
  hideLabel?: boolean;
  /** sm chips (32px) or xs-ish compact chips (28px) for toolbars. */
  size?: "sm" | "xs";
  className?: string;
};

/**
 * Toggle chips for knowledge-base queues. At least one queue stays selected (the last chip
 * cannot be turned off). Selected chips are tinted and carry a check mark, so state is not
 * conveyed by colour alone; each chip is a toggle button (aria-pressed).
 */
export function QueueSelector({
  queues,
  selected,
  onChange,
  disabled,
  label = "KB queues",
  hideLabel = false,
  size = "sm",
  className,
}: Props) {
  const labelId = useId();
  const [local, setLocal] = useState<string[]>(selected);

  useEffect(() => {
    setLocal(selected);
  }, [selected]);

  function toggle(key: string) {
    if (disabled) return;
    const next = local.includes(key) ? local.filter((k) => k !== key) : [...local, key];
    if (next.length === 0) return;
    setLocal(next);
    onChange(next);
  }

  function selectAll() {
    if (disabled) return;
    const all = queues.map((q) => q.key);
    if (!all.length) return;
    setLocal(all);
    onChange(all);
  }

  if (!queues.length) return null;

  const allSelected = local.length === queues.length;

  return (
    <div className={cn("space-y-2", className)}>
      <div className={cn("flex flex-wrap items-center gap-2", hideLabel && "sr-only")}>
        <span id={labelId} className="text-ui font-medium text-foreground">
          {label}
        </span>
        {!hideLabel && (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0 text-xs"
            onClick={selectAll}
            disabled={disabled || allSelected}
          >
            Select all
          </Button>
        )}
      </div>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
        {queues.map((q) => {
          const on = local.includes(q.key);
          const isLast = on && local.length === 1;
          return (
            <Button
              key={q.key}
              type="button"
              variant="outline"
              size="sm"
              aria-pressed={on}
              disabled={disabled}
              title={isLast ? "At least one queue stays selected" : undefined}
              onClick={() => toggle(q.key)}
              className={cn(
                "rounded-full",
                size === "xs" ? "h-7 px-2.5" : "px-3",
                on
                  ? "border-primary/60 bg-primary-muted text-primary-muted-foreground hover:border-primary hover:bg-primary-muted hover:text-primary-muted-foreground"
                  : "text-muted-foreground",
              )}
            >
              {on && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
              <span dir="auto">{q.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
