import { forwardRef, type ComponentPropsWithoutRef, type ElementRef, type ReactElement, type ReactNode } from "react";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/** Mounted once in main.tsx. Shares open/skip delays between tooltips. */
export function TooltipProvider({
  delayDuration = 300,
  skipDelayDuration = 200,
  ...props
}: ComponentPropsWithoutRef<typeof TooltipPrimitive.Provider>) {
  return <TooltipPrimitive.Provider delayDuration={delayDuration} skipDelayDuration={skipDelayDuration} {...props} />;
}

/** Low-level parts for custom compositions. Prefer <Tooltip>. */
export const TooltipRoot = TooltipPrimitive.Root;
export const TooltipTrigger = TooltipPrimitive.Trigger;

export const TooltipContent = forwardRef<
  ElementRef<typeof TooltipPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 max-w-xs rounded-md bg-foreground px-2 py-1 text-xs font-medium leading-4 text-background shadow-md",
        "motion-safe:animate-overlay-in",
        className,
      )}
      {...props}
    />
  </TooltipPrimitive.Portal>
));
TooltipContent.displayName = "TooltipContent";

type TooltipProps = {
  /** Tooltip text. When empty the child renders without a tooltip. */
  content: ReactNode;
  /** A single element that accepts a ref and DOM props (Button, IconButton, span …). */
  children: ReactElement;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  delayDuration?: number;
  disabled?: boolean;
  className?: string;
};

/** Simple tooltip: `<Tooltip content="Refresh"><Button … /></Tooltip>`. */
export function Tooltip({ content, children, side = "top", align = "center", delayDuration, disabled, className }: TooltipProps) {
  if (disabled || content == null || content === "") return children;
  return (
    <TooltipPrimitive.Root delayDuration={delayDuration}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipContent side={side} align={align} className={className}>
        {content}
      </TooltipContent>
    </TooltipPrimitive.Root>
  );
}
