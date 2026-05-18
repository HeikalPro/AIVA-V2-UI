import type { HTMLAttributes } from "react";

type BadgeVariant = "default" | "success" | "warning" | "destructive" | "muted";

const variants: Record<BadgeVariant, string> = {
  default: "bg-primary/10 text-[#004080]",
  success: "bg-emerald-100 text-emerald-800",
  warning: "bg-amber-100 text-amber-800",
  destructive: "bg-red-100 text-red-800",
  muted: "bg-slate-100 text-slate-600",
};

export function Badge({
  variant = "default",
  className = "",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
