import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchInput } from "@/components/ui/search-input";
import { Select } from "@/components/ui/select";
import { countLabel } from "./count-label";

/* =============================================================================================
 * Types
 * ============================================================================================= */

export type FilterOption = { value: string; label: string };

/** One select filter. Same shape as the legacy `TableFilterField`, plus optional extras. */
export type FilterField = {
  /** DOM id of the <select> (unique on the page). */
  id: string;
  /** Short name shown inside the control ("Role", "Status") and used as its accessible name. */
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  /** Value meaning "no filter" (default: "" and "ALL" both count as inactive). */
  allValue?: string;
  /** Skip rendering (e.g. permission-gated filter). */
  hidden?: boolean;
  /** Extra classes for the control wrapper (e.g. "min-w-[10rem]"). */
  className?: string;
};

/** Dates are "YYYY-MM-DD" strings ("" = open-ended), the format native date inputs and the API use. */
export type DateRangeValue = { from: string; to: string };

export type DateRangeFilter = DateRangeValue & {
  onChange: (range: DateRangeValue) => void;
  /**
   * Quick ranges in days ending today ("Last 7 days" …). `true` = [7, 30, 90]. The date inputs show
   * while "Custom range" is chosen (or when presets are off).
   */
  presets?: boolean | number[];
  /** Accessible name prefix (default "Date"). */
  label?: string;
  /** Latest selectable date (default today). */
  max?: string;
};

export type FilterBarProps = {
  /** Search text (omit both search props to hide the search box). */
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  /** Select filters, rendered compactly as "Label  Value ▾". */
  filters?: FilterField[];
  dateRange?: DateRangeFilter;
  /** Shows "Clear filters" while anything is active. */
  onClear?: () => void;
  /** Override the automatic "anything active?" detection. */
  isFiltered?: boolean;
  /** Result count: "423 users" or "12 of 423 users" (needs totalCount). */
  totalCount?: number;
  filteredCount?: number;
  /** Plural noun for the count (default "items"). */
  itemLabel?: string;
  itemLabelSingular?: string;
  /** Right-aligned slot (Export, Refresh …). */
  actions?: ReactNode;
  /** Control height: sm = 32px (default, dense toolbars) or md = 36px. */
  size?: "sm" | "md";
  className?: string;
};

/* =============================================================================================
 * Helpers
 * ============================================================================================= */

function isFieldActive(field: FilterField) {
  if (field.allValue != null) return field.value !== field.allValue;
  return field.value !== "" && field.value !== "ALL";
}

function isoDay(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Range of `days` days ending today (inclusive), as YYYY-MM-DD strings. */
export function lastNDaysRange(days: number, now: Date = new Date()): DateRangeValue {
  const from = new Date(now);
  from.setDate(from.getDate() - (days - 1));
  return { from: isoDay(from), to: isoDay(now) };
}

/* =============================================================================================
 * Pieces
 * ============================================================================================= */

/**
 * Native Select with its label rendered inside the control ("Role  All roles ▾"), so the filter keeps
 * its context without a separate label row. The <select> gets the label as its accessible name.
 */
function FilterSelect({ field, size }: { field: FilterField; size: "sm" | "md" }) {
  const labelRef = useRef<HTMLSpanElement>(null);
  const [labelWidth, setLabelWidth] = useState<number | null>(null);
  const active = isFieldActive(field);

  useLayoutEffect(() => {
    const el = labelRef.current;
    if (!el) return;
    const measure = () => setLabelWidth(el.offsetWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [field.label]);

  const inset = size === "sm" ? 10 : 12; // matches the control's horizontal padding

  return (
    <div className={cn("relative shrink-0", field.className)}>
      <Select
        id={field.id}
        aria-label={field.label}
        controlSize={size}
        value={field.value}
        onChange={(event) => field.onChange(event.target.value)}
        wrapperClassName="w-auto"
        // pr-8 restates the chevron gutter (the size padding in Select would otherwise override it).
        className={cn("w-auto max-w-[16rem] truncate pr-8 font-medium", active && "border-primary/50 bg-primary-muted/40")}
        style={labelWidth != null ? { paddingLeft: inset + labelWidth + 6 } : undefined}
      >
        {field.options.map((opt) => (
          <option key={opt.value || "__all"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </Select>
      <span
        ref={labelRef}
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/2 z-[1] -translate-y-1/2 whitespace-nowrap text-muted-foreground",
          size === "sm" ? "left-2.5 text-ui" : "left-3 text-sm",
        )}
      >
        {field.label}
      </span>
    </div>
  );
}

const PRESET_CUSTOM = "custom";
const PRESET_ANY = "";

function DateRangeControl({ range, size }: { range: DateRangeFilter; size: "sm" | "md" }) {
  const id = useId();
  const label = range.label ?? "Date";
  const presets = range.presets === true ? [7, 30, 90] : Array.isArray(range.presets) ? range.presets : [];
  const today = isoDay(new Date());
  const max = range.max ?? today;
  const matched = presets.find((days) => {
    const r = lastNDaysRange(days);
    return r.from === range.from && r.to === range.to;
  });
  const isEmpty = !range.from && !range.to;
  const [customOpen, setCustomOpen] = useState(false);
  // "Custom range" stays selected once chosen (even if the dates happen to match a preset) until
  // a preset/"Any time" is picked or the bar is cleared (FilterBar remounts this control).
  const presetValue = customOpen
    ? PRESET_CUSTOM
    : matched != null
      ? String(matched)
      : isEmpty
        ? PRESET_ANY
        : PRESET_CUSTOM;
  const showInputs = presets.length === 0 || presetValue === PRESET_CUSTOM;

  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      {presets.length > 0 && (
        <FilterSelect
          size={size}
          field={{
            id: `${id}-preset`,
            label,
            value: presetValue,
            allValue: PRESET_ANY,
            options: [
              { value: PRESET_ANY, label: "Any time" },
              ...presets.map((days) => ({ value: String(days), label: `Last ${days} days` })),
              { value: PRESET_CUSTOM, label: "Custom range" },
            ],
            onChange: (value) => {
              if (value === PRESET_CUSTOM) {
                setCustomOpen(true);
                return;
              }
              setCustomOpen(false);
              if (value === PRESET_ANY) range.onChange({ from: "", to: "" });
              else range.onChange(lastNDaysRange(Number(value)));
            },
          }}
        />
      )}
      {showInputs && (
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            aria-label={`${label} from`}
            controlSize={size}
            value={range.from}
            max={range.to || max}
            onChange={(event) => range.onChange({ from: event.target.value, to: range.to })}
            className="w-[9.25rem]"
          />
          <span aria-hidden="true" className="text-ui text-muted-foreground">
            –
          </span>
          <Input
            type="date"
            aria-label={`${label} to`}
            controlSize={size}
            value={range.to}
            min={range.from || undefined}
            max={max}
            onChange={(event) => range.onChange({ from: range.from, to: event.target.value })}
            className="w-[9.25rem]"
          />
        </div>
      )}
    </div>
  );
}

/* =============================================================================================
 * FilterBar
 * ============================================================================================= */

/**
 * One compact, wrapping filter row: search, select filters, optional date range, "Clear filters",
 * result count and an actions slot. No card or border of its own, so it works standalone above a
 * table and inside `<DataTable toolbar={…} />`.
 */
export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters = [],
  dateRange,
  onClear,
  isFiltered,
  totalCount,
  filteredCount,
  itemLabel = "items",
  itemLabelSingular,
  actions,
  size = "sm",
  className,
}: FilterBarProps) {
  const visibleFilters = filters.filter((f) => !f.hidden);
  const [resetKey, setResetKey] = useState(0);
  const active =
    isFiltered ??
    ((search ?? "").trim().length > 0 ||
      visibleFilters.some(isFieldActive) ||
      Boolean(dateRange && (dateRange.from || dateRange.to)));

  let count: ReactNode = null;
  if (totalCount != null) {
    const shown = filteredCount ?? totalCount;
    count =
      shown === totalCount ? (
        countLabel(totalCount, itemLabel, itemLabelSingular)
      ) : (
        <>
          <span className="font-medium text-foreground">{formatNumber(shown)}</span> of{" "}
          {countLabel(totalCount, itemLabel, itemLabelSingular)}
        </>
      );
  }

  return (
    <div role="search" className={cn("flex flex-wrap items-center gap-2", className)}>
      {onSearchChange && (
        <SearchInput
          controlSize={size}
          value={search ?? ""}
          onChange={(event) => onSearchChange(event.target.value)}
          onClear={() => onSearchChange("")}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder.replace(/…$|\.\.\.$/, "") || "Search"}
          className="min-w-[12rem] max-w-[22.5rem] flex-1 basis-[16rem]"
        />
      )}
      {visibleFilters.map((field) => (
        <FilterSelect key={field.id} field={field} size={size} />
      ))}
      {dateRange && <DateRangeControl key={resetKey} range={dateRange} size={size} />}
      {active && onClear && (
        <Button
          type="button"
          variant="ghost"
          size={size === "sm" ? "sm" : "md"}
          className="text-muted-foreground"
          onClick={() => {
            onClear();
            setResetKey((k) => k + 1);
          }}
        >
          <X aria-hidden="true" className="h-4 w-4" />
          Clear filters
        </Button>
      )}
      {(count != null || actions != null) && (
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {count != null && (
            <p className="whitespace-nowrap text-ui tabular-nums text-muted-foreground" aria-live="polite">
              {count}
            </p>
          )}
          {actions != null && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
    </div>
  );
}
