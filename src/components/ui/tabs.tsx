import {
  createContext,
  forwardRef,
  useContext,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from "react";
import { Tabs as TabsPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/*
 * One Tabs component, two looks:
 *  - underline (default): page sections, monitoring views, dialogs.
 *  - segmented: small inline filters (All / Agents / Trainees).
 *
 *   <Tabs value={tab} onValueChange={setTab} variant="underline">
 *     <TabsList aria-label="Logs">
 *       <TabsTrigger value="activity">Activity</TabsTrigger>
 *       <TabsTrigger value="errors" count={12}>Errors</TabsTrigger>
 *     </TabsList>
 *     <TabsContent value="activity">…</TabsContent>
 *   </Tabs>
 *
 * TabsContent is optional: tabs can drive state that renders elsewhere.
 */

export type TabsVariant = "underline" | "segmented";

const VariantContext = createContext<TabsVariant>("underline");

type TabsProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Root> & { variant?: TabsVariant };

export const Tabs = forwardRef<ElementRef<typeof TabsPrimitive.Root>, TabsProps>(
  ({ variant = "underline", className, ...props }, ref) => (
    <VariantContext.Provider value={variant}>
      <TabsPrimitive.Root ref={ref} className={cn("flex flex-col gap-4", variant === "segmented" && "gap-3", className)} {...props} />
    </VariantContext.Provider>
  ),
);
Tabs.displayName = "Tabs";

export const TabsList = forwardRef<
  ElementRef<typeof TabsPrimitive.List>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => {
  const variant = useContext(VariantContext);
  return (
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        variant === "underline"
          ? "flex items-center gap-5 overflow-x-auto border-b border-border"
          : "inline-flex w-fit items-center gap-0.5 rounded-md border border-border bg-muted p-0.5",
        className,
      )}
      {...props}
    />
  );
});
TabsList.displayName = "TabsList";

type TabsTriggerProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger> & {
  /** Optional count shown after the label (e.g. results per tab). */
  count?: ReactNode;
};

export const TabsTrigger = forwardRef<ElementRef<typeof TabsPrimitive.Trigger>, TabsTriggerProps>(
  ({ className, count, children, ...props }, ref) => {
    const variant = useContext(VariantContext);
    return (
      <TabsPrimitive.Trigger
        ref={ref}
        className={cn(
          "group inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-50 [&>svg]:h-4 [&>svg]:w-4",
          variant === "underline"
            ? "-mb-px h-10 border-b-2 border-transparent px-0.5 text-sm text-muted-foreground hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground"
            : "h-7 rounded-[5px] px-2.5 text-ui text-muted-foreground hover:text-foreground data-[state=active]:bg-surface data-[state=active]:text-foreground data-[state=active]:shadow-xs",
          className,
        )}
        {...props}
      >
        {children}
        {count != null && (
          <span
            className={cn(
              "inline-flex min-w-5 items-center justify-center rounded-sm px-1 text-xs font-medium tabular-nums",
              "bg-muted text-muted-foreground group-data-[state=active]:bg-primary-muted group-data-[state=active]:text-primary-muted-foreground",
              variant === "segmented" && "bg-surface-muted",
            )}
          >
            {count}
          </span>
        )}
      </TabsPrimitive.Trigger>
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

export const TabsContent = forwardRef<
  ElementRef<typeof TabsPrimitive.Content>,
  ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 rounded-sm", className)}
    {...props}
  />
));
TabsContent.displayName = "TabsContent";
