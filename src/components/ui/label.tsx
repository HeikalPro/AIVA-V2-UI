import { forwardRef, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  /** Shows a required marker (the control itself should still carry `required`). */
  required?: boolean;
}

const Label = forwardRef<HTMLLabelElement, LabelProps>(({ className, required, children, ...props }, ref) => (
  <label
    ref={ref}
    className={cn(
      "text-ui font-medium text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-60",
      className,
    )}
    {...props}
  >
    {children}
    {required && (
      <span aria-hidden="true" className="ml-0.5 text-danger">
        *
      </span>
    )}
  </label>
));
Label.displayName = "Label";
export { Label };
