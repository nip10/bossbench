# Bossbench desktop parity decision

Date: 2026-05-25

## Context

Current upstream Workbench ships a Tauri desktop app. It is useful for BullMQ because the app can ask for a Redis URL, run a sidecar server, and display the same dashboard outside an existing backend.

Bossbench is pg-boss-native. Its primary data source is Postgres, and mutations should use a real `PgBoss` instance where possible. A desktop app is possible, but it carries higher security and product complexity than a web embed.

## Decision

Desktop parity is **in scope**, but not required for the first npm package release. It should be tracked as a dedicated post-package milestone rather than bundled into adapter/npm readiness.

## Why not ship desktop immediately

- A desktop app needs secure Postgres connection storage.
- Direct database access can expose production data if users paste production credentials.
- pg-boss actions require a `PgBoss` runtime, not just read-only SQL access.
- Tauri signing, update channels, icons, sidecar process management, and platform release workflows are significant surface area.
- The package release can be useful and testable without desktop.

## Proposed desktop scope

When implemented, Bossbench desktop should provide:

- Tauri shell with a local sidecar server.
- Connection onboarding for Postgres URL and pg-boss schema.
- Secure credential storage using platform keychain APIs.
- Read-only mode by default for new connections.
- Explicit opt-in for mutations.
- Connection test against Postgres and pg-boss schema.
- Reuse of the existing Bossbench dashboard UI bundle.
- Same route/data model as embedded adapters.
- Desktop CI and release workflow modeled after Workbench's desktop workflows.

## Proposed architecture

```txt
apps/desktop/
  src/                    # Tauri web UI shell/onboarding/settings
  src-tauri/              # Rust Tauri app, secrets, updater, process mgmt
  sidecar/                # Node/Bun sidecar serving Bossbench core API/UI
```

The sidecar should use `@bossbench/core` directly with a Postgres connection pool. It can start a `PgBoss` instance only when the user enables actions.

## Safety requirements

- Never enable mutations by default.
- Warn when connecting to non-local hosts.
- Do not log connection strings.
- Store secrets only in OS keychain/secure storage.
- Allow users to create named profiles.
- Make schema configurable and default to `pgboss`.
- Provide a clear read-only badge in the UI.

## Follow-up implementation issues

Create these when desktop work starts:

1. Scaffold Tauri desktop app and onboarding shell.
2. Build secure connection profile storage.
3. Build pg-boss/Postgres sidecar server.
4. Reuse Bossbench UI bundle inside desktop shell.
5. Add desktop packaging/signing/release workflows.
6. Add desktop smoke tests.

## Current status

Desktop remains tracked in GitHub issue #8 as a planned post-release parity milestone. The npm package release should proceed without desktop.
