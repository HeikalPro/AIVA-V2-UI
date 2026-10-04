import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { DropdownMenu as MenuPrimitive } from "radix-ui";
import { Check, ChevronRight, Circle, MoreVertical, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconButton } from "./icon-button";

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuGroup = MenuPrimitive.Group;
export const DropdownMenuSub = MenuPrimitive.Sub;
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;

const CONTENT =
  "z-50 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-md motion-safe:animate-overlay-in";

const ITEM =
  "relative flex cursor-default select-none items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none transition-colors " +
  "focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 " +
  "[&>svg]:h-4 [&>svg]:w-4 [&>svg]:shrink-0";

export const DropdownMenuContent = forwardRef<
  ElementRef<typeof MenuPrimitive.Content>,
  ComponentPropsWithoutRef<typeof MenuPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.Content ref={ref} sideOffset={sideOffset} className={cn(CONTENT, className)} {...props} />
  </MenuPrimitive.Portal>
));
DropdownMenuContent.displayName = "DropdownMenuContent";

type ItemProps = ComponentPropsWithoutRef<typeof MenuPrimitive.Item> & {
  /** Optional leading lucide icon. */
  icon?: LucideIcon;
  /** Red styling for destructive actions (still confirm with ConfirmDialog). */
  destructive?: boolean;
  /** Indent to align with items that have icons/indicators. */
  inset?: boolean;
  /** Right-aligned hint, e.g. a keyboard shortcut. */
  shortcut?: ReactNode;
};

export const DropdownMenuItem = forwardRef<ElementRef<typeof MenuPrimitive.Item>, ItemProps>(
  ({ className, icon: Icon, destructive, inset, shortcut, children, ...props }, ref) => (
    <MenuPrimitive.Item
      ref={ref}
      className={cn(
        ITEM,
        inset && "pl-8",
        destructive && "text-danger focus:bg-danger-muted focus:text-danger",
        className,
      )}
      {...props}
    >
      {Icon && <Icon aria-hidden="true" className={cn(!destructive && "text-muted-foreground")} />}
      {children}
      {shortcut != null && <DropdownMenuShortcut>{shortcut}</DropdownMenuShortcut>}
    </MenuPrimitive.Item>
  ),
);
DropdownMenuItem.displayName = "DropdownMenuItem";

export const DropdownMenuCheckboxItem = forwardRef<
  ElementRef<typeof MenuPrimitive.CheckboxItem>,
  ComponentPropsWithoutRef<typeof MenuPrimitive.CheckboxItem>
>(({ className, children, ...props }, ref) => (
  <MenuPrimitive.CheckboxItem ref={ref} className={cn(ITEM, "pl-8", className)} {...props}>
    <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
      <MenuPrimitive.ItemIndicator>
        <Check aria-hidden="true" className="h-4 w-4 text-primary" />
      </MenuPrimitive.ItemIndicator>
    </span>
    {children}
  </MenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = "DropdownMenuCheckboxItem";

export const DropdownMenuRadioItem = forwardRef<
  ElementRef<typeof MenuPrimitive.RadioItem>,
  ComponentPropsWithoutRef<typeof MenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <MenuPrimitive.RadioItem ref={ref} className={cn(ITEM, "pl-8", className)} {...props}>
    <span className="absolute left-2 flex h-4 w-4 items-center justify-center">
      <MenuPrimitive.ItemIndicator>
        <Circle aria-hidden="true" className="h-2 w-2 fill-primary text-primary" />
      </MenuPrimitive.ItemIndicator>
    </span>
    {children}
  </MenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = "DropdownMenuRadioItem";

export const DropdownMenuLabel = forwardRef<
  ElementRef<typeof MenuPrimitive.Label>,
  ComponentPropsWithoutRef<typeof MenuPrimitive.Label> & { inset?: boolean }
>(({ className, inset, ...props }, ref) => (
  <MenuPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-xs font-medium text-muted-foreground", inset && "pl-8", className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = "DropdownMenuLabel";

export const DropdownMenuSeparator = forwardRef<
  ElementRef<typeof MenuPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof MenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <MenuPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-border", className)} {...props} />
));
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export function DropdownMenuShortcut({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("ml-auto pl-4 text-xs text-muted-foreground", className)} {...props} />;
}

export const DropdownMenuSubTrigger = forwardRef<
  ElementRef<typeof MenuPrimitive.SubTrigger>,
  ComponentPropsWithoutRef<typeof MenuPrimitive.SubTrigger> & { icon?: LucideIcon; inset?: boolean }
>(({ className, icon: Icon, inset, children, ...props }, ref) => (
  <MenuPrimitive.SubTrigger
    ref={ref}
    className={cn(ITEM, "data-[state=open]:bg-accent", inset && "pl-8", className)}
    {...props}
  >
    {Icon && <Icon aria-hidden="true" className="text-muted-foreground" />}
    {children}
    <ChevronRight aria-hidden="true" className="ml-auto text-muted-foreground" />
  </MenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = "DropdownMenuSubTrigger";

export const DropdownMenuSubContent = forwardRef<
  ElementRef<typeof MenuPrimitive.SubContent>,
  ComponentPropsWithoutRef<typeof MenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <MenuPrimitive.Portal>
    <MenuPrimitive.SubContent ref={ref} className={cn(CONTENT, className)} {...props} />
  </MenuPrimitive.Portal>
));
DropdownMenuSubContent.displayName = "DropdownMenuSubContent";

// ---------------------------------------------------------------------------------------------
// RowActionsMenu: the standard "⋮" menu for table rows.
// ---------------------------------------------------------------------------------------------

export type RowAction = {
  label: string;
  onSelect: () => void;
  icon?: LucideIcon;
  destructive?: boolean;
  disabled?: boolean;
  /** Skip the item entirely (e.g. permission-gated). */
  hidden?: boolean;
  /** Draw a separator above this item. */
  separatorBefore?: boolean;
};

type RowActionsMenuProps = {
  items?: RowAction[];
  /** Custom menu content (DropdownMenuItem …) instead of / after `items`. */
  children?: ReactNode;
  /** Accessible name + tooltip of the trigger. */
  label?: string;
  align?: "start" | "center" | "end";
  disabled?: boolean;
  triggerClassName?: string;
  contentClassName?: string;
};

/**
 * `⋮` actions menu for table rows. Clicks inside never reach the row's onClick
 * (React events bubble through portals, so they are stopped here).
 */
export function RowActionsMenu({
  items = [],
  children,
  label = "Actions",
  align = "end",
  disabled,
  triggerClassName,
  contentClassName,
}: RowActionsMenuProps) {
  const visible = items.filter((item) => !item.hidden);
  if (visible.length === 0 && !children) return null;
  const stop = (event: { stopPropagation: () => void }) => event.stopPropagation();
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <IconButton
          label={label}
          icon={MoreVertical}
          size="sm"
          className={triggerClassName}
          onClick={stop}
          onKeyDown={stop}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className={contentClassName} onClick={stop} onKeyDown={stop}>
        {visible.map((item) => (
          <MenuEntry key={item.label} item={item} />
        ))}
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuEntry({ item }: { item: RowAction }) {
  return (
    <>
      {item.separatorBefore && <DropdownMenuSeparator />}
      <DropdownMenuItem
        icon={item.icon}
        destructive={item.destructive}
        disabled={item.disabled}
        onSelect={() => item.onSelect()}
      >
        {item.label}
      </DropdownMenuItem>
    </>
  );
}
