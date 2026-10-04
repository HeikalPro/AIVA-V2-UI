import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type ToggleChipProps = {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
  disabled?: boolean;
  /** Accessible name when the visible text is not enough (e.g. "12 months"). */
  "aria-label"?: string;
  className?: string;
};

/**
 * Multi-select chip (tenors, KB buttons): an outline Button with `aria-pressed`. Selected chips get
 * the primary tint, a primary border and a check mark, so the state never relies on colour alone.
 */
export function ToggleChip({ pressed, onPressedChange, children, disabled, className, "aria-label": ariaLabel }: ToggleChipProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-pressed={pressed}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => onPressedChange(!pressed)}
      className={cn(
        "h-7 rounded-full px-2.5 font-medium tabular-nums",
        pressed
          ? "border-primary bg-primary-muted text-primary-muted-foreground hover:border-primary hover:bg-primary-muted hover:text-primary-muted-foreground"
          : "text-muted-foreground",
        className,
      )}
    >
      {pressed && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
      <span dir="auto">{children}</span>
    </Button>
  );
}
