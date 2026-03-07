import { createRootRoute, Outlet } from "@tanstack/react-router"
import "@workspace/ui/globals.css"

export const Route = createRootRoute({
  component: () => <Outlet />,
})
