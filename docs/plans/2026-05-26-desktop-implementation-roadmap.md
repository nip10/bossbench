# Desktop implementation roadmap

Date: 2026-05-26

## Goal

Track the remaining work required to reach Workbench desktop parity while preserving Bossbench's pg-boss/Postgres safety requirements.

## Current blocker

Desktop implementation requires a Rust/Tauri toolchain for local development and CI. The current local environment does not have `rustc` or `cargo`, so this wave records the implementation plan and child issues rather than adding an unverifiable Tauri app scaffold.

## Child issues

- [#29 Desktop: Scaffold Tauri shell and onboarding](https://github.com/nip10/bossbench/issues/29)
- [#30 Desktop: Secure connection profile storage](https://github.com/nip10/bossbench/issues/30)
- [#31 Desktop: Build pg-boss sidecar server](https://github.com/nip10/bossbench/issues/31)
- [#32 Desktop: Reuse embedded dashboard UI in desktop](https://github.com/nip10/bossbench/issues/32)
- [#33 Desktop: Add desktop CI and release pipeline](https://github.com/nip10/bossbench/issues/33)
- [#34 Desktop: Add desktop smoke tests](https://github.com/nip10/bossbench/issues/34)

## Architecture target

```txt
apps/desktop/
  src/                    # Tauri web UI shell, onboarding, settings
  src-tauri/              # Rust Tauri app, keychain, process lifecycle
  sidecar/                # Bun sidecar serving @bossbench/core API/UI
```

The desktop app should reuse the same Bossbench dashboard routes and DTOs as embedded adapters. Desktop chrome/onboarding should wrap the dashboard, not fork dashboard behavior.

## Safety requirements

- New desktop connections default to read-only.
- Mutations require explicit opt-in per profile/session.
- Connection strings/passwords are stored only in OS secure storage.
- Non-local database hosts show a warning before saving/running.
- The sidecar binds only to loopback.
- Connection strings are never logged.
- Schema defaults to `pgboss` and remains configurable.

## Implementation order

1. Install/verify Rust and Tauri 2 toolchain locally and in CI.
2. Scaffold `apps/desktop` with onboarding-only UI and no secrets storage.
3. Add secure profile storage.
4. Add read-only sidecar browsing.
5. Add explicit mutation opt-in and `PgBoss` sidecar runtime.
6. Reuse dashboard UI bundle/source inside desktop shell.
7. Add desktop CI, packaging, signing/notarization docs, and smoke tests.

## Verification requirements

Before closing #14, the project should have:

- reproducible desktop dev startup;
- desktop build or CI smoke path;
- secure storage tests/manual verification;
- sidecar health/config smoke test;
- read-only default test;
- documented unsigned-dev and signed-release workflows.
