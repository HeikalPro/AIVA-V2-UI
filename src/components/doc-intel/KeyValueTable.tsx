import { Fragment } from "react";

type Primitive = string | number | boolean | bigint;

function isPrimitive(value: unknown): value is Primitive {
  const t = typeof value;
  return t === "string" || t === "number" || t === "boolean" || t === "bigint";
}

/** Nested diagnostic values, rendered compactly: one nested level inline, deeper levels as JSON. */
function CompactValue({ value, depth }: { value: unknown; depth: number }) {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (typeof value === "boolean") {
    return <span className="font-mono text-xs">{value ? "true" : "false"}</span>;
  }
  if (isPrimitive(value)) {
    return <span className="whitespace-pre-wrap break-words">{String(value)}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted-foreground">none</span>;
    if (value.every(isPrimitive)) return <span className="break-words">{value.map(String).join(", ")}</span>;
    if (depth >= 1) return <code className="block whitespace-pre-wrap break-all font-mono text-xs">{JSON.stringify(value)}</code>;
    return (
      <ul className="space-y-1">
        {value.map((item, i) => (
          <li key={i} className="rounded-md border border-border px-2 py-1">
            <CompactValue value={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-muted-foreground">none</span>;
    if (depth >= 2) return <code className="block whitespace-pre-wrap break-all font-mono text-xs">{JSON.stringify(value)}</code>;
    return (
      <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-0.5">
        {entries.map(([k, v]) => (
          <Fragment key={k}>
            <dt className="break-all font-mono text-xs text-muted-foreground">{k}</dt>
            <dd className="min-w-0">
              <CompactValue value={v} depth={depth + 1} />
            </dd>
          </Fragment>
        ))}
      </dl>
    );
  }
  return <span>{String(value)}</span>;
}

type Props = {
  data: Record<string, unknown> | null | undefined;
  emptyMessage?: string;
};

/** Key/value table for a free-form `details` object (health diagnostics, extractor info). */
export function KeyValueTable({ data, emptyMessage = "No details reported." }: Props) {
  const entries = Object.entries(data ?? {});
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody>
          {entries.map(([key, value]) => (
            <tr key={key} className="border-b border-border align-top last:border-0">
              <th
                scope="row"
                className="w-1/3 break-all py-1.5 pr-3 text-left font-mono text-xs font-medium text-muted-foreground"
              >
                {key}
              </th>
              <td className="min-w-0 py-1.5 text-foreground">
                <CompactValue value={value} depth={0} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
