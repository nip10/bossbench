"use client";

import { Search } from "lucide-react";
import { cn } from "../../lib/utils";

export function SmartSearch({
  value,
  onValueChange,
  state,
  onStateChange,
  placeholder = "Search…",
  states,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  state?: string;
  onStateChange?: (value: string) => void;
  placeholder?: string;
  states?: Array<{ value: string; label: string }>;
  className?: string;
}) {
  return (
    <div className={cn("smart-search", className)}>
      <div className="search">
        <Search size={14} />
        <input
          className="input"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={placeholder}
        />
      </div>
      {states && onStateChange ? (
        <select
          value={state}
          onChange={(event) => onStateChange(event.target.value)}
        >
          {states.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
