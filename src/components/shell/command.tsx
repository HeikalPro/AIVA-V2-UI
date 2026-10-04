import { forwardRef, type ComponentPropsWithoutRef, type ElementRef } from "react";
import { Command as CommandPrimitive } from "cmdk";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

/*
 * Token-styled cmdk parts shared by the command palette and the workspace filter.
 * (cmdk = accessible combobox/listbox with arrow keys, Enter and type-to-filter.)
 */

/**
 * Case-insensitive substring match over the item's keywords (its `value` is only an id).
 * Every whitespace-separated term must appear; earlier / word-start matches rank higher.
 */
export function matchScore(haystack: string, search: string): number {
  const terms = search.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return 1;
  const text = haystack.toLowerCase();
  let score = 1;
  for (const term of terms) {
    const index = text.indexOf(term);
    if (index < 0) return 0;
    const wordStart = index === 0 || /[\s\-_/@.&(]/.test(text[index - 1]);
    score *= index === 0 ? 1 : wordStart ? 0.9 : 0.6;
  }
  return score;
}

export function keywordFilter(_value: string, search: string, keywords?: string[]): number {
  return matchScore((keywords ?? []).join(" "), search);
}

export const Command = forwardRef<
  ElementRef<typeof CommandPrimitive>,
  ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, filter = keywordFilter, vimBindings = false, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    filter={filter}
    vimBindings={vimBindings}
    className={cn("flex h-full w-full flex-col overflow-hidden text-popover-foreground", className)}
    {...props}
  />
));
Command.displayName = "Command";

type CommandInputProps = ComponentPropsWithoutRef<typeof CommandPrimitive.Input> & {
  wrapperClassName?: string;
};

/** Borderless search row (magnifier + input) for the top of a command surface. */
export const CommandInput = forwardRef<ElementRef<typeof CommandPrimitive.Input>, CommandInputProps>(
  ({ className, wrapperClassName, ...props }, ref) => (
    <div className={cn("flex items-center gap-2 border-b border-border px-3", wrapperClassName)}>
      <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-subtle-foreground" />
      <CommandPrimitive.Input
        ref={ref}
        className={cn(
          "h-11 w-full min-w-0 bg-transparent text-sm text-foreground outline-none placeholder:text-subtle-foreground",
          "focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
    </div>
  ),
);
CommandInput.displayName = "CommandInput";

export const CommandList = forwardRef<
  ElementRef<typeof CommandPrimitive.List>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn("overflow-y-auto overflow-x-hidden overscroll-contain p-1.5", className)}
    {...props}
  />
));
CommandList.displayName = "CommandList";

export const CommandEmpty = forwardRef<
  ElementRef<typeof CommandPrimitive.Empty>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Empty
    ref={ref}
    className={cn("px-3 py-8 text-center text-sm text-muted-foreground", className)}
    {...props}
  />
));
CommandEmpty.displayName = "CommandEmpty";

export const CommandGroup = forwardRef<
  ElementRef<typeof CommandPrimitive.Group>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      "overflow-hidden [&:not(:first-child)]:mt-1",
      "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground",
      className,
    )}
    {...props}
  />
));
CommandGroup.displayName = "CommandGroup";

export const CommandItem = forwardRef<
  ElementRef<typeof CommandPrimitive.Item>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex min-h-9 cursor-pointer select-none items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-foreground outline-none",
      "data-[selected=true]:bg-accent data-[selected=true]:text-accent-foreground",
      "data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50",
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = "CommandItem";

export const CommandLoading = CommandPrimitive.Loading;
