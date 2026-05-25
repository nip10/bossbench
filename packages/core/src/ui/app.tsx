import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { TooltipProvider } from "./components/ui/tooltip";
import { createAppRouter } from "./router";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5_000, refetchOnWindowFocus: true, retry: 1 },
  },
});

function getBasePath() {
  if (typeof document === "undefined") return "/";
  const base = document.querySelector("base")?.getAttribute("href");
  if (base)
    return (
      new URL(base, window.location.href).pathname.replace(/\/$/, "") || "/"
    );
  return "/";
}

const router = createAppRouter(getBasePath());

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider delayDuration={0}>
        <RouterProvider router={router} />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
