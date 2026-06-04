/** User-facing API and network error messages for AIVA-V2-UI. */

export type ErrorContext = "login" | "chat" | "api" | "stream";

export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type ValidationItem = {
  loc?: (string | number)[];
  msg?: string;
  message?: string;
};

/** Parse FastAPI `detail` from JSON body (string, array, or nested). */
export function parseApiDetail(data: unknown): string {
  if (data === null || data === undefined) return "";
  if (typeof data === "string") return data.trim();
  if (typeof data === "object" && "detail" in (data as object)) {
    return parseApiDetail((data as { detail: unknown }).detail);
  }
  if (Array.isArray(data)) {
    const parts: string[] = [];
    for (const item of data) {
      if (typeof item === "string" && item.trim()) {
        parts.push(item.trim());
        continue;
      }
      if (item && typeof item === "object") {
        const v = item as ValidationItem;
        const loc = v.loc?.filter((x) => x !== "body").join(".") ?? "";
        const msg = v.msg ?? v.message ?? "";
        if (msg) parts.push(loc ? `${loc}: ${msg}` : msg);
      }
    }
    return parts.join("; ") || "Validation error";
  }
  return String(data);
}

function isNetworkFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return (
    m === "failed to fetch" ||
    m.includes("networkerror") ||
    m.includes("network request failed") ||
    m.includes("load failed")
  );
}

function networkMessage(context: ErrorContext): string {
  const base = import.meta.env.VITE_API_BASE_URL?.trim() || "http://localhost:8000";
  if (context === "login") {
    return `Cannot reach the API at ${base}. Start the AIVA-V2 backend and try again.`;
  }
  return `Cannot reach the API at ${base}. Check that the backend is running (port 8000) and refresh the page.`;
}

function statusHint(status: number | undefined, context: ErrorContext): string | null {
  if (status === 401 || status === 403) {
    return context === "login"
      ? "Invalid email or password."
      : "Your session expired. Please sign in again.";
  }
  if (status === 404) return "The requested resource was not found.";
  if (status === 409) return "This action conflicts with existing data.";
  if (status === 422) return "Some fields are invalid. Check your input and try again.";
  if (status === 429) return "Too many requests. Wait a moment and try again.";
  if (status === 502 || status === 503) return "The server is temporarily unavailable. Try again shortly.";
  if (status && status >= 500) return "Server error. Try again or contact support if this continues.";
  return null;
}

/** Build message from a failed `fetch` response body. */
export async function readHttpErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  if (!text.trim()) return statusHint(res.status, "api") ?? `Request failed (${res.status})`;
  try {
    const parsed = parseApiDetail(JSON.parse(text) as unknown);
    if (parsed) return parsed;
  } catch {
    if (!text.trimStart().startsWith("<")) return text.trim().slice(0, 800);
  }
  return statusHint(res.status, "api") ?? `Request failed (${res.status})`;
}

/** User-facing message for forms, toasts, and inline alerts. */
export function formatUserError(err: unknown, context: ErrorContext = "api"): string {
  if (err instanceof ApiError) {
    const hint = statusHint(err.status, context);
    if (hint && (err.message === `Request failed (${err.status})` || !err.message.trim())) {
      return hint;
    }
    return err.message;
  }
  if (err instanceof Error) {
    if (isNetworkFailure(err)) return networkMessage(context);
    const statusMatch = err.message.match(/Request failed \((\d{3})\)/);
    if (statusMatch) {
      const hint = statusHint(Number(statusMatch[1]), context);
      if (hint) return hint;
    }
    if (/^\d{3}:/.test(err.message)) {
      const hint = statusHint(Number(err.message.slice(0, 3)), context);
      if (hint) return hint;
    }
    return err.message;
  }
  if (typeof err === "string" && err.trim()) return err.trim();
  switch (context) {
    case "login":
      return "Sign-in failed. Try again.";
    case "chat":
    case "stream":
      return "Something went wrong with chat. Try again.";
    default:
      return "Something went wrong. Try again.";
  }
}

/** React Query `error` field → display string. */
export function formatQueryError(error: unknown, context: ErrorContext = "api"): string {
  return formatUserError(error, context);
}
