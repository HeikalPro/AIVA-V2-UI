import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Inbox } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export type Column<T> = {
  key: string;
  header: string;
  render?: (row: T) => React.ReactNode;
  /** Applied to both header and body cells unless overridden */
  className?: string;
  headClassName?: string;
  cellClassName?: string;
  sortable?: boolean;
  sortValue?: (row: T) => unknown;
};

type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  keyFn: (row: T) => string | number;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  /** Cap the table body height (CSS length) so long lists scroll in place instead of growing the page. */
  maxHeight?: string;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

function defaultCompare(a: unknown, b: unknown) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

export function DataTable<T>({
  columns,
  data,
  keyFn,
  emptyMessage = "No data",
  onRowClick,
  loading,
  maxHeight,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);

  const sortedData = useMemo(() => {
    if (!sort) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortable) return data;
    const decorated = data.map((row, idx) => ({ row, idx }));
    decorated.sort((a, b) => {
      const base = defaultCompare(
        col.sortValue ? col.sortValue(a.row) : (a.row as Record<string, unknown>)[col.key],
        col.sortValue ? col.sortValue(b.row) : (b.row as Record<string, unknown>)[col.key],
      );
      return sort.dir === "asc" ? base : -base || a.idx - b.idx;
    });
    return decorated.map((d) => d.row);
  }, [columns, data, sort]);

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-12 text-center text-sm text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      <div className="overflow-auto rounded-t-lg" style={maxHeight ? { maxHeight } : undefined}>
      <Table className="min-w-full">
        <TableHeader className={maxHeight ? "sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgb(226_232_240)]" : ""}>
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => {
              const isSorted = sort?.key === col.key;
              const icon = !col.sortable ? null : isSorted && sort?.dir === "asc" ? (
                <ChevronUp className="h-3.5 w-3.5 text-primary" />
              ) : isSorted && sort?.dir === "desc" ? (
                <ChevronDown className="h-3.5 w-3.5 text-primary" />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5 text-slate-300" />
              );
              return (
                <TableHead key={col.key} className={col.headClassName ?? col.className}>
                  {col.sortable ? (
                    <button
                      type="button"
                      className="flex w-full items-center gap-1.5 text-left"
                      onClick={() =>
                        setSort((prev) => {
                          if (!prev || prev.key !== col.key) return { key: col.key, dir: "asc" };
                          return prev.dir === "asc" ? { key: col.key, dir: "desc" } : null;
                        })
                      }
                    >
                      <span>{col.header}</span>
                      {icon}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedData.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="h-32 text-center">
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <Inbox className="h-8 w-8 stroke-[1.5]" />
                  <p className="text-sm">{emptyMessage}</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            sortedData.map((row) => (
              <TableRow
                key={keyFn(row)}
                className={`group ${onRowClick ? "cursor-pointer" : ""}`}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <TableCell key={col.key} className={col.cellClassName ?? col.className}>
                    {col.render ? col.render(row) : ((row as Record<string, unknown>)[col.key] as React.ReactNode)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      </div>
      {sortedData.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50/50 px-3 py-1.5">
          <p className="text-xs text-slate-400">
            {sortedData.length} {sortedData.length === 1 ? "row" : "rows"}
          </p>
        </div>
      )}
    </div>
  );
}
