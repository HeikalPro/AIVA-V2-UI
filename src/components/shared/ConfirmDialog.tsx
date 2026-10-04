import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** Body text. `description` is an alias that also accepts rich content. */
  message?: ReactNode;
  description?: ReactNode;
  error?: string | null;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  /** Confirm button text while `loading` (default "Working…"). */
  loadingLabel?: string;
  /** Keep the confirm button disabled (e.g. until an acknowledgement checkbox is ticked). */
  confirmDisabled?: boolean;
  /** Extra content under the description (acknowledgement checkbox, details list …). */
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Confirmation for destructive or consequential actions. Never use window.confirm(). */
export function ConfirmDialog({
  open,
  title,
  message,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = false,
  loading = false,
  loadingLabel = "Working…",
  confirmDisabled = false,
  error,
  children,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const body = description ?? message;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && !loading && onCancel()}>
      <DialogContent size="sm" hideClose>
        <div className="flex items-start gap-3">
          {destructive && (
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-danger-muted text-danger"
            >
              <AlertTriangle className="h-4 w-4" />
            </span>
          )}
          <DialogHeader className="mb-0 min-w-0 flex-1">
            <DialogTitle>{title}</DialogTitle>
            {body != null && body !== "" && (
              <DialogDescription className="[overflow-wrap:anywhere]">{body}</DialogDescription>
            )}
          </DialogHeader>
        </div>
        {children && <div className="mt-4 space-y-3 text-sm">{children}</div>}
        {error && (
          <Alert tone="danger" className="mt-4">
            {error}
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? "destructive" : "primary"}
            onClick={onConfirm}
            loading={loading}
            disabled={confirmDisabled}
          >
            {loading ? loadingLabel : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
