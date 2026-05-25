"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

export function ActionButton({
  href,
  label,
  icon,
  shortcut,
  variant = "primary",
  external,
}: {
  href: string;
  label: string;
  icon: ReactNode;
  shortcut?: string;
  variant?: "primary" | "secondary";
  external?: boolean;
}) {
  useEffect(() => {
    if (!shortcut) return;
    const key = shortcut.toLowerCase();
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
        return;
      const el = event.target as HTMLElement | null;
      if (el && ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName)) return;
      if (event.key.toLowerCase() !== key) return;
      event.preventDefault();
      if (external) {
        window.open(href, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = href;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcut, href, external]);

  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer noopener" : undefined}
      className={`action-btn action-btn-${variant}`}
    >
      <span className="icon-wrap">{icon}</span>
      <span>{label}</span>
      {shortcut ? (
        <span className={`action-btn-chip-${variant}`}>
          {shortcut.toUpperCase()}
        </span>
      ) : null}
    </a>
  );
}
