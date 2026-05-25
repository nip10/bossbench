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
  disabled = false,
}: {
  value: string;
  onValueChange: (value: string) => void;
  state?: string;
  onStateChange?: (value: string) => void;
  placeholder?: string;
  states?: Array<{ value: string; label: string }>;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <div className={cn("smart-search", className)}>
      <div className="search">
        <Search size={14} />
        <input
          className="input"
          aria-label="Search"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={placeholder}
          disabled={disabled}
        />
      </div>
      {states && onStateChange ? (
        <select
          value={state}
          onChange={(event) => onStateChange(event.target.value)}
          disabled={disabled}
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
