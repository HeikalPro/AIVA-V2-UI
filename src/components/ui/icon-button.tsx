import { forwardRef, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";
import { Tooltip } from "./tooltip";

export interface IconButtonProps extends Omit<ButtonProps, "children" | "size" | "asChild"> {
  /** Required: used as aria-label and as the tooltip text. */
  label: string;
  icon: LucideIcon;
  /** sm = 32px, md = 36px (default). */
  size?: "sm" | "md";
  /** Tooltip content override; `false` hides the tooltip (aria-label is still set). */
  tooltip?: ReactNode | false;
  tooltipSide?: "top" | "right" | "bottom" | "left";
}

/** Icon-only button. Every icon-only action in the app should use this (accessible name + tooltip). */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { label, icon: Icon, size = "md", variant = "ghost", tooltip, tooltipSide = "top", className, type = "button", ...props },
    ref,
  ) => {
    const button = (
      <Button
        ref={ref}
        type={type}
        variant={variant}
        size={size === "sm" ? "icon-sm" : "icon"}
        aria-label={label}
        className={cn(variant === "ghost" && "text-muted-foreground hover:text-foreground", className)}
        {...props}
      >
        <Icon aria-hidden="true" className="h-4 w-4" />
      </Button>
    );
    if (tooltip === false) return button;
    return (
      <Tooltip content={tooltip ?? label} side={tooltipSide}>
        {button}
      </Tooltip>
    );
  },
);
IconButton.displayName = "IconButton";
