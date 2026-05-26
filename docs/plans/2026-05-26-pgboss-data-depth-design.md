# pg-boss data depth design

Date: 2026-05-26

## Goal

Improve Bossbench's pg-boss-specific surfaces without adding unsupported Workbench/BullMQ concepts.

## Scope

First wave for issue #12:

- allow schedule creation with JSON data from the UI;
- make warning empty states explain pg-boss warning persistence;
- make dead-letter exploration more useful with summary cards and clearer copy.

## Non-goals

- Editing arbitrary job payload/state.
- Queue pause/resume/promote/clean.
- pg-boss schedule options/timezone mutation unless verified against pg-boss API in a separate wave.
- Desktop.

## Success criteria

- Schedules page supports optional JSON data when creating schedules.
- Invalid schedule JSON shows inline feedback and does not call the API.
- Warnings empty state explains that warning persistence depends on pg-boss warning configuration.
- Dead-letter page shows high-level failed/dead-letter context before the table.
