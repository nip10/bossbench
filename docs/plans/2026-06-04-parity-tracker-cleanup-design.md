# Parity tracker cleanup design

Date: 2026-06-04

## Context

Recent PRs implemented the latest non-desktop Workbench parity follow-ups:

- #59 queue clean semantics: preview plus explicit destructive delete flags, direct SQL safety, audit events, and UI/docs.
- #71 alert evaluation and Alerts page.
- #72 alert delivery runner and webhook primitives.
- #73 Slack and Discord alert destinations.
- #74 docs expansion.
- #75 marketing/discoverability cleanup.

GitHub now reports only desktop issues as open parity issues. `docs/workbench-parity-tracker.md` still lists the completed #59 and #71-#75 follow-ups as open/current work, so the tracker needs a state-only cleanup.

## Goals

- Make the parity tracker reflect merged work and current GitHub issue state.
- Preserve the historical upstream audit log.
- Keep desktop issues as the only open parity items while explicitly noting desktop is deferred for now.
- Avoid creating new tickets or changing product code.

## Changes

Update `docs/workbench-parity-tracker.md`:

1. Current summary:
   - Say current non-desktop Workbench parity is strong/mostly complete.
   - Mention alerting, docs/marketing, and destructive queue clean as implemented/adapted.
   - Note desktop remains deferred.
2. Open parity issues:
   - Remove #59 and #71-#75.
   - Keep #14 and #29-#34.
3. Dashboard UI/product rows:
   - Change Alerts dashboard from `Planned` to `Implemented` or `Adapted`.
4. Backend/API rows:
   - Keep Queue clean as `Implemented`.
   - Change Alert evaluation and delivery from `Planned` to `Implemented` or `Adapted`.
5. Ecosystem/docs row:
   - Mark structured docs/discoverability work as completed, not tracked by open #74/#75.
6. Remaining priority order:
   - Remove alerting/docs/marketing and queue-clean work.
   - Leave job detail polish, command-center polish, and desktop deferred as the next themes.

## Non-goals

- No source code changes.
- No issue creation.
- No issue closing; PR merges already closed the relevant issues.
- No new upstream audit.

## Verification

- `git diff --check -- docs/workbench-parity-tracker.md`
- Manual review that the tracker no longer lists closed non-desktop issues as open.
