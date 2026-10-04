import { useMemo } from "react";
import { useCorpora } from "@/hooks/useCorpora";
import {
  corpusDisplayName,
  findCorpusById,
  formatCorpusIdShort,
} from "@/lib/corpus";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";

type CorpusSelectProps = {
  value: string;
  onChange: (corpusId: string) => void;
  label?: string;
  allowEmpty?: boolean;
  emptyLabel?: string;
  disabled?: boolean;
  className?: string;
};

/** Knowledge-base (corpus) picker with the selected corpus ID shown as a hint. */
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
    <Field
      label={label}
      className={className}
      hint={
        value ? (
          <span className="font-mono" title={value}>
            ID: {formatCorpusIdShort(value)}
          </span>
        ) : undefined
      }
      error={isError ? "Couldn't load knowledge bases. Restart the backend if you recently updated it." : undefined}
    >
      {isLoading ? (
        <Skeleton className="h-9 w-full rounded-md" aria-label="Loading knowledge bases" />
      ) : (
        <Select value={selectValue} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
          {allowEmpty && <option value="">{emptyLabel}</option>}
          {corpora.map((c) => (
            <option key={c.corpus_id} value={c.corpus_id}>
              {corpusDisplayName(c)}
            </option>
          ))}
          {value && !selected && <option value={value}>Unknown knowledge base</option>}
        </Select>
      )}
    </Field>
  );
}
