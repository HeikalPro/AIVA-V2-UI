import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";

type QueueChip = { key: string; label: string };

type Props = {
  queues: QueueChip[];
  /** Chips shown before collapsing the rest into "+N" (default 2). */
  max?: number;
  className?: string;
};

/** Queue chips for table cells: the first few as neutral badges, the rest as "+N" with a tooltip. */
export function QueueChips({ queues, max = 2, className }: Props) {
  if (queues.length === 0) return <span className="text-muted-foreground">—</span>;
  const shown = queues.slice(0, max);
  const rest = queues.slice(max);
  return (
    <span className={`inline-flex max-w-full flex-nowrap items-center gap-1 whitespace-nowrap ${className ?? ""}`.trim()}>
      {shown.map((q, i) => (
        <Badge key={`${q.key}-${i}`} variant="neutral" title={q.key} className="max-w-[8rem] truncate">
          <bdi className="truncate">{q.label}</bdi>
        </Badge>
      ))}
      {rest.length > 0 && (
        <Tooltip content={rest.map((q) => q.label).join(", ")}>
          <Badge variant="outline" tabIndex={0} aria-label={`${rest.length} more: ${rest.map((q) => q.label).join(", ")}`}>
            +{rest.length}
          </Badge>
        </Tooltip>
      )}
    </span>
  );
}
