import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  offset: number;
  limit: number;
  total: number;
  onChange: (offset: number) => void;
  /** What is being paged, for the nav landmark ("Sync history pages"). */
  label: string;
};

/** Previous / next for an {items, limit, offset, total} list; hidden when everything fits on one page. */
export function ListPager({ offset, limit, total, onChange, label }: Props) {
  if (total <= limit && offset === 0) return null;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">
        Showing {from}–{to} of {total.toLocaleString()}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
          <ChevronLeft aria-hidden="true" className="mr-1 h-4 w-4" /> Previous
        </Button>
        <Button variant="outline" size="sm" disabled={offset + limit >= total} onClick={() => onChange(offset + limit)}>
          Next <ChevronRight aria-hidden="true" className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </nav>
  );
}
