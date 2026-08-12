import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import type { MetricPoint } from "../../../core/types";

function formatBucketLabel(bucket: string) {
  return new Date(bucket).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ThroughputChart({ buckets }: { buckets: MetricPoint[] }) {
  const data = buckets
    .slice(0, 24)
    .slice()
    .reverse()
    .map((point) => ({
      label: formatBucketLabel(point.bucket),
      completed: point.completed,
      failed: point.failed,
    }));

  if (!data.length) return null;

  return (
    <div className="throughput-chart">
      <ResponsiveContainer width="100%" height={140}>
        <AreaChart
          data={data}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient
              id="throughput-completed"
              x1="0"
              y1="0"
              x2="0"
              y2="1"
            >
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="throughput-failed" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.06)"
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fill: "#8a8a8a", fontSize: 10 }}
            axisLine={{ stroke: "rgba(255,255,255,0.09)" }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <Tooltip
            contentStyle={{
              background: "#0d0d0d",
              border: "1px solid rgba(255,255,255,0.09)",
              borderRadius: 6,
              fontSize: 12,
              fontFamily: "inherit",
            }}
            labelStyle={{ color: "#8a8a8a" }}
            itemStyle={{ fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="completed"
            name="Completed"
            stroke="#22c55e"
            fill="url(#throughput-completed)"
            strokeWidth={1.5}
          />
          <Area
            type="monotone"
            dataKey="failed"
            name="Failed"
            stroke="#ef4444"
            fill="url(#throughput-failed)"
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
