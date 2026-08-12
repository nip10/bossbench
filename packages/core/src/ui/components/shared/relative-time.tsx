"use client";

import { formatAbsoluteTime, formatRelativeTime } from "../../lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function RelativeTime({
  timestamp,
  className,
}: {
  timestamp: string | number | null | undefined;
  className?: string;
}) {
  if (timestamp === null || timestamp === undefined) return <span>—</span>;

  const absolute = formatAbsoluteTime(timestamp);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={className}>{formatRelativeTime(timestamp)}</span>
      </TooltipTrigger>
      <TooltipContent className="tooltip-content">
        <span className="mono">{absolute}</span>
      </TooltipContent>
    </Tooltip>
  );
}
