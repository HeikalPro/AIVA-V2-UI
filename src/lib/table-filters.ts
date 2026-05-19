export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

export function matchesSearch(text: string, query: string): boolean {
  const q = normalizeSearchQuery(query);
  if (!q) return true;
  return text.toLowerCase().includes(q);
}

export function filterRows<T>(
  rows: T[],
  search: string,
  getSearchableText: (row: T) => string,
  predicates: Array<(row: T) => boolean> = [],
): T[] {
  const q = normalizeSearchQuery(search);
  return rows.filter((row) => {
    if (q && !matchesSearch(getSearchableText(row), q)) return false;
    return predicates.every((p) => p(row));
  });
}
