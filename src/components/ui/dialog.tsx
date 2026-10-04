import {
  createContext,
  forwardRef,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
} from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { trackFocusForReturn, withFocusReturn } from "./focus-return";

/*
 * Dialog (Radix): portal, dimmed overlay, focus trap, Escape, initial focus, scroll lock.
 *
 * Two layouts, chosen automatically:
 *  - panel    (no <DialogBody>): the whole panel scrolls; Header / content / Footer flow inside p-6.
 *  - sections (a <DialogBody> is rendered): Header and Footer are fixed bands (border-b / border-t)
 *             and only the body scrolls, so the footer actions stay visible.
 *
 *   <Dialog open={open} onOpenChange={setOpen} size="lg">
 *     <DialogContent>
 *       <DialogHeader>
 *         <DialogTitle>Edit user</DialogTitle>
 *         <DialogDescription>Changes apply immediately.</DialogDescription>
 *       </DialogHeader>
 *       <DialogBody>…fields…</DialogBody>
 *       <DialogFooter>
 *         <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
 *         <Button loading={saving}>Save</Button>
 *       </DialogFooter>
 *     </DialogContent>
 *   </Dialog>
 */

export type DialogSize = "sm" | "md" | "lg" | "xl" | "full";

const SIZE_CLASS: Record<DialogSize, string> = {
  sm: "max-w-[400px]",
  md: "max-w-[520px]",
  lg: "max-w-[720px]",
  xl: "max-w-[960px]",
  full: "max-w-[1400px] h-[calc(100dvh-2rem)]",
};

/** Legacy `size` values were Tailwind max-width classes. */
const LEGACY_SIZE: Record<string, DialogSize> = {
  "max-w-xs": "sm",
  "max-w-sm": "sm",
  "max-w-md": "md",
  "max-w-lg": "md",
  "max-w-xl": "lg",
  "max-w-2xl": "lg",
  "max-w-3xl": "xl",
  "max-w-4xl": "xl",
  "max-w-5xl": "xl",
  "max-w-6xl": "full",
  "max-w-7xl": "full",
  "max-w-full": "full",
  "max-w-none": "full",
};

function resolveSize(size: string | undefined): { size: DialogSize; extra?: string } {
  if (!size) return { size: "md" };
  if (size in SIZE_CLASS) return { size: size as DialogSize };
  if (size in LEGACY_SIZE) return { size: LEGACY_SIZE[size] };
  if (size.startsWith("max-w-screen")) return { size: "full" };
  // Unknown class string (e.g. "max-w-[800px]"): apply it on top of the default size.
  return { size: "md", extra: size };
}

const DialogSizeContext = createContext<string | undefined>(undefined);

type DialogProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Root> & {
  /** sm ≈400px, md ≈520px (default), lg ≈720px, xl ≈960px, full = large workspace.
   *  Legacy Tailwind classes ("max-w-2xl") are still accepted and mapped. */
  size?: DialogSize | (string & {});
};

export function Dialog({ size, children, ...props }: DialogProps) {
  return (
    <DialogPrimitive.Root {...props}>
      <DialogSizeContext.Provider value={size}>{children}</DialogSizeContext.Provider>
    </DialogPrimitive.Root>
  );
}

export const DialogTrigger = DialogPrimitive.Trigger;
/** Radix Close (use with asChild around your own button). For the corner X use <DialogClose />. */
export const DialogCloseTrigger = DialogPrimitive.Close;
export const DialogPortal = DialogPrimitive.Portal;

type ContentState = {
  layout: "panel" | "sections";
  showsClose: boolean;
  setHasBody: (v: boolean) => void;
  setCustomClose: (v: boolean) => void;
  setHasDescription: (v: boolean) => void;
};
const ContentContext = createContext<ContentState | null>(null);

function useRegister(setter: ((v: boolean) => void) | undefined) {
  useLayoutEffect(() => {
    if (!setter) return;
    setter(true);
    return () => setter(false);
  }, [setter]);
}

/** The corner close button (rendered last so initial focus lands on the first field, not on X). */
function CornerClose({ onClose }: { onClose?: () => void }) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label="Close"
      className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
      onClick={onClose}
    >
      <X aria-hidden="true" className="h-4 w-4" />
    </Button>
  );
  return onClose ? button : <DialogPrimitive.Close asChild>{button}</DialogPrimitive.Close>;
}

type DialogContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  /** Overrides the size given on <Dialog>. */
  size?: DialogSize;
  /** Hide the corner X (e.g. confirmations that already have Cancel). */
  hideClose?: boolean;
  overlayClassName?: string;
};

export const DialogContent = forwardRef<ElementRef<typeof DialogPrimitive.Content>, DialogContentProps>(
  ({ className, children, size: sizeProp, hideClose = false, overlayClassName, onCloseAutoFocus, ...props }, ref) => {
    trackFocusForReturn();
    const rootSize = useContext(DialogSizeContext);
    const { size, extra } = resolveSize(sizeProp ?? rootSize);
    const [hasBody, setHasBody] = useState(false);
    const [customClose, setCustomClose] = useState(false);
    const [hasDescription, setHasDescription] = useState(false);
    const layout = hasBody ? "sections" : "panel";
    const showsClose = !hideClose || customClose;

    const ctx = useMemo<ContentState>(
      () => ({ layout, showsClose, setHasBody, setCustomClose, setHasDescription }),
      [layout, showsClose],
    );

    return (
      <DialogPrimitive.Portal>
        {/* Scrollable overlay: the panel is centred inside it and never exceeds the viewport. */}
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-overlay/50 p-4 motion-safe:animate-overlay-in",
            overlayClassName,
          )}
        >
          <DialogPrimitive.Content
            ref={ref}
            // Without a <DialogDescription>, opt out of aria-describedby (silences Radix's warning).
            {...(hasDescription ? {} : { "aria-describedby": undefined })}
            className={cn(
              "relative w-full max-h-[calc(100dvh-2rem)] rounded-xl border border-border bg-popover text-popover-foreground shadow-lg",
              "focus:outline-none motion-safe:animate-content-in",
              SIZE_CLASS[size],
              extra,
              layout === "panel" ? "overflow-y-auto p-6" : "flex flex-col overflow-hidden p-0",
              className,
            )}
            onCloseAutoFocus={withFocusReturn(onCloseAutoFocus)}
            {...props}
          >
            <ContentContext.Provider value={ctx}>
              {children}
              {!hideClose && !customClose && <CornerClose />}
            </ContentContext.Provider>
          </DialogPrimitive.Content>
        </DialogPrimitive.Overlay>
      </DialogPrimitive.Portal>
    );
  },
);
DialogContent.displayName = "DialogContent";

type DivProps = HTMLAttributes<HTMLDivElement>;

export function DialogHeader({ className, ...props }: DivProps) {
  const ctx = useContext(ContentContext);
  const sections = ctx?.layout === "sections";
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col gap-1",
        sections ? "border-b border-border px-6 py-4" : "mb-4",
        className,
        // Keep text clear of the corner close button whatever padding the caller set.
        ctx?.showsClose && (sections ? "pr-14" : "pr-8"),
      )}
      {...props}
    />
  );
}

type DialogBodyProps = DivProps & {
  /** Remove the body's padding (e.g. an edge-to-edge table). */
  flush?: boolean;
};

/** Scrollable middle section. Its presence switches DialogContent to the sections layout. */
export function DialogBody({ className, flush = false, ...props }: DialogBodyProps) {
  const ctx = useContext(ContentContext);
  useRegister(ctx?.setHasBody);
  return (
    <div
      className={cn(
        "min-h-0 flex-1 overflow-y-auto",
        !flush && "py-4",
        className,
        // Horizontal inset always matches the header/footer bands.
        !flush && "px-6",
      )}
      {...props}
    />
  );
}

export function DialogFooter({ className, ...props }: DivProps) {
  const ctx = useContext(ContentContext);
  const sections = ctx?.layout === "sections";
  return (
    <div
      className={cn(
        "flex shrink-0 flex-wrap items-center justify-end gap-2",
        sections ? "border-t border-border px-6 py-4" : "mt-6",
        className,
      )}
      {...props}
    />
  );
}

export const DialogTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold leading-6 text-foreground", className)}
    {...props}
  />
));
DialogTitle.displayName = "DialogTitle";

export const DialogDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => {
  const ctx = useContext(ContentContext);
  useRegister(ctx?.setHasDescription);
  return <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />;
});
DialogDescription.displayName = "DialogDescription";

/**
 * Legacy corner close button. Replaces the built-in X (no duplicates). Without `onClose`
 * it closes through the Dialog's onOpenChange.
 */
export function DialogClose({ onClose }: { onClose?: () => void }) {
  const ctx = useContext(ContentContext);
  useRegister(ctx?.setCustomClose);
  return <CornerClose onClose={onClose} />;
}
