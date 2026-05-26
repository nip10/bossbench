# AI discoverability design

## Goal

Make Bossbench easier for AI search systems and developer agents to understand, cite, and summarize accurately.

## Scope

This slice adds marketing-site AI discoverability foundations for issue #40: `llms.txt`, robots policy, sitemap, richer metadata, and JSON-LD. It does not add blog infrastructure or MCP-specific docs.

## Design

- `apps/web/public/llms.txt` provides a concise, extractable product profile for AI systems.
- `robots.ts` explicitly allows common AI search/citation bots while blocking Common Crawl's training-only bot.
- `sitemap.ts` exposes the homepage for crawlers.
- `layout.tsx` gets `metadataBase`, richer Open Graph/Twitter metadata, and JSON-LD with `Organization`, `WebSite`, `SoftwareApplication`, and `FAQPage` nodes.

The content positions Bossbench as a pg-boss/Postgres-native dashboard, not a BullMQ dashboard. Safety language emphasizes read-only browsing and mutations through pg-boss public APIs.

## Tracking

- GitHub issue: #40
- Upstream references: `pontusab/workbench@0aefcf6`, `pontusab/workbench@237beaf`
