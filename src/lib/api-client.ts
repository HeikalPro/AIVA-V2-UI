import type { TokenResponse } from "@/types/api";
import { ApiError, formatUserError, parseApiDetail, readHttpErrorMessage } from "@/lib/errors";

const ACCESS_KEY = "aiva_access_token";
const REFRESH_KEY = "aiva_refresh_token";

const baseUrl = () => import.meta.env.VITE_API_BASE_URL ?? "";

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens(tokens: TokenResponse): void {
  localStorage.setItem(ACCESS_KEY, tokens.access_token);
  localStorage.setItem(REFRESH_KEY, tokens.refresh_token);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const refresh = getRefreshToken();
  if (!refresh) return false;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${baseUrl()}/api/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refresh }),
        });
        if (!res.ok) return false;
        const tokens = (await res.json()) as TokenResponse;
        setTokens(tokens);
        return true;
      } catch {
        return false;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export type RequestOptions = {
  auth?: boolean;
  retry?: boolean;
};

function wrapFetchError(err: unknown): never {
  if (err instanceof ApiError) throw err;
  throw new ApiError(formatUserError(err, "api"));
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = { auth: true, retry: true },
): Promise<T> {
  const url = `${baseUrl()}${path}`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (options.auth !== false) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    wrapFetchError(err);
  }

  if (res.status === 401 && options.auth !== false && options.retry !== false) {
    const ok = await tryRefresh();
    if (ok) return request(method, path, body, { ...options, retry: false });
    clearTokens();
    throw new ApiError(formatUserError(new Error("Session expired"), "api"), 401);
  }

  const text = await res.text();
  let data: unknown = {};
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const detail = parseApiDetail(data);
    throw new ApiError(detail || `Request failed (${res.status})`, res.status);
  }

  return data as T;
}

export function apiGet<T>(path: string, auth = true) {
  return request<T>("GET", path, undefined, { auth });
}

export function apiPost<T>(path: string, body?: unknown, auth = true) {
  return request<T>("POST", path, body, { auth });
}

export function apiPatch<T>(path: string, body?: unknown, auth = true) {
  return request<T>("PATCH", path, body, { auth });
}

export function apiPut<T>(path: string, body?: unknown, auth = true) {
  return request<T>("PUT", path, body, { auth });
}

export function apiDelete<T>(path: string, auth = true) {
  return request<T>("DELETE", path, undefined, { auth });
}

const backendUrl = () => import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function startZohoLogin() {
  const returnTo = encodeURIComponent(`${window.location.origin}/auth/zoho-callback`);
  window.location.href = `${backendUrl()}/api/auth/zoho/login?redirect=true&return_to=${returnTo}`;
}

export type ChatStreamEvent = {
  type: string;
  text?: string;
  message?: string;
  latency_ms?: number;
  sources?: { parent_id: string; url: string }[];
};

export async function apiStream(
  path: string,
  body: unknown,
  onEvent: (event: ChatStreamEvent) => void,
): Promise<void> {
  const url = `${baseUrl()}${path}`;
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  } catch (err) {
    wrapFetchError(err);
  }

  if (!res.ok) {
    throw new ApiError(await readHttpErrorMessage(res), res.status);
  }
  if (!res.body) throw new ApiError("No response body from chat stream.", res.status);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        onEvent(JSON.parse(line.slice(6)) as ChatStreamEvent);
      } catch {
        /* ignore malformed SSE */
      }
    }
  }
}
