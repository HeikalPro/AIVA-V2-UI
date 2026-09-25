import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from "lucide-react";

type Tone = "danger" | "warning" | "success" | "info";

const TONES: Record<Tone, { box: string; icon: LucideIcon; iconClass: string }> = {
  danger: { box: "border-red-200 bg-red-50 text-red-800", icon: XCircle, iconClass: "" },
  warning: { box: "border-amber-200 bg-amber-50 text-amber-800", icon: AlertTriangle, iconClass: "" },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-800", icon: CheckCircle2, iconClass: "" },
  info: { box: "border-primary/20 bg-primary/5 text-foreground", icon: Info, iconClass: "text-primary" },
};

type Props = {
  tone: Tone;
  title: ReactNode;
  children?: ReactNode;
  onDismiss?: () => void;
  className?: string;
};

/** Page-level status banner (module not installed, extraction unavailable, upload result, …). */
export function Notice({ tone, title, children, onDismiss, className = "" }: Props) {
  const { box, icon: Icon, iconClass } = TONES[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${box} ${className}`.trim()}
    >
      <Icon aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${iconClass}`} />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-semibold">{title}</p>
        {children ? <div className="break-words">{children}</div> : null}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="-m-1 shrink-0 rounded-md p-1 opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
