import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { BossbenchJobState } from "../../../core/types";

const STATE_COLOR: Record<BossbenchJobState, string> = {
  created: "#fcd34d",
  retry: "#fcd34d",
  active: "#93c5fd",
  completed: "#86efac",
  cancelled: "#fca5a5",
  failed: "#fca5a5",
};

const STATE_LABEL: Record<BossbenchJobState, string> = {
  created: "Created",
  retry: "Retry",
  active: "Active",
  completed: "Completed",
  cancelled: "Cancelled",
  failed: "Failed",
};

export function StateBreakdownChart({
  totals,
}: {
  totals: Record<BossbenchJobState, number>;
}) {
  const entries = (Object.entries(totals) as [BossbenchJobState, number][])
    .filter(([, count]) => count > 0)
    .sort((left, right) => right[1] - left[1]);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  if (!total) return null;

  return (
    <div className="state-breakdown">
      <div className="state-breakdown-chart">
        <ResponsiveContainer width="100%" height={140}>
          <PieChart>
            <Pie
              data={entries.map(([state, count]) => ({ state, count }))}
              dataKey="count"
              nameKey="state"
              innerRadius={44}
              outerRadius={64}
              paddingAngle={2}
              stroke="none"
            >
              {entries.map(([state]) => (
                <Cell key={state} fill={STATE_COLOR[state]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#0d0d0d",
                border: "1px solid rgba(255,255,255,0.09)",
                borderRadius: 6,
                fontSize: 12,
                fontFamily: "inherit",
              }}
              labelStyle={{ color: "#8a8a8a" }}
              formatter={(value: number, _name, entry) => [
                value.toLocaleString(),
                STATE_LABEL[entry.payload.state as BossbenchJobState],
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="state-breakdown-total">
          <strong>{total.toLocaleString()}</strong>
          <span>total</span>
        </div>
      </div>
      <div className="state-breakdown-legend">
        {entries.map(([state, count]) => (
          <div className="state-breakdown-legend-row" key={state}>
            <span
              className="state-breakdown-swatch"
              style={{ background: STATE_COLOR[state] }}
              aria-hidden="true"
            />
            <span>{STATE_LABEL[state]}</span>
            <strong>{count.toLocaleString()}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}
