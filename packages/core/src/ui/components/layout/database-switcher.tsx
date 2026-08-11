export function DatabaseSwitcher({
  databases,
  activeDatabaseId,
}: {
  databases: { id: string; name: string }[];
  activeDatabaseId?: string | undefined;
}) {
  if (databases.length < 2) return null;

  return (
    <select
      aria-label="Database"
      className="database-switcher"
      value={activeDatabaseId ?? databases[0]?.id}
      onChange={(event) => {
        const url = new URL(window.location.href);
        url.searchParams.set("db", event.target.value);
        window.location.assign(url.toString());
      }}
    >
      {databases.map((database) => (
        <option key={database.id} value={database.id}>
          {database.name}
        </option>
      ))}
    </select>
  );
}
