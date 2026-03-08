import { Link, createFileRoute } from "@tanstack/react-router"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="flex min-h-svh flex-col p-6">
      <div className="mb-6">
        <h1 className="font-medium">Vizier&apos;s Vault</h1>
        <p className="text-muted-foreground text-sm">Choose a section to explore.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 md:max-w-2xl">
        <Link to="/battle-maps" className="block transition-opacity hover:opacity-90">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Battle Maps</CardTitle>
              <CardDescription>
                Manage and view your battle maps for tabletop sessions.
              </CardDescription>
            </CardHeader>
            <CardContent>Go to Battle Maps</CardContent>
          </Card>
        </Link>
        <Link to="/worlds" className="block transition-opacity hover:opacity-90">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Worlds</CardTitle>
              <CardDescription>
                Organize and explore your campaign worlds and settings.
              </CardDescription>
            </CardHeader>
            <CardContent>Go to Worlds</CardContent>
          </Card>
        </Link>
      </div>
      <div className="text-muted-foreground mt-6 font-mono text-xs">
        (Press <kbd>d</kbd> to toggle dark mode)
      </div>
    </div>
  )
}
