import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "../../lib/utils";

export type SortDirection = "asc" | "desc";

export interface SortState {
  field: string;
  direction: SortDirection;
}

export function parseSort(sort?: string) {
  if (!sort) return undefined;
  const [field, direction] = sort.split(":");
  if (!field) return undefined;
  return { field, direction: direction === "asc" ? "asc" : "desc" } as const;
}

export function createSort(field: string, direction: SortDirection) {
  return `${field}:${direction}`;
}

export function SortableHeader({
  field,
  label,
  currentSort,
  onSort,
  className,
  defaultDirection = "desc",
}: {
  field: string;
  label: string;
  currentSort: SortState | undefined;
  onSort: (
    field: string | undefined,
    direction: SortDirection | undefined,
  ) => void;
  className?: string;
  defaultDirection?: SortDirection;
}) {
  const active = currentSort?.field === field;
  const direction = active ? currentSort.direction : undefined;

  return (
    <button
      type="button"
      onClick={() => {
        if (!active) return onSort(field, defaultDirection);
        if (direction === "desc") return onSort(field, "asc");
        return onSort(undefined, undefined);
      }}
      className={cn("sortable-header", active ? "active" : "", className)}
    >
      <span>{label}</span>
      {active ? (
        direction === "asc" ? (
          <ArrowUp size={12} />
        ) : (
          <ArrowDown size={12} />
        )
      ) : (
        <ArrowUpDown size={12} />
      )}
    </button>
  );
}
