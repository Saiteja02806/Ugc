# Remaining 14 founder guides — implementation receipt

Date: 27 October 2026 (IST). Status: locally implemented and partially verified for release; not deployed.

## Scope and rollback boundary

Added 14 distinct static editorial guides, an additive server-rendered article component and content dataset; integrated guide-hub discovery/CollectionPage items and the existing sitemap source. Local inventory is now 50 unique entries. No dependencies, migrations, app API, generation, scheduling, authentication, analytics/privacy settings, global styles or production deployment changes. Rollback only these 14 routes, their new component/data, their hub/inventory additions and this continuation's documentation. Preserve earlier two guides and all unrelated worktree changes.

## Files changed in this continuation

- lib/marketing/founder-workflow-guides.json
- components/marketing/founder-workflow-guide.tsx
- app/guides/page.tsx
- lib/marketing/public-page-paths.json
- docs/seo-first-50-plan-2026-10-27.md
- docs/seo-first-50-inventory-2026-10-27.json
- docs/seo-organic-visibility-plan-2026-10-22.md
- docs/seo-remaining-14-receipt-2026-10-27.md
- app/guides/app-demo-storyboard/page.tsx
- app/guides/vertical-saas-demo/page.tsx
- app/guides/app-launch-video-checklist/page.tsx
- app/guides/saas-feature-announcement-video/page.tsx
- app/guides/app-store-preview-vs-social-video/page.tsx
- app/guides/screen-recording-demo-privacy-checklist/page.tsx
- app/guides/silent-app-demo-video/page.tsx
- app/guides/saas-video-cta-examples/page.tsx
- app/guides/product-demo-vs-explainer-video/page.tsx
- app/guides/customer-question-to-demo-video/page.tsx
- app/guides/saas-tutorial-carousel/page.tsx
- app/guides/mobile-app-onboarding-video/page.tsx
- app/guides/product-demo-hook-testing/page.tsx
- app/guides/review-ai-ugc-for-software/page.tsx

## Preflight and procedures

Applied ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-regression-gate and the React best-practices checklist. Read mandatory skills, nonnegotiables, existing article components, hub, inventory, sitemap, the relevant existing topic coverage and installed Next.js page/metadata documentation. AGENTS, Explore context and clear ledger were consulted in the continuing task; fresh follow-up reads covered current tails rather than claiming another complete read of their large bodies. Ran python tools/preflight.py --repo . --task "Add remaining 14 distinct founder SEO guides and verify 50 local public paths": prerequisites PASS. Existing broad worktree changes retained. No new defect incident opened: this is authorized editorial expansion. No historical incident marked fixed.

Scope contract: unique useful founder tasks, original examples clearly labeled fictional/illustrative, exact metadata, public discovery and existing article styling. No invented customer/performance proof. No claim that qualitative topic research establishes keyword volume or that text uniqueness proves absence of cannibalization.

## Verification and evidence

- VERIFIED: app TypeScript, `node_modules/.bin/tsc.cmd --noEmit --incremental false`, exit 0.
- VERIFIED: scoped ESLint for new component, 14 routes and guide hub, exit 0.
- VERIFIED: 50 distinct inventory entries resolve to page source or the existing /mcp -> /mcp-server browser rewrite in proxy.ts. Initial test assumed every entry had page.tsx; inspected the existing rewrite and corrected that test assumption. No routing change needed.
- VERIFIED: all new related paths are in the public inventory; titles, descriptions, intent notes and worksheets unique; no duplicate new article paragraphs; no full new body paragraph reused from 23 checked existing guide/blog/content sources. Highest shared five-word fraction between new page bodies is 0.0073. This is a duplication diagnostic, not an SEO quality score.
- VERIFIED: 42 actual browser route/viewport checks at 1440, 390 and 320px: HTTP 200, one exact H1, title/canonical, visible complete article copy, worksheet, TechArticle schema, semantic table headings, keyboard table scrolling, no document overflow and no page errors. Hub contains all 14 new links with matching CollectionPage entries; actual link navigation and reload pass.
- VERIFIED by saved pre-change SHA256 comparison: lib/marketing/practical-guides.ts, components/marketing/video-marketing-page.tsx, components/marketing/seo-article.tsx and app/globals.css unchanged in this continuation.
- VERIFIED source review: renderer stays a Server Component, no new effects or network calls, existing article/link primitives reused, stable semantic rows/sections and focusable overflow region. Existing header is reused.
- Visual artifacts: full-page desktop/mobile screenshots for every new route and hub saved under C:/Users/chund/.codex/visualizations/2026/10/08/01a119ef-dcd1-75a3-bd68-8e8d7299c4d5/seo-first-50/. Representative desktop/mobile screenshots manually inspected. Initial capture followed table focus, placing the fixed header midway in full-page captures; reset scroll/focus before screenshot capture. This was a capture artifact, not an application defect.
- Raw evidence: remaining14-browser-results.json, remaining14-source-checks.json, remaining14-baseline.json and verify-remaining14.mjs in that artifact folder. Local preview uses actual repo pages plus a signed-out auth fixture and the same metadataBase as the app. Initial canonical test exposed missing metadataBase in the fixture; fixed only preview layout, then canonical checks passed.
- `git diff --check` for changed tracked scope PASS, with Git's normal LF/CRLF notice on the existing organic-plan file.

## Evidence boundaries and remaining gates

NOT TESTED / NOT VERIFIED: full production build, live new URLs/sitemap, live authentication and backend integrations, broad app regression suites, Google index coverage/rankings, fresh GSC or paid keyword data, production traffic/signups and owner-provided real launch/generated-footage acceptance. None is implied by local tests. No paid generation or outreach occurred. No new prompt/model/schedule/backend evidence is relevant to editorial-only changes.

These new examples are original planning tools. Six diagrams are text schematics, not screenshots. The launch exercise is not an owner-tested launch. AI review scenarios are not observed provider failures. Actual owner-approved examples can strengthen these pages later. Existing unpublished small-teams article still needs unsupported-claim review; Free Tools hosted bundle/notification acceptance remains separate. Those are not made release-ready by counting them in the existing local inventory.

## Next step

Review the local /guides hub and release only approved work through the normal release process. After deployment, check each new hosted URL, canonical/noindex, visible content, sitemap and inbound path. Record the actual release date; review index coverage after recrawl and query relevance over comparable finalized windows. Do not repeatedly request indexing or equate 50 source entries with 50 indexed pages.
