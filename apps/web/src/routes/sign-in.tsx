import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useRuntimeConfig } from "@/lib/runtime-config";
import { authClient } from "@/lib/auth-client";
import { Button } from "@workspace/ui/components/button";

export const Route = createFileRoute("/sign-in")({
  component: SignInPage,
});

function SignInPage() {
  const config = useRuntimeConfig();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { signIn, signUp } = authClient;

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await signIn.email({ email, password });
      if (res.error) {
        setError(res.error.message ?? "Sign in failed");
        return;
      }
      navigate({ to: "/app" });
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    await signIn.social({ provider: "google", callbackURL: "/app" });
  };

  if (!config.auth.enabled) {
    navigate({ to: "/app" });
    return null;
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-xl font-medium">Sign in</h1>
        <form onSubmit={handleEmailSignIn} className="space-y-4">
          <div>
            <label htmlFor="email" className="text-muted-foreground text-sm">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-muted-foreground text-sm">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="border-input bg-background mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          {error && (
            <p className="text-destructive text-sm">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="text-muted-foreground text-center text-sm">
          Don&apos;t have an account? Sign up with email below.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            setLoading(true);
            try {
              const res = await signUp.email({ email, password, name: email.split("@")[0] });
              if (res.error) {
                setError(res.error.message ?? "Sign up failed");
                return;
              }
              navigate({ to: "/app" });
            } finally {
              setLoading(false);
            }}
          }
          className="space-y-4"
        >
          <Button type="submit" variant="outline" className="w-full" disabled={loading}>
            Sign up with email
          </Button>
        </form>
        {config.auth.providers.google && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
          >
            Sign in with Google
          </Button>
        )}
      </div>
    </div>
  );
}
