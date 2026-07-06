import { useEffect, useState } from "react";
import type { QueueGroup } from "@/types/api";
import { Label } from "@/components/ui/label";

type Props = {
  queues: QueueGroup[];
  selected: string[];
  onChange: (keys: string[]) => void;
  disabled?: boolean;
};

export function QueueSelector({ queues, selected, onChange, disabled }: Props) {
  const [local, setLocal] = useState<string[]>(selected);

  useEffect(() => {
    setLocal(selected);
  }, [selected]);

  function toggle(key: string) {
    if (disabled) return;
    const next = local.includes(key) ? local.filter((k) => k !== key) : [...local, key];
    if (next.length === 0) return;
    setLocal(next);
    onChange(next);
  }

  function selectAll() {
    if (disabled) return;
    const all = queues.map((q) => q.key);
    if (!all.length) return;
    setLocal(all);
    onChange(all);
  }

  if (!queues.length) return null;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Label className="mb-0">KB queues</Label>
        <button
          type="button"
          className="text-xs text-primary underline-offset-2 hover:underline disabled:opacity-50"
          onClick={selectAll}
          disabled={disabled || local.length === queues.length}
        >
          Select all
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {queues.map((q) => {
          const on = local.includes(q.key);
          return (
            <button
              key={q.key}
              type="button"
              disabled={disabled}
              onClick={() => toggle(q.key)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                on
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-background text-muted-foreground hover:border-primary/40"
              }`}
            >
              {q.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
