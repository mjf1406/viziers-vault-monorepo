import { Outlet, createRootRoute } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { RuntimeConfigProvider } from "@/lib/runtime-config";

const queryClient = new QueryClient();

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <RuntimeConfigProvider>
          <Outlet />
        </RuntimeConfigProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export const route = createRootRoute({
  component: RootLayout,
});
