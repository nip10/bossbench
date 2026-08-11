import { Menu, RefreshCw } from "lucide-react";
import type React from "react";
import { Button } from "../ui/button";
import { DatabaseSwitcher } from "./database-switcher";

export function Header({
  title,
  subtitle,
  refreshCue,
  actions,
  onOpenMenu,
  databases,
  activeDatabaseId,
}: {
  title: string;
  subtitle?: string;
  refreshCue?: string;
  actions?: React.ReactNode;
  onOpenMenu?: () => void;
  databases?: { id: string; name: string }[] | undefined;
  activeDatabaseId?: string | undefined;
}) {
  return (
    <>
      {onOpenMenu ? (
        <Button
          variant="ghost"
          size="icon"
          className="mobile-menu-button"
          aria-label="Open navigation menu"
          title="Open navigation menu"
          onClick={onOpenMenu}
        >
          <Menu size={16} />
        </Button>
      ) : null}
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
            {databases ? (
              <DatabaseSwitcher
                databases={databases}
                activeDatabaseId={activeDatabaseId}
              />
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
