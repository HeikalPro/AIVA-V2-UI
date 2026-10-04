import type { CSSProperties, ReactNode } from "react";
import { Toaster, toast as sonnerToast, type ExternalToast } from "sonner";
import { AlertTriangle, CheckCircle2, Info, Loader2, XCircle } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

/*
 * Transient feedback ("User updated", "Copied"). Persistent page state belongs inline (Alert).
 *
 *   import { toast } from "@/components/ui/toast";
 *   toast.success("User updated");
 *   toast.error("Could not save", { description: formatUserError(err) });
 *   toast.promise(mutation.mutateAsync(v), { loading: "Saving…", success: "Saved", error: "Save failed" });
 */

type Message = ReactNode;
type ToastFn = (message: Message, options?: ExternalToast) => string | number;

export const toast: {
  success: ToastFn;
  error: ToastFn;
  warning: ToastFn;
  info: ToastFn;
  message: ToastFn;
  promise: typeof sonnerToast.promise;
  dismiss: typeof sonnerToast.dismiss;
} = {
  success: (message: Message, options?: ExternalToast) => sonnerToast.success(message, options),
  error: (message: Message, options?: ExternalToast) => sonnerToast.error(message, { duration: 6000, ...options }),
  warning: (message: Message, options?: ExternalToast) => sonnerToast.warning(message, options),
  info: (message: Message, options?: ExternalToast) => sonnerToast.info(message, options),
  /** Neutral toast without an icon. */
  message: (message: Message, options?: ExternalToast) => sonnerToast(message, options),
  promise: sonnerToast.promise,
  dismiss: sonnerToast.dismiss,
};

const ICON = "h-4 w-4";

/** Mounted once in main.tsx (inside ThemeProvider). Colors come from the design tokens. */
export function AppToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      closeButton
      visibleToasts={4}
      gap={8}
      icons={{
        success: <CheckCircle2 aria-hidden="true" className={`${ICON} text-success`} />,
        error: <XCircle aria-hidden="true" className={`${ICON} text-danger`} />,
        warning: <AlertTriangle aria-hidden="true" className={`${ICON} text-warning`} />,
        info: <Info aria-hidden="true" className={`${ICON} text-info`} />,
        loading: <Loader2 aria-hidden="true" className={`${ICON} animate-spin text-muted-foreground`} />,
      }}
      style={
        {
          fontFamily: "inherit",
          "--normal-bg": "hsl(var(--popover))",
          "--normal-border": "hsl(var(--border))",
          "--normal-text": "hsl(var(--popover-foreground))",
          "--border-radius": "8px",
        } as CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "gap-2.5 px-3.5 py-3 text-sm shadow-md",
          title: "font-medium text-foreground",
          description: "text-muted-foreground",
          actionButton: "font-medium",
          closeButton: "border-border bg-popover text-muted-foreground hover:text-foreground",
        },
      }}
    />
  );
}
