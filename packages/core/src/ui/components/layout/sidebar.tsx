import { Link } from "@tanstack/react-router";
import {
  Activity,
  BarChart3,
  Bell,
  Calendar,
  Database,
  Layers3,
  ListTodo,
  Settings,
  Zap,
} from "lucide-react";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

const items = [
  ["/", "Overview", Database],
  ["/jobs", "Jobs", ListTodo],
  ["/queues", "Queues", Layers3],
  ["/schedules", "Schedules", Calendar],
  ["/dead-letter", "Dead Letter", Zap],
  ["/warnings", "Warnings", Bell],
  ["/metrics", "Metrics", BarChart3],
  ["/activity", "Activity", Activity],
  ["/settings", "Settings", Settings],
] as const;

export function Sidebar({
  activeNav,
  queues: _queues,
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
            <TooltipContent side="right">{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
      <div className="sidebar-bottom">
        <Button variant="ghost" size="icon" onClick={onToggleTheme}>
          {isDark ? "☀" : "☾"}
        </Button>
      </div>
    </>
  );
}
