/**
 * Runtime config for cloud / self-host / LAN.
 * Client: read from window.__RUNTIME_CONFIG__ (injected by HTML or build).
 * Server/SSR: read from env. Do not fully implement deployment logic yet.
 */

export type RuntimeConfig = {
  apiBaseUrl: string
}

declare global {
  interface Window {
    __RUNTIME_CONFIG__?: Partial<RuntimeConfig>
  }
}

const defaults: RuntimeConfig = {
  apiBaseUrl: typeof window !== "undefined" && window.__RUNTIME_CONFIG__?.apiBaseUrl
    ? window.__RUNTIME_CONFIG__.apiBaseUrl
    : (import.meta.env?.VITE_API_BASE_URL as string | undefined) ?? "/api",
}

export function getRuntimeConfig(): RuntimeConfig {
  if (typeof window !== "undefined" && window.__RUNTIME_CONFIG__) {
    return { ...defaults, ...window.__RUNTIME_CONFIG__ }
  }
  return {
    ...defaults,
    apiBaseUrl: (import.meta.env?.VITE_API_BASE_URL as string | undefined) ?? "/api",
  }
}
