import { formatNumber } from "@/lib/format";

/**
 * Singular form of a plural item label: "users" → "user", "entries" → "entry", "rows" → "row".
 * Pass an explicit singular wherever the heuristic is wrong ("statuses" → "status").
 */
export function singularize(plural: string): string {
  if (/ies$/i.test(plural)) return `${plural.slice(0, -3)}y`;
  if (/[^s]s$/i.test(plural)) return plural.slice(0, -1);
  return plural;
}

/** "1 user", "1,204 users". */
export function countLabel(count: number, plural: string, singular?: string): string {
  const noun = count === 1 ? (singular ?? singularize(plural)) : plural;
  return `${formatNumber(count)} ${noun}`;
}
