import {
  createContext,
  useContext,
  type ReactNode,
} from "react";
import { useQuery } from "@tanstack/react-query";
import type { RuntimeConfig } from "@workspace/shared";
import { apiFetch } from "./api";

const RuntimeConfigContext = createContext<RuntimeConfig | null>(null);

const CONFIG_QUERY_KEY = ["runtime-config"] as const;

async function fetchRuntimeConfig(): Promise<RuntimeConfig> {
  return apiFetch<RuntimeConfig>("/config"); // GET {apiBase}/config -> /api/config when base is /api
}

export function useRuntimeConfig(): RuntimeConfig {
  const ctx = useContext(RuntimeConfigContext);
  if (!ctx) throw new Error("useRuntimeConfig must be used within RuntimeConfigProvider");
  return ctx;
}

export function useRuntimeConfigQuery() {
  return useQuery({
    queryKey: CONFIG_QUERY_KEY,
    queryFn: fetchRuntimeConfig,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function RuntimeConfigProvider({ children }: { children: ReactNode }) {
  const { data, isPending, error } = useRuntimeConfigQuery();
  if (error) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <p className="text-destructive">Failed to load app config.</p>
      </div>
    );
  }
  if (isPending || !data) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }
  return (
    <RuntimeConfigContext.Provider value={data}>
      {children}
    </RuntimeConfigContext.Provider>
  );
}
