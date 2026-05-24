import type React from "react";

export const NAV = [
  "Overview",
  "Queues",
  "Jobs",
  "Schedules",
  "Dead Letter",
  "Warnings",
  "Metrics",
  "Activity",
  "Settings",
] as const;

export function UiShell({
  title,
  readonly,
  hasBoss,
  screen,
  children,
}: {
  title: string;
  readonly: boolean;
  hasBoss: boolean;
  screen: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        fontFamily: "sans-serif",
        color: "#e5e7eb",
        background: "#0b1020",
        minHeight: "100vh",
        padding: 16,
      }}
    >
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginBottom: 16,
        }}
      >
        <strong>{title}</strong>
        <span>{readonly || !hasBoss ? "Browse-only" : "Actions enabled"}</span>
      </header>
      <nav
        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}
      >
        {NAV.map((n) => (
          <a
            key={n}
            href={`#/${n.toLowerCase().replaceAll(" ", "-")}`}
            style={{ color: screen === n ? "#fff" : "#94a3b8" }}
          >
            {n}
          </a>
        ))}
      </nav>
      {children}
    </div>
  );
}
