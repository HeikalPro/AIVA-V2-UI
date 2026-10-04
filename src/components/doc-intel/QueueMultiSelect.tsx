import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ToggleChip } from "@/components/widget-config/ToggleChip";
import type { KbQueueGroup } from "@/types/api";

type Props = {
  queues: KbQueueGroup[];
  selected: string[];
  onChange: (keys: string[]) => void;
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
  label?: string;
  emptyMessage?: string;
};

/**
 * Queue chips from an account's KB queue catalog. Zero selected is allowed while editing;
 * callers decide whether an empty selection may be submitted.
 */
export function QueueMultiSelect({
  queues,
  selected,
  onChange,
  loading = false,
  error,
  disabled = false,
  label = "Queues",
  emptyMessage = "This account's knowledge base has no queues, so documents can't be published to it yet.",
}: Props) {
  const labelId = useId();
  const selectedSet = new Set(selected);
  const selectedCount = queues.filter((q) => selectedSet.has(q.key)).length;

  function toggle(key: string) {
    if (disabled) return;
    onChange(selectedSet.has(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  return (
    <div role="group" aria-labelledby={labelId} className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={labelId} className="text-ui font-medium text-foreground">
          {label}
        </span>
        {!loading && !error && queues.length > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <span className="tabular-nums text-muted-foreground" aria-live="polite">
              {selectedCount} of {queues.length} selected
            </span>
            <Button
              variant="link"
              size="sm"
              className="h-6 px-0 text-xs"
              onClick={() => onChange(queues.map((q) => q.key))}
              disabled={disabled || selectedCount === queues.length}
            >
              Select all
            </Button>
            <Button
              variant="link"
              size="sm"
              className="h-6 px-0 text-xs"
              onClick={() => onChange([])}
              disabled={disabled || selected.length === 0}
            >
              Clear
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex flex-wrap gap-2" aria-busy="true">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
      ) : error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : queues.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {queues.map((q) => (
            <ToggleChip key={q.key} pressed={selectedSet.has(q.key)} onPressedChange={() => toggle(q.key)} disabled={disabled}>
              {q.label}
            </ToggleChip>
          ))}
        </div>
      )}
    </div>
  );
}
