import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/worlds")({
  component: WorldsPage,
})

function WorldsPage() {
  return (
    <div className="flex min-h-svh flex-col p-6">
      <div className="mb-6">
      <h1 className="font-medium">Worlds</h1>
      <p className="text-muted-foreground text-sm">
        Your campaign worlds and settings will appear here. Organize locations,
        lore, and more.
      </p>
      </div>
    </div>
  )
}
