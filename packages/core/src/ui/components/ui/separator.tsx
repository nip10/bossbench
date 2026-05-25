export function Separator({ className }: { className?: string }) {
  return (
    <div
      className={className}
      style={{ height: 1, background: "var(--border)" }}
    />
  );
}
