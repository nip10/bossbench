import {
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command";
export function CommandPalette({
  open,
  onOpenChange,
  queues,
  searchQuery,
  onSearchQueryChange,
  onSelectQueue,
  onNavigate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queues: string[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSelectQueue: (queue: string) => void;
  onNavigate: (path: string) => void;
}) {
  const navItems: Array<[string, string]> = [
    ["/", "Overview"],
    ["/jobs", "Jobs"],
    ["/queues", "Queues"],
    ["/schedules", "Schedules"],
    ["/dead-letter", "Dead Letter"],
    ["/warnings", "Warnings"],
    ["/metrics", "Metrics"],
    ["/activity", "Activity"],
    ["/settings", "Settings"],
  ];
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={searchQuery}
        onValueChange={onSearchQueryChange}
        placeholder="Search Bossbench…"
      />
      <CommandList>
        <CommandGroup heading="Navigate">
          {navItems.map(([to, label]) => (
            <CommandItem
              key={to}
              onSelect={() => {
                onOpenChange(false);
                onNavigate(to);
              }}
            >
              {label}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandGroup heading="Queues">
          {queues.slice(0, 8).map((queue) => (
            <CommandItem
              key={queue}
              onSelect={() => {
                onOpenChange(false);
                onSelectQueue(queue);
              }}
            >
              {queue}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
