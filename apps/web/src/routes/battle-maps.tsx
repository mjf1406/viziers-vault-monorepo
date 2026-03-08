import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/battle-maps")({
  component: BattleMapsPage,
})

function BattleMapsPage() {
  return (
    <div className="flex min-h-svh flex-col p-6">
      <div className="mb-6">
      <h1 className="font-medium">Battle Maps</h1>
      <p className="text-muted-foreground text-sm">
        Your battle maps will appear here. Create and manage maps for your tabletop
        sessions.
      </p>
      </div>
    </div>
  )
}
