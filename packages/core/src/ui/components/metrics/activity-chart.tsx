import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { ActivityPoint } from "../../../core/types";

function formatBucketLabel(bucket: string) {
  return new Date(bucket).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ActivityChart({ items }: { items: ActivityPoint[] }) {
  const data = items
    .slice(0, 24)
    .slice()
    .reverse()
    .map((point) => ({
      label: formatBucketLabel(point.bucket),
      created: point.created,
      completed: point.completed,
      failed: point.failed,
    }));

  if (!data.length) return null;

  return (
    <div className="activity-chart">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            axisLine={{ stroke: "var(--border)" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "inherit",
            }}
            labelStyle={{ color: "var(--muted-foreground)" }}
            itemStyle={{ fontSize: 12, color: "var(--foreground)" }}
            cursor={{ fill: "rgba(255,255,255,0.04)" }}
          />
          <Bar
            dataKey="created"
            name="Created"
            stackId="activity"
            fill="#fcd34d"
            radius={0}
          />
          <Bar
            dataKey="completed"
            name="Completed"
            stackId="activity"
            fill="#22c55e"
            radius={0}
          />
          <Bar
            dataKey="failed"
            name="Failed"
            stackId="activity"
            fill="#ef4444"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
