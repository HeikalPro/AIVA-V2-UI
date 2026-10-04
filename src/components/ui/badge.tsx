import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/** Legacy aliases: default → primary, destructive → danger, muted → neutral. */
export type BadgeVariant =
  | "neutral"
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "outline"
  | "default"
  | "destructive"
  | "muted";

const VARIANT: Record<BadgeVariant, string> = {
  neutral: "bg-neutral-muted text-neutral",
  primary: "bg-primary-muted text-primary-muted-foreground",
  info: "bg-info-muted text-info",
  success: "bg-success-muted text-success",
  warning: "bg-warning-muted text-warning",
  danger: "bg-danger-muted text-danger",
  outline: "border-border bg-transparent text-foreground",
  default: "bg-primary-muted text-primary-muted-foreground",
  destructive: "bg-danger-muted text-danger",
  muted: "bg-neutral-muted text-neutral",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  /** Fully rounded; only where a pill is semantically right (counts, tags). */
  pill?: boolean;
}

/** Small restrained label (roles, tags, counts). For statuses prefer <Status> (dot + text). */
export function Badge({ variant = "primary", pill = false, className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap border border-transparent px-1.5 py-0.5 text-xs font-medium leading-4",
        pill ? "rounded-full px-2" : "rounded-sm",
        VARIANT[variant],
        className,
      )}
      {...props}
    />
  );
}
