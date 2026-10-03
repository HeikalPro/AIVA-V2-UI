import { useId } from "react";
import { Check } from "lucide-react";
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
  const linkClass =
    "rounded text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50";

  function toggle(key: string) {
    if (disabled) return;
    onChange(selectedSet.has(key) ? selected.filter((k) => k !== key) : [...selected, key]);
  }

  return (
    <div role="group" aria-labelledby={labelId} className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span id={labelId} className="text-sm font-medium text-slate-700">
          {label}
        </span>
        {!loading && !error && queues.length > 0 && (
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground" aria-live="polite">
              {selectedCount} of {queues.length} selected
            </span>
            <button
              type="button"
              className={linkClass}
              onClick={() => onChange(queues.map((q) => q.key))}
              disabled={disabled || selectedCount === queues.length}
            >
              Select all
            </button>
            <button
              type="button"
              className={linkClass}
              onClick={() => onChange([])}
              disabled={disabled || selected.length === 0}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading queues…</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : queues.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {queues.map((q) => {
            const on = selectedSet.has(q.key);
            return (
              <button
                key={q.key}
                type="button"
                aria-pressed={on}
                disabled={disabled}
                onClick={() => toggle(q.key)}
                title={q.key}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${
                  on
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground"
                }`}
              >
                {on && <Check aria-hidden="true" className="h-3.5 w-3.5" />}
                {q.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
