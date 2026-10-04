import { useState } from "react";
import { CircleHelp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const COLLAPSED_COUNT = 3;

/** Backend joins reasons with " | " (LISTAGG), most frequent first. */
function parseReasons(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
}

/** ⓘ next to a failed-answers count: the most frequent failure reasons in a popover. */
export function FailureReasonsPopover({ reasons }: { reasons: string | null | undefined }) {
  const [expanded, setExpanded] = useState(false);
  const items = parseReasons(reasons);
  const visible = expanded ? items : items.slice(0, COLLAPSED_COUNT);
  const hidden = items.length - visible.length;

  return (
    <Popover onOpenChange={(open) => !open && setExpanded(false)}>
      <PopoverTrigger asChild>
        <IconButton
          label="Show failure reasons"
          icon={CircleHelp}
          size="sm"
          tooltip={false}
          className="h-6 w-6 text-subtle-foreground hover:text-danger [&_svg]:h-3.5 [&_svg]:w-3.5"
          onClick={(event) => event.stopPropagation()}
        />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[340px] max-w-[calc(100vw-2rem)] p-0"
        aria-label="Failure reasons"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">Failure reasons</p>
        <div className="max-h-64 overflow-y-auto px-3 py-2">
          {items.length === 0 ? (
            <p className="py-1 text-sm text-muted-foreground">Reasons unavailable</p>
          ) : (
            <ul className="space-y-1.5">
              {visible.map((reason, idx) => (
                <li key={`${idx}-${reason}`} className="flex gap-2 text-ui leading-snug text-foreground">
                  <span aria-hidden="true" className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-danger" />
                  <span dir="auto" className="min-w-0 break-words">
                    {reason}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {(hidden > 0 || (expanded && items.length > COLLAPSED_COUNT)) && (
          <div className="border-t border-border px-1.5 py-1">
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setExpanded((v) => !v)}>
              {hidden > 0 ? `Show more (${hidden})` : "Show less"}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
