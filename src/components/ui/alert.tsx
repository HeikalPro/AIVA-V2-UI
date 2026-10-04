import type { HTMLAttributes, ReactNode } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type AlertTone = "info" | "success" | "warning" | "danger" | "neutral";

const TONE: Record<AlertTone, { box: string; icon: string; Icon: LucideIcon }> = {
  info: { box: "border-info/25 bg-info-muted", icon: "text-info", Icon: Info },
  success: { box: "border-success/25 bg-success-muted", icon: "text-success", Icon: CheckCircle2 },
  warning: { box: "border-warning/30 bg-warning-muted", icon: "text-warning", Icon: AlertTriangle },
  danger: { box: "border-danger/25 bg-danger-muted", icon: "text-danger", Icon: AlertCircle },
  neutral: { box: "border-border bg-surface-muted", icon: "text-muted-foreground", Icon: Info },
};

type AlertProps = Omit<HTMLAttributes<HTMLDivElement>, "title"> & {
  tone?: AlertTone;
  title?: ReactNode;
  /** Description text; `children` works too. */
  description?: ReactNode;
  /** Right-aligned action slot (e.g. a small Button). */
  action?: ReactNode;
  /** Override the tone icon, or `false` for none. */
  icon?: LucideIcon | false;
};

/**
 * Inline, persistent message (errors that block a form, configuration warnings, notices).
 * Compact and tinted. Danger uses role="alert"; other tones use role="status".
 */
export function Alert({ tone = "info", title, description, action, icon, className, children, role, ...props }: AlertProps) {
  const t = TONE[tone];
  const Icon = icon === false ? null : (icon ?? t.Icon);
  const body = description ?? children;
  return (
    <div
      role={role ?? (tone === "danger" ? "alert" : "status")}
      className={cn("flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm text-foreground", t.box, className)}
      {...props}
    >
      {Icon && <Icon aria-hidden="true" className={cn("mt-0.5 h-4 w-4 shrink-0", t.icon)} />}
      <div className="min-w-0 flex-1 space-y-0.5">
        {title && <p className="font-medium leading-5 text-foreground">{title}</p>}
        {body && <div className="leading-5 text-foreground/85 [overflow-wrap:anywhere]">{body}</div>}
      </div>
      {action && <div className="-my-0.5 flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
