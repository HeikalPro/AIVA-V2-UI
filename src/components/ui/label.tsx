import { forwardRef, type LabelHTMLAttributes } from "react";

const Label = forwardRef<HTMLLabelElement, LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className = "", ...props }, ref) => (
    <label ref={ref} className={`text-sm font-medium text-slate-700 ${className}`} {...props} />
  ),
);
Label.displayName = "Label";
export { Label };
