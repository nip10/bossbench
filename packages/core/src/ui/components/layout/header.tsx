import { RefreshCw } from "lucide-react";
import type React from "react";
import { Button } from "../ui/button";

export function Header({
  title,
  subtitle,
  refreshCue,
  actions,
}: {
  title: string;
  subtitle?: string;
  refreshCue?: string;
  actions?: React.ReactNode;
}) {
  return (
    <>
      <div className="header-title">
        <div className="header-copy">
          <h1>{title}</h1>
          <div className="header-subtitle-row">
            {subtitle ? <p>{subtitle}</p> : null}
            {refreshCue ? (
              <span className="header-refresh-cue" aria-live="polite">
                {refreshCue}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="header-actions">
        {actions}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Refresh dashboard"
          title="Refresh dashboard"
          onClick={() => window.location.reload()}
        >
          <RefreshCw size={16} />
        </Button>
      </div>
    </>
  );
}
