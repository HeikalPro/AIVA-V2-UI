import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { Checkbox as CheckboxPrimitive } from "radix-ui";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Radix checkbox. `checked` accepts true | false | "indeterminate" (e.g. "select all" with a
 * partial selection); use `onCheckedChange`. Pair with <Label htmlFor> or wrap in a <label>.
 */
export const Checkbox = forwardRef<
  ElementRef<typeof CheckboxPrimitive.Root>,
  ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border border-input bg-surface text-primary-foreground shadow-xs transition-colors",
      "hover:border-muted-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary",
      "aria-[invalid=true]:border-danger",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="group flex items-center justify-center text-current">
      <Check aria-hidden="true" strokeWidth={3} className="h-3 w-3 group-data-[state=indeterminate]:hidden" />
      <Minus aria-hidden="true" strokeWidth={3} className="hidden h-3 w-3 group-data-[state=indeterminate]:block" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = "Checkbox";
