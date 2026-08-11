import type React from "react";
export function Shell({ children }: { children: React.ReactNode }) {
  return <div className="shell">{children}</div>;
}
export function ShellSidebar({
  children,
  mobileOpen,
}: {
  children: React.ReactNode;
  mobileOpen?: boolean;
}) {
  return (
    <aside className={`shell-sidebar${mobileOpen ? " is-open" : ""}`}>
      {children}
    </aside>
  );
}
export function ShellSidebarOverlay({
  visible,
  onClick,
}: {
  visible: boolean;
  onClick: () => void;
}) {
  if (!visible) return null;
  return (
    <button
      type="button"
      className="shell-sidebar-overlay"
      aria-label="Close navigation menu"
      onClick={onClick}
    />
  );
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
