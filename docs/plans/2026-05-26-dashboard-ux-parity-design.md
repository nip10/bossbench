# Dashboard UX parity design

Date: 2026-05-26

## Goal

Move Bossbench closer to Workbench's dashboard interaction quality without changing pg-boss data semantics.

## Scope

First wave for issue #9:

- richer command palette with navigation, queue shortcuts, job search, and tag value suggestions;
- sidebar queue shortcuts for quick queue navigation;
- visible keyboard shortcut hints in Settings.

## Non-goals

- Full visual redesign.
- Workbench flow/test pages.
- Desktop.
- New backend endpoints beyond existing search/tags routes.

## Success criteria

- Command palette can navigate routes, queues, matching jobs, and configured tag values.
- Sidebar exposes the first few queues as quick links while preserving compact layout.
- Settings documents keyboard shortcuts for command palette, refresh, and theme toggle.
