import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";

export function SummaryCard({
  title,
  value,
  subtitle,
  trend,
  icon: Icon,
  className,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { current: number; previous: number };
  icon?: LucideIcon;
  className?: string;
}) {
  const change =
    trend && trend.previous !== 0
      ? ((trend.current - trend.previous) / trend.previous) * 100
      : null;

  return (
    <div className={cn("summary-card", className)}>
      <div className="summary-card-head">
        <span>{title}</span>
        {Icon ? <Icon size={14} /> : null}
      </div>
      <div className="summary-card-value">{value}</div>
      {subtitle ? (
        <div className="summary-card-subtitle">{subtitle}</div>
      ) : null}
      {change !== null ? (
        <div className="summary-card-trend">
          {change > 0 ? "+" : ""}
          {Math.abs(change).toFixed(0)}%
        </div>
      ) : null}
    </div>
  );
}
