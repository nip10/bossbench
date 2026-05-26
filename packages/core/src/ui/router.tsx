import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useLocation,
  useNavigate,
} from "@tanstack/react-router";
import { RefreshCw } from "lucide-react";
import * as React from "react";
import { CommandPalette } from "./components/layout/command-palette";
import { Header } from "./components/layout/header";
import { HeaderSearch } from "./components/layout/header-search";
import {
  Shell,
  ShellContent,
  ShellHeader,
  ShellMain,
  ShellSidebar,
} from "./components/layout/shell";
import { Sidebar } from "./components/layout/sidebar";
import { Button } from "./components/ui/button";
import { useConfig, useQueues } from "./lib/hooks";
import {
  ActivityPage,
  DeadLetterPage,
  JobPage,
  MetricsPage,
  OverviewPage,
  QueuePage,
  QueuesPage,
  RunsPage,
  SchedulersPage,
  SettingsPage,
  WarningsPage,
} from "./pages";

type SearchContextValue = {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  setCommandOpen: (open: boolean) => void;
};
const SearchContext = React.createContext<SearchContextValue | null>(null);
export function useDashboardSearch() {
  const v = React.useContext(SearchContext);
  if (!v) throw new Error("Missing SearchContext");
  return v;
}

const rootRoute = createRootRoute({ component: RootLayout });
const overviewRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: OverviewPage,
});
const jobsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "jobs",
  component: RunsPage,
});
const jobRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "jobs/$jobId",
  component: JobPage,
});
const queuesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "queues",
  component: QueuesPage,
});
const queueRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "queues/$queueName",
  component: QueuePage,
});
const schedulesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "schedules",
  component: SchedulersPage,
});
const deadRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "dead-letter",
  component: DeadLetterPage,
});
const warningsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "warnings",
  component: WarningsPage,
});
const metricsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "metrics",
  component: MetricsPage,
});
const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "activity",
  component: ActivityPage,
});
const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "settings",
  component: SettingsPage,
});
const routeTree = rootRoute.addChildren([
  overviewRoute,
  jobsRoute,
  jobRoute,
  queuesRoute,
  queueRoute,
  schedulesRoute,
  deadRoute,
  warningsRoute,
  metricsRoute,
  activityRoute,
  settingsRoute,
]);

export function createAppRouter(basepath: string) {
  return createRouter({ routeTree, basepath, defaultPreload: "intent" });
}
declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

function RootLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: config, isLoading } = useConfig();
  const { data: queues = [] } = useQueues();
  const [searchQuery, setSearchQuery] = React.useState("");
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem("bossbench:theme");
    return stored
      ? stored === "dark"
      : window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
    localStorage.setItem("bossbench:theme", isDark ? "dark" : "light");
  }, [isDark]);

  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r") {
        event.preventDefault();
        window.location.reload();
      }
      if (
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        event.key.toLowerCase() === "t"
      ) {
        event.preventDefault();
        setIsDark((d: boolean) => !d);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const nav = location.pathname.startsWith("/jobs")
    ? "jobs"
    : location.pathname.startsWith("/queues")
      ? "queues"
      : location.pathname.startsWith("/schedules")
        ? "schedules"
        : location.pathname.startsWith("/dead-letter")
          ? "dead-letter"
          : location.pathname.startsWith("/warnings")
            ? "warnings"
            : location.pathname.startsWith("/metrics")
              ? "metrics"
              : location.pathname.startsWith("/activity")
                ? "activity"
                : location.pathname.startsWith("/settings")
                  ? "settings"
                  : "overview";
  const title =
    nav === "overview"
      ? "Overview"
      : nav === "jobs"
        ? "Jobs"
        : nav === "queues"
          ? "Queues"
          : nav === "schedules"
            ? "Schedules"
            : nav === "dead-letter"
              ? "Dead Letter"
              : nav === "warnings"
                ? "Warnings"
                : nav === "metrics"
                  ? "Metrics"
                  : nav === "activity"
                    ? "Activity"
                    : "Settings";
  const pageSubtitle = config
    ? `${config.schema ?? "pgboss"} • ${config.readonly || !config.hasBoss ? "browse-only" : "actions enabled"}`
    : "Loading…";
  const readonly = !!config?.readonly || !config?.hasBoss;
  const configuredTags = config?.tags ?? [];

  if (isLoading || !config)
    return <div className="app-loading">Loading Bossbench…</div>;

  return (
    <SearchContext.Provider
      value={{ searchQuery, setSearchQuery, setCommandOpen }}
    >
      <Shell>
        <ShellSidebar>
          <Sidebar
            activeNav={nav}
            queues={queues.map((q: { name: string }) => q.name)}
            isDark={isDark}
            onToggleTheme={() => setIsDark((d: boolean) => !d)}
          />
        </ShellSidebar>
        <ShellContent>
          <ShellHeader>
            <Header
              title={title}
              subtitle={pageSubtitle}
              actions={
                <>
                  <HeaderSearch
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    onFocus={() => setCommandOpen(true)}
                    placeholder={nav === "jobs" ? "Search jobs…" : "Search…"}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.location.reload()}
                  >
                    <RefreshCw size={16} />
                  </Button>
                </>
              }
            />
          </ShellHeader>
          <ShellMain>
            {readonly ? (
              <div className="banner">
                Browse-only mode: mutations are disabled when readonly or when
                no pg-boss instance is attached.
              </div>
            ) : null}
            <Outlet />
          </ShellMain>
        </ShellContent>
        <CommandPalette
          open={commandOpen}
          onOpenChange={setCommandOpen}
          queues={queues.map((q: { name: string }) => q.name)}
          tags={configuredTags}
          onNavigate={(to) => navigate({ to: to as never })}
          onSelectQueue={(queue) =>
            navigate({
              to: "/queues/$queueName",
              params: { queueName: queue } as never,
            })
          }
          onSelectJob={(jobId) =>
            navigate({
              to: "/jobs/$jobId",
              params: { jobId } as never,
            })
          }
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          isDark={isDark}
          onToggleTheme={() => setIsDark((d: boolean) => !d)}
        />
      </Shell>
    </SearchContext.Provider>
  );
}
