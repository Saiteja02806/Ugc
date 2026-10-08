# Explore follow-up release — 8 October 2026

This release includes every pending intentional change in the reconciled release
checkout, based on main 7076bd4bc1e2f4699dcc624ff6c1c54d0b134612. It adds the classic
slideshow Create layout, ordered image uploads, slide text/background editing and
PNG exports, owner-checked image delivery and idempotent Library saves, centered
video result empty states, compact single-platform scheduling, complete reference
rows, caption-free Wall of text cards and cached/prefetched Explore navigation.

Validation includes the successful Next.js production build (compile, TypeScript,
151 prerender steps and a static Explore route), scoped ESLint, 59 format/editor/
navigation tests and four release-routing tests. Desktop/mobile preview checks
verified the editor, PNG pixels, upload flow, centering, complete rows and return
navigation. These checks do not spend generation credits or mutate production
Library entries. Authenticated production acceptance and paid generation are not
claimed from preview or mock tests.

The original dirty checkout was already reconciled by the previous complete
release (c85b414 and 7076bd4); its historical edits remain preserved. The per-path
inventory in docs/complete-release-inventory-2026-10-08.json records that
reconciliation. This follow-up ships the release checkout's complete current
intentional diff, including source, tests and documentation.

Excluded local paths are .env files, .tools/ authentication, .tmp/ screenshots and
receipts, node_modules/, .next/ and ignored source media inputs. No intentional
pending source path is excluded. There are no new database migrations, generation
provider changes or worker changes in this follow-up, so existing production
worker revisions and database state are retained.

Deployment uses the exact pushed main commit in the existing ugcpilot/ugc Vercel
project. Production checks must inspect the live domain, commit provenance and
Explore document/RSC cache headers. The separate MCP-only deployment boundary
remains enforced; its deployment status is checked independently.
