import type React from "react";
export function Shell({ children }: { children: React.ReactNode }) {
  return <div className="shell">{children}</div>;
}
export function ShellSidebar({ children }: { children: React.ReactNode }) {
  return <aside className="shell-sidebar">{children}</aside>;
}
export function ShellContent({ children }: { children: React.ReactNode }) {
  return <div className="shell-content">{children}</div>;
}
export function ShellHeader({ children }: { children: React.ReactNode }) {
  return <header className="shell-header">{children}</header>;
}
export function ShellMain({ children }: { children: React.ReactNode }) {
  return <main className="shell-main">{children}</main>;
}
