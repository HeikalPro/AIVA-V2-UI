import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown, Columns3, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  RowActionsMenu,
  type RowAction,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "./empty-state";
import { countLabel } from "./count-label";

/* =============================================================================================
 * Types
 * ============================================================================================= */

export type RowKey = string | number;
export type SortDirection = "asc" | "desc";
/** Current sort: column key + direction, or null (data order). */
export type SortState = { key: string; dir: SortDirection } | null;
export type ColumnAlign = "left" | "center" | "right";
export type TableDensity = "comfortable" | "compact";

/**
 * One table column.
 *
 * ```ts
 * const columns: Column<User>[] = [
 *   { key: "name", header: "Name", sortable: true, render: (u) => u.full_name, truncate: true },
 *   { key: "sessions", header: "Sessions", numeric: true, sortable: true },
 *   actionsColumn((u) => [{ label: "Edit", onSelect: () => edit(u) }]),
 * ];
 * ```
 */
export type Column<T> = {
  /** Unique id. Without `render`, the cell shows `row[key]`; without `sortValue`, sorting uses `row[key]`. */
  key: string;
  /** Header content. Plain strings are preferred (sentence case: "Last login"). */
  header: ReactNode;
  /** Name in the "Columns" menu when `header` is not a string. */
  label?: string;
  /** Cell content. Defaults to `row[key]`. */
  render?: (row: T) => ReactNode;
  /** Applied to both header and body cells unless overridden by headClassName / cellClassName. */
  className?: string;
  headClassName?: string;
  cellClassName?: string;
  /** Tri-state sort on header click: ascending → descending → off. */
  sortable?: boolean;
  /** Value used for sorting (defaults to `row[key]`). Numbers compare numerically, strings naturally. */
  sortValue?: (row: T) => unknown;
  /** Text alignment of header + cells. Default "left" ("right" when `numeric`). */
  align?: ColumnAlign;
  /** Numeric column: tabular figures, right-aligned unless `align` says otherwise. */
  numeric?: boolean;
  /** Fixed/preferred column width (CSS length or px number), set on the header cell. */
  width?: string | number;
  /** Minimum column width (CSS length or px number). */
  minWidth?: string | number;
  /** Cap the cell content width; long content is truncated with an ellipsis and a `title` tooltip. */
  maxWidth?: string | number;
  /** Truncate long content to one line (max width = `maxWidth` or 18rem) with a `title` tooltip. */
  truncate?: boolean;
  /** Tooltip text for truncated cells (default: the cell text when it is a string/number). */
  cellTitle?: (row: T) => string | undefined;
  /** Column can be hidden from the "Columns" menu (default true). */
  hideable?: boolean;
  /** Start hidden when column visibility is enabled. */
  defaultHidden?: boolean;
};

/** Empty-state content shown in the table body. */
export type DataTableEmpty = {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  /** e.g. <Button variant="outline" size="sm" onClick={clearFilters}>Clear filters</Button> */
  action?: ReactNode;
};

/** Client pagination options (the default mode). */
export type ClientPaginationOptions = {
  mode?: "client";
  /** Initial page size (default: first of pageSizeOptions = 25). */
  pageSize?: number;
  /** Rows-per-page choices (default [25, 50, 100]). */
  pageSizeOptions?: number[];
};

/** Server pagination: `data` is the current page; the page owns page/pageSize/total. */
export type ServerPaginationOptions = {
  mode: "server";
  /** 1-based page. With limit/offset APIs: page = offset / limit + 1. */
  page: number;
  pageSize: number;
  /** Total rows across all pages. */
  total: number;
  onPageChange: (page: number) => void;
  /** Enables the rows-per-page select. */
  onPageSizeChange?: (pageSize: number) => void;
  pageSizeOptions?: number[];
};

export type DataTablePagination = boolean | ClientPaginationOptions | ServerPaginationOptions;

export type DataTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  /** Stable unique key per row (also the selection key). */
  keyFn: (row: T) => RowKey;

  /* ---- states ---- */
  /** First load: header stays visible, body shows skeleton rows. */
  loading?: boolean;
  /** Number of skeleton rows while loading (default 6). */
  skeletonRows?: number;
  /**
   * Empty body. Pass different content for "no data yet" vs "no results for these filters", e.g.
   * `empty={hasFilters ? { title: "No users match these filters", action: clearButton } : { title: "No users yet" }}`.
   */
  empty?: DataTableEmpty;
  /** Legacy: empty title text (used when `empty` is not given). */
  emptyMessage?: string;

  /* ---- rows ---- */
  /** Makes rows clickable (pointer, focusable, Enter/Space). Clicks on buttons, links, inputs, menus and checkboxes inside the row are ignored. */
  onRowClick?: (row: T) => void;
  /** Extra classes per row. */
  rowClassName?: (row: T) => string | undefined;
  /** Accessible name of the row, used by the selection checkbox ("Select Rana Ali"). */
  rowLabel?: (row: T) => string;
  /** Row height: comfortable ≈ 40px (default), compact ≈ 32px. */
  density?: TableDensity;

  /* ---- sorting ---- */
  /** Initial sort (uncontrolled). */
  defaultSort?: SortState;
  /** Controlled sort. Use with onSortChange. */
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  /** Data is already sorted (e.g. by the server): headers still toggle `sort`, rows are not re-ordered. */
  manualSorting?: boolean;

  /* ---- pagination ---- */
  /**
   * Default: client pagination, 25 rows per page (25/50/100), reset to page 1 when the row set or sort changes.
   * `false` disables it (all rows, footer shows the count). `{ mode: "server", … }` for API-paged lists.
   */
  pagination?: DataTablePagination;
  /** Plural noun for counts: "users" → "423 users", "1–25 of 423 users" (default "rows"). */
  itemLabel?: string;
  /** Singular noun when the default ("users" → "user") is wrong. */
  itemLabelSingular?: string;
  /** Reset to page 1 when the set of row keys or the sort changes (default true). */
  autoResetPage?: boolean;

  /* ---- selection ---- */
  /** Adds a checkbox column + header "select page" checkbox. */
  selectable?: boolean;
  /** Controlled selection (row keys). Omit for internal state. */
  selectedKeys?: ReadonlyArray<RowKey>;
  /** Called with the new key list and the matching rows from `data`. */
  onSelectionChange?: (keys: RowKey[], rows: T[]) => void;
  /** Rows that cannot be selected get a disabled checkbox. */
  isRowSelectable?: (row: T) => boolean;
  /** Bulk-action bar content shown while ≥ 1 row is selected (rows from current `data`). */
  bulkActions?: (selectedRows: T[], clearSelection: () => void) => ReactNode;

  /* ---- columns ---- */
  /** Adds a "Columns" menu (checkbox per hideable column) to the toolbar row. */
  enableColumnVisibility?: boolean;
  /** localStorage key to remember hidden columns (e.g. "users"). */
  persistKey?: string;

  /* ---- layout ---- */
  /** Rendered above the table inside the same border (put a <FilterBar /> here). */
  toolbar?: ReactNode;
  /** Right side of the toolbar row, before the Columns menu (Export, Refresh …). */
  toolbarEnd?: ReactNode;
  /** Cap the table height (CSS length) so long lists scroll in place; the header sticks. */
  maxHeight?: string;
  /** Sticky header. Needs a bounded scroll area: uses `maxHeight` or defaults to 70vh. */
  stickyHeader?: boolean;
  /** Outer border + radius (default true). Use false inside a Card that already has a border. */
  bordered?: boolean;
  /** Accessible name of the table. */
  "aria-label"?: string;
  className?: string;
  tableClassName?: string;
};

/* =============================================================================================
 * Helpers
 * ============================================================================================= */

const DEFAULT_PAGE_SIZES = [25, 50, 100];
const DEFAULT_TRUNCATE_WIDTH = "18rem";

function cssLength(value: string | number | undefined): string | undefined {
  if (value == null) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

function pxValue(value: string | number | undefined): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  const match = /^(\d+(?:\.\d+)?)px$/.exec(value.trim());
  return match ? Number(match[1]) : null;
}

function defaultCompare(a: unknown, b: unknown) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

function rawValue<T>(row: T, key: string): unknown {
  return row != null && typeof row === "object" ? (row as Record<string, unknown>)[key] : undefined;
}

function sortRows<T>(rows: T[], column: Column<T> | undefined, dir: SortDirection): T[] {
  if (!column) return rows;
  const valueOf = (row: T) => (column.sortValue ? column.sortValue(row) : rawValue(row, column.key));
  return rows
    .map((row, idx) => ({ row, idx, value: valueOf(row) }))
    .sort((a, b) => {
      // Missing values always sort last, regardless of direction.
      if (a.value == null || b.value == null) return defaultCompare(a.value, b.value) || a.idx - b.idx;
      const base = defaultCompare(a.value, b.value);
      return (dir === "asc" ? base : -base) || a.idx - b.idx;
    })
    .map((d) => d.row);
}

function alignOf<T>(col: Column<T>): ColumnAlign {
  return col.align ?? (col.numeric ? "right" : "left");
}

const ALIGN_CLASS: Record<ColumnAlign, string> = { left: "text-left", center: "text-center", right: "text-right" };

/** Elements whose clicks must not activate the row. */
const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "select",
  "textarea",
  "label",
  "summary",
  "[role=button]",
  "[role=checkbox]",
  "[role=switch]",
  "[role=menuitem]",
  "[role=link]",
  "[role=combobox]",
  "[role=tab]",
  "[contenteditable=true]",
  "[data-row-click-ignore]",
].join(",");

function isFromInteractiveChild(event: MouseEvent<HTMLElement>): boolean {
  const row = event.currentTarget;
  const target = event.target;
  if (!(target instanceof Element)) return false;
  // React bubbles events from portals (menus, dialogs opened from the row) through the row.
  if (!row.contains(target)) return true;
  const hit = target.closest(INTERACTIVE_SELECTOR);
  if (hit && hit !== row && row.contains(hit)) return true;
  // Finishing a text selection inside the row is not a click.
  const selection = typeof window !== "undefined" ? window.getSelection() : null;
  if (selection && !selection.isCollapsed && selection.anchorNode && row.contains(selection.anchorNode)) return true;
  return false;
}

function storageKey(persistKey: string) {
  return `aiva:table:${persistKey}:hidden-columns`;
}

function readHidden(persistKey: string | undefined): string[] | null {
  if (!persistKey) return null;
  try {
    const raw = localStorage.getItem(storageKey(persistKey));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : null;
  } catch {
    return null;
  }
}

function writeHidden(persistKey: string | undefined, hidden: Set<string>) {
  if (!persistKey) return;
  try {
    localStorage.setItem(storageKey(persistKey), JSON.stringify([...hidden]));
  } catch {
    // best-effort persistence
  }
}

function columnMenuLabel<T>(col: Column<T>): string {
  if (col.label) return col.label;
  if (typeof col.header === "string" && col.header.trim()) return col.header;
  return col.key;
}

/* =============================================================================================
 * actionsColumn
 * ============================================================================================= */

const DensityContext = createContext<TableDensity>("comfortable");

function RowActionsCell({ items, label }: { items: RowAction[]; label: string }) {
  const density = useContext(DensityContext);
  return (
    <div className="flex justify-end" data-row-click-ignore>
      <RowActionsMenu items={items} label={label} triggerClassName={density === "compact" ? "h-7 w-7" : undefined} />
    </div>
  );
}

export type ActionsColumnOptions<T> = {
  /** Column key (default "actions"). */
  key?: string;
  /** Accessible name of each row's ⋮ trigger (default "Actions"; e.g. (u) => `Actions for ${u.email}`). */
  label?: (row: T) => string;
};

/**
 * Right-aligned, narrow ⋮ column built on RowActionsMenu. Clicks never reach `onRowClick`.
 * Items with `hidden: true` are skipped; when no item is visible the cell stays empty.
 *
 * `actionsColumn<User>((u) => [{ label: "Edit", icon: Pencil, onSelect: () => edit(u) },
 *   { label: "Delete", icon: Trash2, destructive: true, separatorBefore: true, onSelect: () => confirm(u) }])`
 */
export function actionsColumn<T>(getActions: (row: T) => RowAction[], options: ActionsColumnOptions<T> = {}): Column<T> {
  return {
    key: options.key ?? "actions",
    header: <span className="sr-only">Actions</span>,
    label: "Actions",
    align: "right",
    width: 52,
    hideable: false,
    // No vertical padding: the 32px trigger fits the 40px row (28px in compact rows).
    className: "py-0 pl-0 pr-2",
    render: (row) => <RowActionsCell items={getActions(row)} label={options.label?.(row) ?? "Actions"} />,
  };
}

/* =============================================================================================
 * DataTable
 * ============================================================================================= */

const SKELETON_WIDTHS = ["72%", "56%", "84%", "64%", "48%", "76%"];

/**
 * The app's table: sorting, pagination (client by default, or server), selection + bulk actions,
 * column visibility, toolbar slot (FilterBar), skeleton loading, empty states, row click, sticky header.
 */
export function DataTable<T>({
  columns,
  data,
  keyFn,
  loading = false,
  skeletonRows = 6,
  empty,
  emptyMessage,
  onRowClick,
  rowClassName,
  rowLabel,
  density = "comfortable",
  defaultSort = null,
  sort: sortProp,
  onSortChange,
  manualSorting = false,
  pagination = true,
  itemLabel = "rows",
  itemLabelSingular,
  autoResetPage = true,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  isRowSelectable,
  bulkActions,
  enableColumnVisibility = false,
  persistKey,
  toolbar,
  toolbarEnd,
  maxHeight,
  stickyHeader = false,
  bordered = true,
  "aria-label": ariaLabel,
  className,
  tableClassName,
}: DataTableProps<T>) {
  /* ---- column visibility ---- */
  const defaultHidden = useMemo(
    () => columns.filter((c) => c.defaultHidden && c.hideable !== false).map((c) => c.key),
    [columns],
  );
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(readHidden(persistKey) ?? defaultHidden));
  useEffect(() => {
    if (enableColumnVisibility) writeHidden(persistKey, hidden);
  }, [enableColumnVisibility, persistKey, hidden]);

  const visibleColumns = enableColumnVisibility
    ? columns.filter((c) => c.hideable === false || !hidden.has(c.key))
    : columns;
  const hideableColumns = columns.filter((c) => c.hideable !== false);
  const visibleHideableCount = hideableColumns.filter((c) => !hidden.has(c.key)).length;

  function setColumnVisible(key: string, visible: boolean) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (visible) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  /* ---- sorting ---- */
  const [innerSort, setInnerSort] = useState<SortState>(defaultSort);
  const sort = sortProp !== undefined ? sortProp : innerSort;
  function toggleSort(key: string) {
    const next: SortState =
      !sort || sort.key !== key ? { key, dir: "asc" } : sort.dir === "asc" ? { key, dir: "desc" } : null;
    if (sortProp === undefined) setInnerSort(next);
    onSortChange?.(next);
  }
  const sortedData = useMemo(() => {
    if (!sort || manualSorting) return data;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortable) return data;
    return sortRows(data, col, sort.dir);
  }, [columns, data, sort, manualSorting]);

  /* ---- pagination ---- */
  const server = typeof pagination === "object" && pagination.mode === "server" ? pagination : null;
  const client: ClientPaginationOptions | null =
    pagination === false || server ? null : pagination === true ? {} : (pagination as ClientPaginationOptions);
  const clientSizes = client?.pageSizeOptions ?? DEFAULT_PAGE_SIZES;
  const [pageSize, setPageSize] = useState(() => client?.pageSize ?? clientSizes[0] ?? 25);

  // Reset to page 1 when the row set (keys) or the sort changes. Keyed on row keys rather than array
  // identity, so background refetches and inline `.filter()` re-renders do not jump back to page 1.
  const signature = client
    ? `${sort ? `${sort.key}:${sort.dir}` : "-"}|${pageSize}|${data.length}|${data.map(keyFn).join("\u0001")}`
    : "";
  const [pageState, setPageState] = useState({ page: 1, signature });
  if (client && autoResetPage && pageState.signature !== signature) {
    setPageState({ page: 1, signature });
  }
  const clientPageCount = Math.max(1, Math.ceil(sortedData.length / pageSize));
  const clientPage = Math.min(Math.max(1, pageState.page), clientPageCount);
  const rows = client ? sortedData.slice((clientPage - 1) * pageSize, clientPage * pageSize) : sortedData;

  /* ---- selection ---- */
  const [innerSelected, setInnerSelected] = useState<Set<RowKey>>(() => new Set());
  const selectedSet = useMemo(
    () => (selectedKeys ? new Set<RowKey>(selectedKeys) : innerSelected),
    [selectedKeys, innerSelected],
  );
  const canSelect = (row: T) => (isRowSelectable ? isRowSelectable(row) : true);
  const selectedRows = selectable ? data.filter((row) => selectedSet.has(keyFn(row))) : [];
  function commitSelection(next: Set<RowKey>) {
    if (!selectedKeys) setInnerSelected(next);
    onSelectionChange?.(
      [...next],
      data.filter((row) => next.has(keyFn(row))),
    );
  }
  function toggleRow(row: T, checked: boolean) {
    const next = new Set(selectedSet);
    if (checked) next.add(keyFn(row));
    else next.delete(keyFn(row));
    commitSelection(next);
  }
  const pageSelectable = selectable ? rows.filter(canSelect) : [];
  const pageSelectedCount = pageSelectable.filter((row) => selectedSet.has(keyFn(row))).length;
  const allPageSelected = pageSelectable.length > 0 && pageSelectedCount === pageSelectable.length;
  const headerChecked: boolean | "indeterminate" = allPageSelected ? true : pageSelectedCount > 0 ? "indeterminate" : false;
  function togglePage() {
    const next = new Set(selectedSet);
    for (const row of pageSelectable) {
      if (allPageSelected) next.delete(keyFn(row));
      else next.add(keyFn(row));
    }
    commitSelection(next);
  }
  const allSelectableRows = selectable && client ? sortedData.filter(canSelect) : [];
  const canSelectAllRows =
    client != null && allPageSelected && allSelectableRows.length > selectedRows.length;
  function selectAllRows() {
    const next = new Set(selectedSet);
    for (const row of allSelectableRows) next.add(keyFn(row));
    commitSelection(next);
  }
  function clearSelection() {
    commitSelection(new Set());
  }

  /* ---- layout ---- */
  const scrollMaxHeight = maxHeight ?? (stickyHeader ? "70vh" : undefined);
  const sticky = scrollMaxHeight != null;
  const compact = density === "compact";
  const colCount = visibleColumns.length + (selectable ? 1 : 0);
  const showToolbar = toolbar != null || toolbarEnd != null || enableColumnVisibility;
  const showBulkBar = selectable && selectedRows.length > 0;
  const emptyContent: DataTableEmpty = empty ?? { title: emptyMessage ?? "No data" };

  const headCellClass = cn(
    "bg-surface-muted shadow-[inset_0_-1px_0_hsl(var(--border))]",
    compact ? "h-8" : "h-10",
    sticky && "sticky top-0 z-[2]",
  );
  const bodyCellClass = compact ? "h-8 py-1" : "h-10 py-2";

  function cellContent(col: Column<T>, row: T): ReactNode {
    const content = col.render ? col.render(row) : (rawValue(row, col.key) as ReactNode);
    if (!col.truncate && col.maxWidth == null) return content;
    const title =
      col.cellTitle?.(row) ??
      (typeof content === "string" || typeof content === "number"
        ? String(content)
        : (() => {
            const raw = rawValue(row, col.key);
            return typeof raw === "string" || typeof raw === "number" ? String(raw) : undefined;
          })());
    return (
      <div className="truncate" style={{ maxWidth: cssLength(col.maxWidth) ?? DEFAULT_TRUNCATE_WIDTH }} title={title}>
        {content}
      </div>
    );
  }

  function handleRowClick(event: MouseEvent<HTMLTableRowElement>, row: T) {
    if (!onRowClick || isFromInteractiveChild(event)) return;
    onRowClick(row);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, row: T) {
    if (!onRowClick || event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick(row);
    }
  }

  /* ---- footer ---- */
  let footer: ReactNode = null;
  if (!loading) {
    if (server) {
      const firstPageFits = server.page <= 1 && server.total <= server.pageSize;
      if (server.total > 0 || server.page > 1) {
        footer =
          firstPageFits && !server.onPageSizeChange ? (
            <FooterCount count={server.total} label={itemLabel} singular={itemLabelSingular} />
          ) : (
            <Pagination
              page={server.page}
              pageSize={server.pageSize}
              total={server.total}
              onPageChange={server.onPageChange}
              pageSizeOptions={server.onPageSizeChange ? (server.pageSizeOptions ?? DEFAULT_PAGE_SIZES) : undefined}
              onPageSizeChange={server.onPageSizeChange}
              itemLabel={itemLabel}
            />
          );
      }
    } else if (client) {
      const total = sortedData.length;
      if (total > 0) {
        const fitsSmallestPage = total <= Math.min(...clientSizes, pageSize);
        footer = fitsSmallestPage ? (
          <FooterCount count={total} label={itemLabel} singular={itemLabelSingular} />
        ) : (
          <Pagination
            page={clientPage}
            pageSize={pageSize}
            total={total}
            onPageChange={(page) => setPageState((prev) => ({ ...prev, page }))}
            pageSizeOptions={clientSizes.length > 1 ? clientSizes : undefined}
            onPageSizeChange={(size) => setPageSize(size)}
            itemLabel={itemLabel}
          />
        );
      }
    } else if (sortedData.length > 0) {
      footer = <FooterCount count={sortedData.length} label={itemLabel} singular={itemLabelSingular} />;
    }
  }

  return (
    <DensityContext.Provider value={density}>
      <div
        className={cn(
          "flex w-full min-w-0 max-w-full flex-col bg-card text-card-foreground",
          bordered && "overflow-hidden rounded-lg border border-border",
          className,
        )}
      >
        {showToolbar && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
            <div className="min-w-0 flex-1">{toolbar}</div>
            {(toolbarEnd != null || enableColumnVisibility) && (
              <div className="ml-auto flex shrink-0 items-center gap-2">
                {toolbarEnd}
                {enableColumnVisibility && (
                  <DropdownMenu modal={false}>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Columns3 aria-hidden="true" className="h-4 w-4" />
                        Columns
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[12rem]">
                      <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                      {hideableColumns.map((col) => {
                        const visible = !hidden.has(col.key);
                        return (
                          <DropdownMenuCheckboxItem
                            key={col.key}
                            checked={visible}
                            disabled={visible && visibleHideableCount <= 1}
                            onCheckedChange={(checked) => setColumnVisible(col.key, checked === true)}
                            onSelect={(event) => event.preventDefault()}
                          >
                            {columnMenuLabel(col)}
                          </DropdownMenuCheckboxItem>
                        );
                      })}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={() => setHidden(new Set(defaultHidden))}>Reset columns</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )}
          </div>
        )}

        {showBulkBar && (
          <div
            role="region"
            aria-label="Bulk actions"
            className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-border bg-primary-muted/60 px-3 py-1.5 text-ui"
          >
            <span className="font-medium tabular-nums text-primary-muted-foreground" aria-live="polite">
              {formatNumber(selectedRows.length)} selected
            </span>
            {canSelectAllRows && (
              <Button variant="link" size="sm" className="h-7 px-0" onClick={selectAllRows}>
                Select all {countLabel(allSelectableRows.length, itemLabel, itemLabelSingular)}
              </Button>
            )}
            {bulkActions && <div className="flex flex-wrap items-center gap-2">{bulkActions(selectedRows, clearSelection)}</div>}
            <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={clearSelection}>
              Clear selection
            </Button>
          </div>
        )}

        <div
          className={cn("relative w-full min-w-0", sticky ? "overflow-auto" : "overflow-x-auto")}
          style={scrollMaxHeight ? { maxHeight: scrollMaxHeight } : undefined}
        >
          <Table noWrapper aria-label={ariaLabel} aria-busy={loading || undefined} className={cn("min-w-full", tableClassName)}>
            <TableHeader className="[&_tr]:border-b-0">
              <TableRow className="hover:bg-transparent">
                {selectable && (
                  <TableHead className={cn(headCellClass, "w-10 pl-3 pr-0")}>
                    <div className="flex items-center">
                      <Checkbox
                        aria-label="Select all rows on this page"
                        checked={headerChecked}
                        disabled={loading || pageSelectable.length === 0}
                        onCheckedChange={() => togglePage()}
                      />
                    </div>
                  </TableHead>
                )}
                {visibleColumns.map((col) => {
                  const align = alignOf(col);
                  const isSorted = sort?.key === col.key;
                  const SortIcon = !isSorted ? ChevronsUpDown : sort?.dir === "asc" ? ArrowUp : ArrowDown;
                  const style: CSSProperties = { width: cssLength(col.width), minWidth: cssLength(col.minWidth) };
                  return (
                    <TableHead
                      key={col.key}
                      scope="col"
                      aria-sort={col.sortable ? (isSorted ? (sort?.dir === "asc" ? "ascending" : "descending") : "none") : undefined}
                      className={cn(headCellClass, ALIGN_CLASS[align], col.headClassName ?? col.className)}
                      style={style}
                    >
                      {col.sortable ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(col.key)}
                          className={cn(
                            "-mx-1 inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-1 py-0.5 font-medium transition-colors",
                            "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            align === "right" && "flex-row-reverse",
                            isSorted && "text-foreground",
                          )}
                        >
                          <span>{col.header}</span>
                          <SortIcon
                            aria-hidden="true"
                            className={cn("h-3.5 w-3.5 shrink-0", isSorted ? "text-foreground" : "text-subtle-foreground")}
                          />
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
              {loading ? (
                Array.from({ length: Math.max(1, skeletonRows) }, (_, rowIdx) => (
                  <TableRow key={`skeleton-${rowIdx}`} className="hover:bg-transparent">
                    {selectable && (
                      <TableCell className={cn(bodyCellClass, "w-10 pl-3 pr-0")}>
                        <Skeleton className="h-4 w-4 rounded-sm" />
                      </TableCell>
                    )}
                    {visibleColumns.map((col, colIdx) => {
                      const align = alignOf(col);
                      const narrow = (pxValue(col.width) ?? Infinity) <= 64;
                      return (
                        <TableCell key={col.key} className={cn(bodyCellClass, col.cellClassName ?? col.className)}>
                          <Skeleton
                            className={cn("h-3.5", narrow ? "w-4" : "max-w-[12rem]", align === "right" && "ml-auto", align === "center" && "mx-auto")}
                            style={narrow ? undefined : { width: col.numeric ? "3rem" : SKELETON_WIDTHS[(rowIdx + colIdx) % SKELETON_WIDTHS.length] }}
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={colCount} className="h-auto p-0">
                    <EmptyState
                      size="sm"
                      icon={emptyContent.icon}
                      title={emptyContent.title}
                      description={emptyContent.description}
                      action={emptyContent.action}
                      className="py-10"
                    />
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const key = keyFn(row);
                  const isSelected = selectable && selectedSet.has(key);
                  const clickable = onRowClick != null;
                  return (
                    <TableRow
                      key={key}
                      data-state={isSelected ? "selected" : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      onClick={clickable ? (event) => handleRowClick(event, row) : undefined}
                      onKeyDown={clickable ? (event) => handleRowKeyDown(event, row) : undefined}
                      className={cn(
                        "group",
                        clickable &&
                          "cursor-pointer focus-visible:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                        rowClassName?.(row),
                      )}
                    >
                      {selectable && (
                        <TableCell className={cn(bodyCellClass, "w-10 pl-3 pr-0")} data-row-click-ignore>
                          <div className="flex items-center">
                            <Checkbox
                              aria-label={rowLabel ? `Select ${rowLabel(row)}` : "Select row"}
                              checked={isSelected}
                              disabled={!canSelect(row)}
                              onCheckedChange={(checked) => toggleRow(row, checked === true)}
                            />
                          </div>
                        </TableCell>
                      )}
                      {visibleColumns.map((col) => (
                        <TableCell
                          key={col.key}
                          className={cn(
                            bodyCellClass,
                            ALIGN_CLASS[alignOf(col)],
                            col.numeric && "tabular-nums",
                            col.cellClassName ?? col.className,
                          )}
                        >
                          {cellContent(col, row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {footer && <div className="border-t border-border px-3 py-2">{footer}</div>}
      </div>
    </DensityContext.Provider>
  );
}

function FooterCount({ count, label, singular }: { count: number; label: string; singular?: string }) {
  return <p className="py-1 text-ui tabular-nums text-muted-foreground">{countLabel(count, label, singular)}</p>;
}

export type { RowAction };
