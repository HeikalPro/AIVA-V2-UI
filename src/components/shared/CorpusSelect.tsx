import { useMemo } from "react";
import { useCorpora } from "@/hooks/useCorpora";
import {
  corpusDisplayName,
  findCorpusById,
  formatCorpusIdShort,
} from "@/lib/corpus";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";

type CorpusSelectProps = {
  value: string;
  onChange: (corpusId: string) => void;
  label?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
};

export function CorpusSelect({
  value,
  onChange,
  label = "Knowledge base",
  allowEmpty = true,
  emptyLabel = "None",
  disabled = false,
  className,
}: CorpusSelectProps) {
  const { data: corpora = [], isLoading, isError } = useCorpora();
  const selected = useMemo(() => findCorpusById(corpora, value), [corpora, value]);
  const selectValue = selected?.corpus_id ?? value;

  return (
    <div className={className}>
      <Label>{label}</Label>
      <Select
        value={selectValue}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1"
        disabled={disabled || isLoading}
      >
        {allowEmpty && (
          <option value="">{isLoading ? "Loading…" : emptyLabel}</option>
        )}
        {corpora.map((c) => (
          <option key={c.corpus_id} value={c.corpus_id}>
            {corpusDisplayName(c)}
          </option>
        ))}
        {value && !selected && !isLoading && (
          <option value={value}>
            Unknown knowledge base
          </option>
        )}
      </Select>

      {isError && (
        <p className="mt-1 text-xs text-red-600">
          Could not load knowledge bases. Restart the backend if you recently updated it.
        </p>
      )}

      {value && (
        <p
          className="mt-1.5 font-mono text-[11px] leading-tight text-muted-foreground"
          title={value}
        >
          ID: {formatCorpusIdShort(value)}
        </p>
      )}
    </div>
  );
}
