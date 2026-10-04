import { forwardRef } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input, type InputProps } from "./input";
import { splitLayoutClassName } from "./layout-classes";

export interface SearchInputProps extends Omit<InputProps, "type"> {
  /** When provided, a clear (×) button appears while the field has a value. */
  onClear?: () => void;
  /** Classes for the outer wrapper. Layout classes in `className` (w-*, m*-, flex-1 …) also go there. */
  wrapperClassName?: string;
}

/** Search field with a leading magnifier and optional clear button. Defaults to aria-label="Search". */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, wrapperClassName, onClear, controlSize = "md", value, placeholder = "Search…", ...props }, ref) => {
    const { layout, control } = splitLayoutClassName(className);
    const showClear = Boolean(onClear) && value != null && String(value).length > 0;
    return (
      <div className={cn("relative w-full", layout, wrapperClassName)}>
        <Search
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-subtle-foreground",
            controlSize === "sm" ? "left-2.5 h-3.5 w-3.5" : "left-3 h-4 w-4",
          )}
        />
        <Input
          ref={ref}
          type="search"
          aria-label={props["aria-label"] ?? (props["aria-labelledby"] ? undefined : "Search")}
          controlSize={controlSize}
          value={value}
          placeholder={placeholder}
          className={cn(
            controlSize === "sm" ? "pl-8" : "pl-9",
            showClear && "pr-8",
            "[&::-webkit-search-cancel-button]:appearance-none",
            control,
          )}
          {...props}
        />
        {showClear && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={onClear}
            className="absolute right-1.5 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  },
);
SearchInput.displayName = "SearchInput";
