import {
  createContext,
  forwardRef,
  useContext,
  useLayoutEffect,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
} from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { trackFocusForReturn, withFocusReturn } from "./focus-return";

/*
 * Side panel (Radix Dialog anchored right) for complex detail / configuration views.
 *
 *   <Sheet open={open} onOpenChange={setOpen}>
 *     <SheetContent size="lg">
 *       <SheetHeader><SheetTitle>Source</SheetTitle><SheetDescription>…</SheetDescription></SheetHeader>
 *       <SheetBody>…</SheetBody>
 *       <SheetFooter><Button>Save</Button></SheetFooter>
 *     </SheetContent>
 *   </Sheet>
 */

export type SheetSize = "md" | "lg" | "xl";

const SIZE_CLASS: Record<SheetSize, string> = {
  md: "max-w-[480px]",
  lg: "max-w-[640px]",
  xl: "max-w-[880px]",
};

export const Sheet = SheetPrimitive.Root;
export const SheetTrigger = SheetPrimitive.Trigger;
/** Radix Close (wrap your own button with asChild). */
export const SheetClose = SheetPrimitive.Close;

const DescriptionContext = createContext<((v: boolean) => void) | null>(null);

type SheetContentProps = ComponentPropsWithoutRef<typeof SheetPrimitive.Content> & {
  size?: SheetSize;
  hideClose?: boolean;
};

export const SheetContent = forwardRef<ElementRef<typeof SheetPrimitive.Content>, SheetContentProps>(
  ({ className, children, size = "md", hideClose = false, onCloseAutoFocus, ...props }, ref) => {
    trackFocusForReturn();
    const [hasDescription, setHasDescription] = useState(false);
    return (
      <SheetPrimitive.Portal>
        <SheetPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay/40 motion-safe:animate-overlay-in" />
        <SheetPrimitive.Content
          ref={ref}
          {...(hasDescription ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex h-full w-full flex-col border-l border-border bg-popover text-popover-foreground shadow-lg",
            "focus:outline-none motion-safe:animate-sheet-in",
            SIZE_CLASS[size],
            className,
          )}
          onCloseAutoFocus={withFocusReturn(onCloseAutoFocus)}
          {...props}
        >
          <DescriptionContext.Provider value={setHasDescription}>{children}</DescriptionContext.Provider>
          {!hideClose && (
            <SheetPrimitive.Close asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
              >
                <X aria-hidden="true" className="h-4 w-4" />
              </Button>
            </SheetPrimitive.Close>
          )}
        </SheetPrimitive.Content>
      </SheetPrimitive.Portal>
    );
  },
);
SheetContent.displayName = "SheetContent";

type DivProps = HTMLAttributes<HTMLDivElement>;

export function SheetHeader({ className, ...props }: DivProps) {
  return (
    <div className={cn("flex shrink-0 flex-col gap-1 border-b border-border px-5 py-4 pr-14", className)} {...props} />
  );
}

export function SheetBody({ className, ...props }: DivProps) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", className)} {...props} />;
}

export function SheetFooter({ className, ...props }: DivProps) {
  return (
    <div
      className={cn("flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border px-5 py-3", className)}
      {...props}
    />
  );
}

export const SheetTitle = forwardRef<
  ElementRef<typeof SheetPrimitive.Title>,
  ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title ref={ref} className={cn("text-base font-semibold leading-6 text-foreground", className)} {...props} />
));
SheetTitle.displayName = "SheetTitle";

export const SheetDescription = forwardRef<
  ElementRef<typeof SheetPrimitive.Description>,
  ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => {
  const register = useContext(DescriptionContext);
  useLayoutEffect(() => {
    if (!register) return;
    register(true);
    return () => register(false);
  }, [register]);
  return <SheetPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />;
});
SheetDescription.displayName = "SheetDescription";
