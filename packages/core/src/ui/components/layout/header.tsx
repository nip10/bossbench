import { RefreshCw } from "lucide-react";
import type React from "react";
import { Button } from "../ui/button";

export function Header({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <>
      <div className="header-title">
        <div>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
      </div>
      <div className="header-actions">
        {actions}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => window.location.reload()}
        >
          <RefreshCw size={16} />
        </Button>
      </div>
    </>
  );
}
