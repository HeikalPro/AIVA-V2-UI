import { forwardRef, type HTMLAttributes, type TdHTMLAttributes, type ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /**
   * Skip the built-in horizontal-scroll wrapper. Use when a parent element is the scroll
   * container (sticky headers only stick to their nearest scrolling ancestor).
   */
  noWrapper?: boolean;
  /** Classes for the scroll wrapper (ignored with noWrapper). */
  wrapperClassName?: string;
}

const Table = forwardRef<HTMLTableElement, TableProps>(({ className, noWrapper = false, wrapperClassName, ...props }, ref) => {
  const table = <table ref={ref} className={cn("w-full caption-bottom border-collapse text-ui", className)} {...props} />;
  if (noWrapper) return table;
  return <div className={cn("relative w-full overflow-x-auto", wrapperClassName)}>{table}</div>;
});
Table.displayName = "Table";

const TableHeader = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={cn("[&_tr]:border-b [&_tr]:border-border", className)} {...props} />,
);
TableHeader.displayName = "TableHeader";

const TableBody = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />,
);
TableBody.displayName = "TableBody";

const TableFooter = forwardRef<HTMLTableSectionElement, HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot
      ref={ref}
      className={cn("border-t border-border bg-surface-muted font-medium [&>tr]:last:border-b-0", className)}
      {...props}
    />
  ),
);
TableFooter.displayName = "TableFooter";

/** Rows highlight on hover; set data-state="selected" (or aria-selected) for the selected style. */
const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-border transition-colors hover:bg-muted/50 data-[state=selected]:bg-primary-muted aria-selected:bg-primary-muted",
      className,
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 whitespace-nowrap px-3 text-left align-middle text-xs font-medium text-muted-foreground",
      "[&:has([role=checkbox])]:w-10 [&:has([role=checkbox])]:pr-0",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn("h-10 px-3 py-2 align-middle text-ui text-foreground [&:has([role=checkbox])]:pr-0", className)}
    {...props}
  />
));
TableCell.displayName = "TableCell";

const TableCaption = forwardRef<HTMLTableCaptionElement, HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn("mt-3 text-sm text-muted-foreground", className)} {...props} />
  ),
);
TableCaption.displayName = "TableCaption";

export { Table, TableHeader, TableBody, TableFooter, TableRow, TableHead, TableCell, TableCaption };
