import { getRuntimeConfig } from "./runtime-config"

export type ApiClientOptions = RequestInit & { path: string }

/**
 * Typed fetch wrapper for the separate API server.
 * Base URL comes from runtime config (cloud/self-host/LAN).
 */
export async function apiClient<T = unknown>(options: ApiClientOptions): Promise<T> {
  const { apiBaseUrl } = getRuntimeConfig()
  const url = `${apiBaseUrl.replace(/\/$/, "")}${options.path.startsWith("/") ? "" : "/"}${options.path}`
  const { path: _path, ...init } = options
  const res = await fetch(url, { ...init, credentials: init.credentials ?? "include" })
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }
  return res.json() as Promise<T>
}
