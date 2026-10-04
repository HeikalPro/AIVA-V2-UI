import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { Switch as SwitchPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/** Radix switch (role="switch"). Use `checked` + `onCheckedChange`; label it with <Label htmlFor> or aria-label. */
export const Switch = forwardRef<
  ElementRef<typeof SwitchPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> & { size?: "sm" | "md" }
>(({ className, size = "md", ...props }, ref) => (
  <SwitchPrimitive.Root
    ref={ref}
    className={cn(
      "peer inline-flex shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:bg-primary data-[state=unchecked]:bg-input",
      size === "sm" ? "h-4 w-7" : "h-5 w-9",
      className,
    )}
    {...props}
  >
    <SwitchPrimitive.Thumb
      className={cn(
        "pointer-events-none block rounded-full bg-surface shadow-sm ring-0 transition-transform data-[state=checked]:bg-primary-foreground data-[state=unchecked]:translate-x-0",
        size === "sm" ? "h-3 w-3 data-[state=checked]:translate-x-3" : "h-4 w-4 data-[state=checked]:translate-x-4",
      )}
    />
  </SwitchPrimitive.Root>
));
Switch.displayName = "Switch";
