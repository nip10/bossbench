import { Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Calendar,
  Clock3,
  Database,
  Layers3,
  ListTodo,
  Settings,
  Zap,
} from "lucide-react";
import { sidebarQueueListLimit } from "../../lib/dashboard-polish";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

const items = [
  ["/", "Overview", Database],
  ["/jobs", "Jobs", ListTodo],
  ["/future-jobs", "Future Jobs", Clock3],
  ["/queues", "Queues", Layers3],
  ["/schedules", "Schedules", Calendar],
  ["/dead-letter", "Dead Letter", Zap],
  ["/warnings", "Warnings", Bell],
  ["/alerts", "Alerts", AlertTriangle],
  ["/metrics", "Metrics", BarChart3],
  ["/activity", "Activity", Activity],
  ["/settings", "Settings", Settings],
] as const;

export function Sidebar({
  activeNav,
  queues,
  isDark,
  onToggleTheme,
}: {
  activeNav: string;
  queues: string[];
  isDark: boolean;
  onToggleTheme: () => void;
  title?: string;
}) {
  return (
    <>
      <div className="sidebar-top">
        <strong className="mono">BB</strong>
      </div>
      <div className="sidebar-nav">
        {items.map(([to, label, Icon]) => (
          <Tooltip key={to}>
            <TooltipTrigger asChild>
              <Link
                to={to as never}
                className={`sidebar-link${activeNav === to.replace(/^\//, "") || (to === "/" && activeNav === "overview") ? " active" : ""}`}
              >
                <Icon size={16} />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="tooltip-content">
              {label}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
      {queues.length ? (
        <div className="sidebar-queues">
          {queues.slice(0, sidebarQueueListLimit()).map((queue) => (
            <Tooltip key={queue}>
              <TooltipTrigger asChild>
                <Link
                  to="/queues/$queueName"
                  params={{ queueName: queue } as never}
                  className={`sidebar-queue-link${activeNav === "queues" ? " active" : ""}`}
                  aria-label={`Open queue ${queue}`}
                >
                  <span className="mono">
                    {queue.slice(0, 2).toUpperCase()}
                  </span>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="tooltip-content">
                {queue}
              </TooltipContent>
            </Tooltip>
          ))}
        </div>
      ) : null}
      <div className="sidebar-bottom">
        <Button variant="ghost" size="icon" onClick={onToggleTheme}>
          {isDark ? "☀" : "☾"}
        </Button>
      </div>
    </>
  );
}
