# Job timeline design

## Goal

Adapt upstream Workbench's BullMQ logs tab into a pg-boss-native job Timeline tab without pretending pg-boss has BullMQ `job.log()` semantics.

## Design

- Build timeline data from reliable `JobDetail` fields: `createdOn`, `startAfter`, `startedOn`, `completedOn`, `state`, retry counts, and dead-letter presence.
- Render timestamped lifecycle events as the actual timeline.
- Render non-timestamped retry/dead-letter facts as context cards below the timeline so they do not look like fabricated log entries.
- Keep the feature read-only and local to job detail.

## Tracking

- Closes #53.
