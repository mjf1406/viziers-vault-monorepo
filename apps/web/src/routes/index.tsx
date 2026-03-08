import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  const config = useRuntimeConfig();
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (isPending) return;
    if (!config.auth.enabled) {
      navigate({ to: "/app" });
      return;
    }
    if (session) {
      navigate({ to: "/app" });
    } else {
      navigate({ to: "/sign-in" });
    }
  }, [config.auth.enabled, session, isPending, navigate]);

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <p className="text-muted-foreground">Redirecting…</p>
    </div>
  );
}
