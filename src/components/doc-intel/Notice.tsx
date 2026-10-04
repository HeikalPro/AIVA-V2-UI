import type { ReactNode } from "react";
import { X } from "lucide-react";
import { Alert, type AlertTone } from "@/components/ui/alert";
import { IconButton } from "@/components/ui/icon-button";

type Tone = Extract<AlertTone, "danger" | "warning" | "success" | "info">;

type Props = {
  tone: Tone;
  title: ReactNode;
  children?: ReactNode;
  /** Adds a dismiss (×) button. */
  onDismiss?: () => void;
  /** Extra content on the right, before the dismiss button (e.g. a small "Retry" Button). */
  action?: ReactNode;
  className?: string;
};

/**
 * Server-state notice for the document intelligence pages (module not installed, extraction
 * unavailable, upload result …). A thin wrapper over the shared `Alert`, so there is one alert
 * system in the app.
 */
export function Notice({ tone, title, children, onDismiss, action, className }: Props) {
  const actions =
    action || onDismiss ? (
      <>
        {action}
        {onDismiss && <IconButton label="Dismiss" icon={X} size="sm" className="-my-1 -mr-1.5 h-7 w-7" onClick={onDismiss} />}
      </>
    ) : undefined;
  return <Alert tone={tone} title={title} description={children} action={actions} className={className} />;
}
