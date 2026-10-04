import type { AgentMetric, AiTimeseriesPoint } from "@/types/api";

export const RANGE_OPTIONS = [7, 30, 90] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

export function rangeLabel(days: number): string {
  return `Last ${days} days`;
}

/** "2026-09-04" → local Date (not UTC midnight, which shifts the day west of Greenwich). */
export function parseDay(day: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(day);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function isoDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** "Sep 4" */
export function shortDayLabel(day: string): string {
  const d = parseDay(day);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : day;
}

/** "Fri, Sep 4, 2026" */
export function longDayLabel(day: string): string {
  const d = parseDay(day);
  return d ? d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : day;
}

/** Inclusive YYYY-MM-DD range of `days` days ending today (the /api/logs start/end format). */
export function lastNDays(days: number, now: Date = new Date()): { start: string; end: string } {
  const from = new Date(now);
  from.setDate(from.getDate() - (days - 1));
  return { start: isoDay(from), end: isoDay(now) };
}

export type DailyPoint = { day: string; calls: number; avg_latency_ms: number | null; total_tokens: number };

/**
 * The API only returns days that had LLM calls. Fill the gaps with 0 calls / 0 tokens / no latency so
 * quiet days show as zero instead of the line silently bridging them.
 */
export function fillDailySeries(points: AiTimeseriesPoint[], days: number, now: Date = new Date()): DailyPoint[] {
  const byDay = new Map(points.map((p) => [p.day.slice(0, 10), p]));
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  const sortedDays = [...byDay.keys()].sort();
  const first = sortedDays.length ? parseDay(sortedDays[0]) : null;
  const last = sortedDays.length ? parseDay(sortedDays[sortedDays.length - 1]) : null;
  if (first && first < start) start = first;
  const stop = last && last > end ? last : end;

  const out: DailyPoint[] = [];
  for (const d = new Date(start); d <= stop; d.setDate(d.getDate() + 1)) {
    const key = isoDay(d);
    const p = byDay.get(key);
    out.push({
      day: key,
      calls: p?.calls ?? 0,
      avg_latency_ms: p?.avg_latency_ms ?? null,
      total_tokens: p?.total_tokens ?? 0,
    });
  }
  return out;
}

export function agentDisplayName(metric: AgentMetric): string {
  const name = [metric.agent_first_name, metric.agent_last_name].filter(Boolean).join(" ").trim();
  return name || metric.agent_email || `User #${metric.user_id}`;
}

/** successful / (successful + failed), or null when there were no answers. */
export function successRatio(successful: number | null | undefined, failed: number | null | undefined): number | null {
  const ok = successful ?? 0;
  const bad = failed ?? 0;
  return ok + bad > 0 ? ok / (ok + bad) : null;
}
