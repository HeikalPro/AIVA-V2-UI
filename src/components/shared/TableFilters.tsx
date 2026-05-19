import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

export type TableFilterField = {
  id: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
};

type TableFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filters?: TableFilterField[];
  onClear: () => void;
  totalCount: number;
  filteredCount: number;
};

export function TableFilters({
  search,
  onSearchChange,
  searchPlaceholder = "Search…",
  filters = [],
  onClear,
  totalCount,
  filteredCount,
}: TableFiltersProps) {
  const hasActiveFilters =
    search.trim().length > 0 || filters.some((f) => f.value !== "" && f.value !== "ALL");

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
        <div className="flex-1">
          <Label htmlFor="table-search" className="sr-only">
            Search
          </Label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="table-search"
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
        </div>

        {filters.map((field) => (
          <div key={field.id} className="w-full lg:w-44">
            <Label htmlFor={field.id}>{field.label}</Label>
            <Select
              id={field.id}
              value={field.value}
              onChange={(e) => field.onChange(e.target.value)}
              className="mt-1"
            >
              {field.options.map((opt) => (
                <option key={opt.value || "all"} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        ))}

        {hasActiveFilters && (
          <Button type="button" variant="outline" onClick={onClear} className="lg:mb-0.5">
            <X className="mr-2 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        {filteredCount === totalCount
          ? `${totalCount} ${totalCount === 1 ? "item" : "items"}`
          : `Showing ${filteredCount} of ${totalCount}`}
      </p>
    </div>
  );
}
