import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "./button";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function Dialog({ open, onOpenChange, children }: DialogProps) {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-lg">{children}</div>
    </div>
  );
}

export function DialogContent({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-xl ${className}`}>{children}</div>
  );
}

export function DialogHeader({ children }: { children: ReactNode }) {
  return <div className="mb-4">{children}</div>;
}

export function DialogTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-xl font-bold text-[#00263E]">{children}</h2>;
}

export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex justify-end gap-2">{children}</div>;
}

export function DialogClose({ onClose }: { onClose: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="absolute right-3 top-3" onClick={onClose}>
      <X className="h-4 w-4" />
    </Button>
  );
}
