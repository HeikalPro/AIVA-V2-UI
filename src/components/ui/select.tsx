import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { controlBase, controlSizes, type ControlSize } from "./input";
import { splitLayoutClassName } from "./layout-classes";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  /** md = 36px (default), sm = 32px. */
  controlSize?: ControlSize;
  /** Extra classes for the wrapper element. */
  wrapperClassName?: string;
}

/**
 * Native <select> (keeps `onChange={(e) => e.target.value}`) styled like Input, with a chevron.
 *
 * The <select> sits in a wrapper. Layout classes passed in `className` — margin (mt-1), width
 * (w-40, min-w-[200px], max-w-*), flex/grid placement (flex-1, shrink-0, col-span-2, self-*),
 * display (hidden, block) — are applied to the WRAPPER so they size/position the whole control;
 * every other class (h-8, text-xs, …) goes to the <select>. The wrapper is full-width by default.
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, wrapperClassName, controlSize = "md", children, multiple, size, ...props }, ref) => {
    const { layout, control } = splitLayoutClassName(className);
    const isList = Boolean(multiple) || (typeof size === "number" && size > 1);
    return (
      <div className={cn("relative w-full", layout, wrapperClassName)}>
        <select
          ref={ref}
          multiple={multiple}
          size={size}
          className={cn(
            controlBase,
            isList ? "px-1 py-1 text-sm" : cn("block appearance-none", controlSizes[controlSize]),
            control,
            // Last so neither the size's px-* nor a caller's padding can slide text under the chevron.
            !isList && "pr-8",
          )}
          {...props}
        >
          {children}
        </select>
        {!isList && (
          <ChevronDown
            aria-hidden="true"
            className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
        )}
      </div>
    );
  },
);
Select.displayName = "Select";
export { Select };
