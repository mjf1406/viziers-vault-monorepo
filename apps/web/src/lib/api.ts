/**
 * Resolves API base URL at runtime.
 * - Web (same-origin / proxy): "/api"
 * - Electron: window.__APP_RUNTIME__.apiBaseUrl
 * - Optional override: VITE_API_BASE_URL
 */
export function getApiBase(): string {
  if (typeof window === "undefined") return "/api";
  const runtime = window.__APP_RUNTIME__?.apiBaseUrl;
  if (runtime) return runtime;
  const env = import.meta.env.VITE_API_BASE_URL;
  if (env) return env;
  return "/api";
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const base = getApiBase();
  const url = path.startsWith("http") ? path : `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? res.statusText);
  }
  return res.json() as Promise<T>;
}
