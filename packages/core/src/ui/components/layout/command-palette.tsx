import * as React from "react";
import type { JobSummary } from "../../../core/types";
import { useJobSearch, useTagValues } from "../../lib/hooks";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../ui/command";

const NAV_ITEMS: Array<[string, string]> = [
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

function tokenize(value: string) {
  const trimmed = value.replace(/\s+$/, "");
  const lastSpace = trimmed.lastIndexOf(" ");
  const token = lastSpace >= 0 ? trimmed.slice(lastSpace + 1) : trimmed;
  const prefix = lastSpace >= 0 ? trimmed.slice(0, lastSpace + 1) : "";
  return { token, prefix };
}

function replaceToken(value: string, nextToken: string) {
  const { prefix } = tokenize(value);
  return `${prefix}${nextToken}`;
}

function matchQuery(value: string, query: string) {
  if (!query) return true;
  return value.toLowerCase().includes(query);
}

function labelForJob(job: JobSummary) {
  return `${job.name} • ${job.queue} • ${job.state}`;
}

function searchableJobText(job: JobSummary) {
  return `${job.id} ${job.name} ${job.queue} ${job.state} ${JSON.stringify(job.data ?? {})}`;
}

export function CommandPalette({
  open,
  onOpenChange,
  queues,
  tags,
  searchQuery,
  onSearchQueryChange,
  onSelectQueue,
  onSelectJob,
  onNavigate,
  isDark,
  onToggleTheme,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  queues: string[];
  tags: string[];
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onSelectQueue: (queue: string) => void;
  onSelectJob: (jobId: string) => void;
  onNavigate: (path: string) => void;
  isDark?: boolean;
  onToggleTheme?: () => void;
}) {
  const [inputValue, setInputValue] = React.useState(searchQuery);

  React.useEffect(() => {
    if (open) setInputValue(searchQuery);
  }, [open, searchQuery]);

  const query = inputValue.trim().toLowerCase();
  const { token } = tokenize(inputValue);
  const colonIndex = token.indexOf(":");
  const fieldPrefix = colonIndex >= 0 ? token.slice(0, colonIndex) : "";
  const valuePrefix = colonIndex >= 0 ? token.slice(colonIndex + 1) : "";
  const configuredField = tags.find(
    (tag) => tag.toLowerCase() === fieldPrefix.toLowerCase(),
  );
  const showFieldSuggestions = colonIndex < 0;
  const showValueSuggestions = !!configuredField && colonIndex >= 0;

  const jobSearch = useJobSearch(inputValue, open && !!inputValue.trim());
  const tagValues = useTagValues(
    configuredField ?? "",
    open && showValueSuggestions,
  );

  const navItems = React.useMemo<Array<[string, string]>>(
    () =>
      NAV_ITEMS.filter(([path, label]: [string, string]) =>
        matchQuery(`${label} ${path}`, query),
      ),
    [query],
  );
  const queueItems = React.useMemo<string[]>(
    () =>
      queues.filter((queue: string) => matchQuery(queue, query)).slice(0, 8),
    [queues, query],
  );
  const jobItems = React.useMemo<JobSummary[]>(
    () =>
      (jobSearch.data?.items ?? []).filter((job: JobSummary) =>
        matchQuery(searchableJobText(job), query),
      ),
    [jobSearch.data?.items, query],
  );
  const fieldItems = React.useMemo<string[]>(
    () =>
      tags
        .filter((field: string) => matchQuery(field, token.toLowerCase()))
        .slice(0, 8),
    [tags, token],
  );
  const valueItems = React.useMemo<string[]>(
    () =>
      (tagValues.data ?? [])
        .filter((value: string) => matchQuery(value, valuePrefix.toLowerCase()))
        .slice(0, 8),
    [tagValues.data, valuePrefix],
  );
  const hasResults =
    jobItems.length > 0 ||
    navItems.length > 0 ||
    queueItems.length > 0 ||
    fieldItems.length > 0 ||
    valueItems.length > 0 ||
    !!onToggleTheme;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={inputValue}
        onValueChange={(value: string) => {
          setInputValue(value);
          onSearchQueryChange(value);
        }}
        placeholder="Search Bossbench…"
      />
      <CommandList className="cmd-list">
        {jobItems.length ? (
          <CommandGroup heading="Jobs">
            {jobItems.map((job: JobSummary) => (
              <CommandItem
                key={job.id}
                onSelect={() => {
                  onOpenChange(false);
                  onSelectJob(job.id);
                }}
              >
                <span className="cmd-item-main mono">{job.id}</span>
                <span className="cmd-item-sub">{labelForJob(job)}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
        {navItems.length ? (
          <>
            {jobItems.length ? <CommandSeparator /> : null}
            <CommandGroup heading="Navigate">
              {navItems.map(([to, label]: [string, string]) => (
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
          </>
        ) : null}
        {queueItems.length ? (
          <>
            {jobItems.length || navItems.length ? <CommandSeparator /> : null}
            <CommandGroup heading="Queues">
              {queueItems.map((queue: string) => (
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
          </>
        ) : null}
        {showFieldSuggestions && fieldItems.length ? (
          <>
            {jobItems.length || navItems.length || queueItems.length ? (
              <CommandSeparator />
            ) : null}
            <CommandGroup heading="Tags">
              {fieldItems.map((field: string) => (
                <CommandItem
                  key={field}
                  onSelect={() => {
                    const next = replaceToken(inputValue, `${field}:`);
                    setInputValue(next);
                    onSearchQueryChange(next);
                  }}
                >
                  {field}:
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
        {showValueSuggestions && valueItems.length ? (
          <>
            {jobItems.length ||
            navItems.length ||
            queueItems.length ||
            fieldItems.length ? (
              <CommandSeparator />
            ) : null}
            <CommandGroup heading={`${configuredField} values`}>
              {valueItems.map((value: string) => (
                <CommandItem
                  key={value}
                  onSelect={() => {
                    const next = replaceToken(
                      inputValue,
                      `${configuredField}:${value} `,
                    );
                    setInputValue(next);
                    onSearchQueryChange(next);
                  }}
                >
                  <span className="cmd-item-main mono">{value}</span>
                  <span className="cmd-item-sub">{configuredField}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        ) : null}
        {onToggleTheme ? (
          <>
            {hasResults ? <CommandSeparator /> : null}
            <CommandGroup heading="Theme">
              <CommandItem
                onSelect={() => {
                  onOpenChange(false);
                  onToggleTheme();
                }}
              >
                {isDark ? "Switch to light mode" : "Switch to dark mode"}
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}
        {!hasResults ? <CommandEmpty>No matches.</CommandEmpty> : null}
      </CommandList>
    </CommandDialog>
  );
}
