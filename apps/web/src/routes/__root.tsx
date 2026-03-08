import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { Outlet, createRootRoute } from "@tanstack/react-router"
import { ThemeProvider } from "@/components/theme-provider"
import { TooltipProvider } from "@workspace/ui/components/tooltip"

const queryClient = new QueryClient()

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <Outlet />
        </TooltipProvider>
      </ThemeProvider>
      <ReactQueryDevtools buttonPosition="bottom-right" />
    </QueryClientProvider>
  )
}
