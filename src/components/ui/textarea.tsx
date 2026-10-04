import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { controlBase } from "./input";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Monospace text (prompt / JSON editors). */
  mono?: boolean;
}

/** Multi-line text field; same states as Input. Vertically resizable. */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, mono = false, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-20 resize-y px-3 py-2",
      controlBase,
      mono ? "font-mono text-ui leading-relaxed" : "text-sm",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
