const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
export function assertSafeIdentifier(name: string): string {
  if (!IDENTIFIER_RE.test(name))
    throw new Error(`Invalid Postgres identifier: ${name}`);
  return name;
}
export function quoteIdentifier(name: string): string {
  return `"${assertSafeIdentifier(name).replaceAll('"', '""')}"`;
}
export function quoteQualifiedIdentifier(...parts: string[]): string {
  return parts.map(quoteIdentifier).join(".");
}
