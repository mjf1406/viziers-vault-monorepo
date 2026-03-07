import { createFileRoute, Link } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { apiClient } from "@/lib/api-client"
import { Button } from "@workspace/ui/components/button"

export const Route = createFileRoute("/")({ component: App })

type MeResponse = { user: { id: string; email: string | null; name: string | null }; session: { id: string; expiresAt: string } }

function App() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiClient<MeResponse>({ path: "/me", credentials: "include" }),
    retry: false,
  })

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Viziers Vault</h1>
          {isLoading && <p>Checking session…</p>}
          {isError && (
            <>
              <p>You are not logged in.</p>
              <div className="mt-2 flex gap-2">
                <Link to="/login">
                  <Button variant="default">Log in</Button>
                </Link>
                <Link to="/signup">
                  <Button variant="outline">Sign up</Button>
                </Link>
              </div>
            </>
          )}
          {data && (
            <>
              <p>Logged in as {data.user.name ?? data.user.email ?? data.user.id}</p>
              <p className="text-muted-foreground">Session expires: {new Date(data.session.expiresAt).toLocaleString()}</p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
