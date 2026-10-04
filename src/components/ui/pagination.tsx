import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { Button } from "./button";
import { Select } from "./select";

type PaginationProps = {
  /** Current page, 1-based. */
  page: number;
  pageSize: number;
  /** Total number of items across all pages. */
  total: number;
  onPageChange: (page: number) => void;
  /** Offer a rows-per-page selector (requires onPageSizeChange). */
  pageSizeOptions?: number[];
  onPageSizeChange?: (pageSize: number) => void;
  /** Plural noun for the summary, e.g. "users" → "1–25 of 423 users". */
  itemLabel?: string;
  /** Pages shown on each side of the current page (default 1). */
  siblingCount?: number;
  className?: string;
};

type PageItem = number | "ellipsis-left" | "ellipsis-right";

function pageItems(current: number, count: number, siblings: number): PageItem[] {
  const totalSlots = siblings * 2 + 5; // first, last, current, 2 ellipses
  if (count <= totalSlots) return Array.from({ length: count }, (_, i) => i + 1);
  const left = Math.max(current - siblings, 2);
  const right = Math.min(current + siblings, count - 1);
  const items: PageItem[] = [1];
  if (left > 2) items.push("ellipsis-left");
  else for (let p = 2; p < left; p++) items.push(p);
  for (let p = left; p <= right; p++) items.push(p);
  if (right < count - 1) items.push("ellipsis-right");
  else for (let p = right + 1; p < count; p++) items.push(p);
  items.push(count);
  return items;
}

/**
 * The one pagination control for the app: "1–25 of 423 users", optional rows-per-page,
 * Previous / page numbers (with ellipsis) / Next.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
  itemLabel,
  siblingCount = 1,
  className,
}: PaginationProps) {
  const size = Math.max(1, pageSize);
  const pageCount = Math.max(1, Math.ceil(Math.max(0, total) / size));
  const current = Math.min(Math.max(1, page), pageCount);
  const from = total === 0 ? 0 : (current - 1) * size + 1;
  const to = Math.min(total, current * size);
  const noun = itemLabel ? ` ${itemLabel}` : "";
  const go = (p: number) => {
    const next = Math.min(Math.max(1, p), pageCount);
    if (next !== current) onPageChange(next);
  };

  return (
    <nav aria-label="Pagination" className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-ui", className)}>
      <div className="flex items-center gap-4">
        <p className="tabular-nums text-muted-foreground" aria-live="polite">
          {total === 0 ? (
            <>0{noun}</>
          ) : (
            <>
              <span className="font-medium text-foreground">
                {formatNumber(from)}–{formatNumber(to)}
              </span>{" "}
              of {formatNumber(total)}
              {noun}
            </>
          )}
        </p>
        {pageSizeOptions && pageSizeOptions.length > 0 && onPageSizeChange && (
          <label className="flex items-center gap-2 text-muted-foreground">
            <span className="whitespace-nowrap">Rows per page</span>
            <Select
              controlSize="sm"
              className="w-[4.5rem]"
              value={size}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
            >
              {pageSizeOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </Select>
          </label>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={() => go(current - 1)} disabled={current <= 1} className="px-2">
          <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          Previous
        </Button>
        <ul className="hidden items-center gap-1 sm:flex">
          {pageItems(current, pageCount, siblingCount).map((item) =>
            typeof item === "number" ? (
              <li key={item}>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Page ${item}`}
                  aria-current={item === current ? "page" : undefined}
                  onClick={() => go(item)}
                  className={cn(
                    "min-w-8 px-2 tabular-nums",
                    item === current &&
                      "bg-primary-muted font-semibold text-primary-muted-foreground hover:bg-primary-muted hover:text-primary-muted-foreground",
                  )}
                >
                  {item}
                </Button>
              </li>
            ) : (
              <li key={item} aria-hidden="true" className="px-1 text-subtle-foreground">
                …
              </li>
            ),
          )}
        </ul>
        <span className="px-2 tabular-nums text-muted-foreground sm:hidden">
          {current} / {pageCount}
        </span>
        <Button variant="ghost" size="sm" onClick={() => go(current + 1)} disabled={current >= pageCount} className="px-2">
          Next
          <ChevronRight aria-hidden="true" className="h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
