import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  /** Max width of the dialog panel (Tailwind class, e.g. max-w-2xl). Defaults to max-w-lg. */
  size?: string;
};

export function Dialog({ open, onOpenChange, children, size = "max-w-lg" }: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          aria-hidden
          onClick={() => onOpenChange(false)}
        />
        <div className={`relative z-10 my-auto w-full ${size}`}>{children}</div>
      </div>
    </div>
  );
}

export function DialogContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-xl ${className}`}
    >
      {children}
    </div>
  );
}

/** Scrollable middle section; use inside DialogContent with flex max-h layout. */
export function DialogBody({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`overflow-y-auto ${className}`}>{children}</div>;
}

export function DialogHeader({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mb-4 shrink-0 ${className}`}>{children}</div>;
}

export function DialogTitle({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <h2 className={`text-xl font-bold text-[#00263E] ${className}`.trim()}>{children}</h2>;
}

export function DialogFooter({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mt-6 flex shrink-0 justify-end gap-2 ${className}`}>{children}</div>;
}

export function DialogClose({ onClose }: { onClose: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="absolute right-3 top-3" onClick={onClose}>
      <X className="h-4 w-4" />
    </Button>
  );
}
