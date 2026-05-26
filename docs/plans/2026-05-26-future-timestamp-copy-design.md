# Future timestamp copy design

## Goal

Make Bossbench relative timestamps explicit for future pg-boss times, matching the useful upstream Workbench behavior while keeping pg-boss semantics.

## Scope

This first development slice covers only shared timestamp formatting in `packages/core/src/ui/lib/utils.ts`. Surfaces that already use `RelativeTime` automatically benefit. Larger future-job/schedule separation remains tracked separately in GitHub issue #37.

## Design

`formatRelativeTime` should keep its existing null and invalid-date fallbacks, but branch on timestamp direction:

- past timestamps render as `0s ago`, `5s ago`, `2m ago`, `3h ago`, then absolute locale string for older dates;
- future timestamps render as `in 0s`, `in 5s`, `in 2m`, `in 3h`, then absolute locale string for dates more than a day away;
- null/undefined render as `—`;
- invalid strings render unchanged.

This is intentionally smaller than upstream's full date utility rewrite. Bossbench currently switches to absolute formatting after one day; this slice preserves that behavior to avoid visual churn.

## Testing

Add focused unit tests for `formatRelativeTime` using fake timers. Tests should cover past, future, null, and invalid inputs. The first test must fail before implementation per TDD.

## Tracking

- GitHub issue: #36
- Upstream reference: `pontusab/workbench@ca690fa`
