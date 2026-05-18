import type { CorpusSummary } from "@/types/api";

export function corpusDisplayName(corpus: CorpusSummary): string {
  const slug = corpus.slug.trim();
  const name = corpus.name.trim();
  return slug || name;
}

export function findCorpusById(
  corpora: CorpusSummary[],
  corpusId: string | null | undefined,
): CorpusSummary | undefined {
  if (!corpusId) return undefined;
  const key = corpusId.toLowerCase();
  return corpora.find((c) => c.corpus_id.toLowerCase() === key);
}

export function resolveCorpusDisplayName(
  corpusId: string | null | undefined,
  corpora: CorpusSummary[],
): string {
  if (!corpusId) return "—";
  const match = findCorpusById(corpora, corpusId);
  return match ? corpusDisplayName(match) : "Unknown knowledge base";
}

/** Compact ID for secondary UI (full value in title tooltip). */
export function formatCorpusIdShort(corpusId: string): string {
  const id = corpusId.replace(/-/g, "").toUpperCase();
  if (id.length <= 16) return id;
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}
