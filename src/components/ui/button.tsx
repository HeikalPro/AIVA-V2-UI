import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Slot } from "radix-ui";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** `default` is a legacy alias of `primary`. */
export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "destructive" | "link" | "default";
/** `default` is a legacy alias of `md`. */
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm" | "default";

const PRIMARY = "bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover active:bg-primary-active";

const VARIANT: Record<ButtonVariant, string> = {
  primary: PRIMARY,
  default: PRIMARY,
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70 active:bg-secondary",
  outline:
    "border border-input/60 bg-surface text-foreground shadow-xs hover:border-input hover:bg-accent hover:text-accent-foreground",
  ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
  destructive: "bg-danger text-danger-foreground shadow-xs hover:bg-danger/90 active:bg-danger/80",
  link: "text-primary underline-offset-4 hover:text-primary-hover hover:underline",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-ui",
  md: "h-9 gap-2 px-4 text-sm",
  default: "h-9 gap-2 px-4 text-sm",
  lg: "h-10 gap-2 px-5 text-sm",
  icon: "h-9 w-9 p-0",
  "icon-sm": "h-8 w-8 p-0",
};

/** Class string for button-looking elements that cannot use <Button> (prefer `asChild`). */
export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(
    "inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    // Icon/label spacing comes from `gap`; neutralise legacy `mr-2` / `ml-2` on direct child icons.
    "[&>svg]:m-0 [&>svg]:shrink-0",
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner, disables the button and sets aria-busy. */
  loading?: boolean;
  /** Render the single child (e.g. a router <Link>) with button styling. */
  asChild?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading = false, asChild = false, disabled, children, ...props }, ref) => {
    const classes = buttonVariants({ variant, size, className });
    if (asChild) {
      return (
        <Slot.Root ref={ref} className={classes} aria-busy={loading || undefined} {...props}>
          {children}
        </Slot.Root>
      );
    }
    return (
      <button ref={ref} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
        {loading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
export { Button };
