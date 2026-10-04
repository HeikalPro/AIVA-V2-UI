import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ControlSize = "sm" | "md";

/**
 * Shared look for text-like controls (Input, Select, Textarea, SearchInput).
 * States: hover, focus (blue ring), disabled, read-only (tinted, no ring), error via aria-invalid.
 */
export const controlBase =
  "w-full min-w-0 rounded-md border border-input bg-surface text-foreground shadow-xs transition-[color,background-color,border-color,box-shadow] " +
  "placeholder:text-subtle-foreground hover:border-muted-foreground " +
  "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring/30 " +
  "disabled:cursor-not-allowed disabled:border-input/60 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none " +
  "[&[readonly]]:border-input/60 [&[readonly]]:bg-surface-muted [&[readonly]]:text-muted-foreground [&[readonly]]:shadow-none [&[readonly]]:focus-visible:border-input [&[readonly]]:focus-visible:ring-0 " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus-visible:border-danger aria-[invalid=true]:focus-visible:ring-danger/30";

export const controlSizes: Record<ControlSize, string> = {
  sm: "h-8 px-2.5 text-ui",
  md: "h-9 px-3 text-sm",
};

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  /** md = 36px (default), sm = 32px for dense toolbars and filter bars. */
  controlSize?: ControlSize;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", controlSize = "md", ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex py-1",
        controlBase,
        controlSizes[controlSize],
        "file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
export { Input };
