/**
 * Display formatters shared by the whole console. One convention app-wide:
 * en-US grouping, Latin digits, and "—" for missing values (null, undefined, NaN, invalid dates).
 * These only format; they never convert units or currencies.
 */

export const EMPTY_VALUE = "—";

type Numeric = number | null | undefined;
type DateInput = string | number | Date | null | undefined;

const LOCALE = "en-US";

function isNum(value: Numeric): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** 1234.5 → "1,234.5". Pass Intl options to control decimals. */
export function formatNumber(value: Numeric, options?: Intl.NumberFormatOptions): string {
  if (!isNum(value)) return EMPTY_VALUE;
  return value.toLocaleString(LOCALE, { maximumFractionDigits: 2, ...options });
}

/** 1234 → "1.2K", 3_400_000 → "3.4M". Values under 1,000 are shown as-is. */
export function formatCompactNumber(value: Numeric): string {
  if (!isNum(value)) return EMPTY_VALUE;
  return new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/**
 * Formats a RATIO (0–1) as a percentage: 0.125 → "12.5%", 1 → "100%".
 * If you already have a 0–100 number, divide by 100 first.
 */
export function formatPercent(ratio: Numeric, fractionDigits = 1): string {
  if (!isNum(ratio)) return EMPTY_VALUE;
  return ratio.toLocaleString(LOCALE, {
    style: "percent",
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits,
  });
}

/** Milliseconds → "840ms", "1.28s", "12.4s", "2m 05s", "1h 02m". */
export function formatDurationMs(ms: Numeric): string {
  if (!isNum(ms)) return EMPTY_VALUE;
  const sign = ms < 0 ? "-" : "";
  const abs = Math.abs(ms);
  if (abs < 1000) return `${sign}${Math.round(abs)}ms`;
  const seconds = abs / 1000;
  if (seconds < 10) return `${sign}${seconds.toFixed(2)}s`;
  if (seconds < 60) return `${sign}${seconds.toFixed(1)}s`;
  const totalSeconds = Math.round(seconds);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${sign}${h}h ${String(m).padStart(2, "0")}m`;
  return `${sign}${m}m ${String(s).padStart(2, "0")}s`;
}

/**
 * Money with an ISO code prefix: formatMoney(1234.5) → "EGP 1,234.50", formatMoney(0.0123, "usd") → "USD 0.0123".
 * Two decimals normally; values below 1 keep enough decimals (up to 6) to stay meaningful.
 * Never converts between currencies — pass the currency the value is actually in.
 */
export function formatMoney(value: Numeric, currency = "EGP"): string {
  if (!isNum(value)) return EMPTY_VALUE;
  const code = (currency || "EGP").trim().toUpperCase();
  const abs = Math.abs(value);
  let maxDigits = 2;
  if (abs > 0 && abs < 1) {
    maxDigits = Math.min(6, Math.max(2, Math.ceil(-Math.log10(abs)) + 2));
  }
  const body = abs.toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: maxDigits });
  return `${code} ${value < 0 ? "-" : ""}${body}`;
}

function toDate(value: DateInput): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Oct 3, 2026, 2:05 PM" in the viewer's time zone. Unparseable strings are returned unchanged. */
export function formatDateTime(value: DateInput, options?: Intl.DateTimeFormatOptions): string {
  const d = toDate(value);
  if (!d) return typeof value === "string" && value ? value : EMPTY_VALUE;
  return d.toLocaleString(LOCALE, options ?? { dateStyle: "medium", timeStyle: "short" });
}

/** "Oct 3, 2026". Unparseable strings are returned unchanged. */
export function formatDate(value: DateInput, options?: Intl.DateTimeFormatOptions): string {
  const d = toDate(value);
  if (!d) return typeof value === "string" && value ? value : EMPTY_VALUE;
  return d.toLocaleDateString(LOCALE, options ?? { dateStyle: "medium" });
}

/**
 * Short relative time: "just now", "5s ago", "3m ago", "2h ago", "4d ago", "in 5m".
 * Beyond 30 days it falls back to formatDate. `now` is injectable for tests/live tickers.
 */
export function formatRelativeTime(value: DateInput, now: number | Date = Date.now()): string {
  const d = toDate(value);
  if (!d) return typeof value === "string" && value ? value : EMPTY_VALUE;
  const nowMs = now instanceof Date ? now.getTime() : now;
  const diff = nowMs - d.getTime();
  const future = diff < 0;
  const s = Math.floor(Math.abs(diff) / 1000);
  // A server clock slightly ahead of the browser makes fresh events look like "in 20s";
  // only clearly-future times (schedules such as a next sync) read as "in …".
  if (s < 1 || (future && s < 120)) return "just now";
  let text: string;
  if (s < 60) text = `${s}s`;
  else if (s < 3600) text = `${Math.floor(s / 60)}m`;
  else if (s < 86_400) text = `${Math.floor(s / 3600)}h`;
  else if (s < 30 * 86_400) text = `${Math.floor(s / 86_400)}d`;
  else return formatDate(d);
  return future ? `in ${text}` : `${text} ago`;
}
