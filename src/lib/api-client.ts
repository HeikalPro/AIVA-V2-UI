import type { TokenResponse } from "@/types/api";

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

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && options.auth !== false && options.retry !== false) {
    const ok = await tryRefresh();
    if (ok) return request(method, path, body, { ...options, retry: false });
    clearTokens();
    throw new Error("Session expired. Please log in again.");
  }

  const text = await res.text();
  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    data = text as T;
  }

  if (!res.ok) {
    const detail =
      typeof data === "object" && data !== null && "detail" in data
        ? String((data as { detail: unknown }).detail)
        : res.statusText;
    throw new Error(detail || `${res.status} ${res.statusText}`);
  }

  return data;
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

export function apiDelete<T>(path: string, auth = true) {
  return request<T>("DELETE", path, undefined, { auth });
}

const backendUrl = () => import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function startZohoLogin() {
  const returnTo = encodeURIComponent(`${window.location.origin}/auth/zoho-callback`);
  window.location.href = `${backendUrl()}/api/auth/zoho/login?redirect=true&return_to=${returnTo}`;
}

export async function apiStream(
  path: string,
  body: unknown,
  onEvent: (event: { type: string; text?: string; latency_ms?: number }) => void,
): Promise<void> {
  const url = `${baseUrl()}${path}`;
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status}: ${text}`);
  }
  if (!res.body) throw new Error("No response body");

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
        onEvent(JSON.parse(line.slice(6)) as { type: string; text?: string; latency_ms?: number });
      } catch {
        /* ignore malformed SSE */
      }
    }
  }
}
