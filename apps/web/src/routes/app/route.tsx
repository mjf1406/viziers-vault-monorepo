import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { authClient } from "@/lib/auth-client";
import { Button } from "@workspace/ui/components/button";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function AppLayout() {
  const config = useRuntimeConfig();
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending) return;
    if (config.auth.enabled && !session) {
      navigate({ to: "/sign-in" });
    }
  }, [config.auth.enabled, session, isPending, navigate]);

  if (config.auth.enabled && isPending) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <p className="text-muted-foreground">Loading…</p>
      </div>
    );
  }
  if (config.auth.enabled && !session) {
    return null;
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <h1 className="font-medium">Vizier&apos;s Vault</h1>
        {config.auth.enabled && session && (
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await authClient.signOut();
              navigate({ to: "/sign-in" });
            }}
          >
            Sign out
          </Button>
        )}
      </header>
      <main className="flex-1 p-4">
        <Outlet />
      </main>
    </div>
  );
}
