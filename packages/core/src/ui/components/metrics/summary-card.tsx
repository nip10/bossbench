import { type LucideIcon, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "../../lib/utils";

export function SummaryCard({
  title,
  value,
  subtitle,
  trend,
  trendPolarity = "up-is-good",
  icon: Icon,
  className,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: { current: number; previous: number } | undefined;
  trendPolarity?: "up-is-good" | "down-is-good";
  icon?: LucideIcon;
  className?: string;
}) {
  const change =
    trend && trend.previous !== 0
      ? ((trend.current - trend.previous) / trend.previous) * 100
      : null;
  const isUp = change !== null && change >= 0;
  const isGood =
    change === null ? null : trendPolarity === "up-is-good" ? isUp : !isUp;

  return (
    <div className={cn("summary-card", className)}>
      <div className="summary-card-head">
        <span>{title}</span>
        {change !== null ? (
          <span
            className={cn(
              "summary-card-trend",
              isGood ? "summary-card-trend-good" : "summary-card-trend-bad",
            )}
          >
            {isUp ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(change).toFixed(0)}%
          </span>
        ) : Icon ? (
          <Icon size={14} />
        ) : null}
      </div>
      <div className="summary-card-value">{value}</div>
      {subtitle ? (
        <div className="summary-card-subtitle">{subtitle}</div>
      ) : null}
    </div>
  );
}
