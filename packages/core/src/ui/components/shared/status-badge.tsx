import { cn } from "../../lib/utils";

type StatusVariant = {
  label: string;
  className: string;
};

const statusMap: Record<string, StatusVariant> = {
  created: { label: "Created", className: "state created" },
  retry: { label: "Retry", className: "state retry" },
  active: { label: "Active", className: "state active" },
  completed: { label: "Completed", className: "state completed" },
  cancelled: { label: "Cancelled", className: "state cancelled" },
  failed: { label: "Failed", className: "state failed" },
};

export function StatusBadge({
  state,
  className,
}: {
  state: string;
  className?: string;
}) {
  const config = statusMap[state] ?? { label: state, className: "state" };
  return (
    <span className={cn(config.className, className)}>{config.label}</span>
  );
}
