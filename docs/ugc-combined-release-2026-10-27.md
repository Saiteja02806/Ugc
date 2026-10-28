# UGC combined production release — 27 October 2026

Website and matching workers are deployed. Overall acceptance is PARTIALLY VERIFIED. Five remaining database migrations are HELD following the user's production-database safety question. No project or customer data was deleted.

## Released scope and identity

- Live: https://getugcpilot.com; www redirects to the apex. Verified deployment READY: `dpl_C1UzT3KFgb91yCiTtcrhimJA5acV`, https://ugc-f9qq8o900-ugcpilot.vercel.app. Production staging was promoted without rebuilding.
- All intentional source in the frozen working-tree snapshot, including SEO, marketing, MCP/business features, workflow/font/model changes and the entry/Recreate fixes, was included. See `docs/ugc-combined-release-inventory-2026-10-27.json` for every snapshot file/hash, added fix path and current Git status. Snapshot/current file hashes matched before promotion.
- This was a manual source deployment. HEAD `626f4b6386b6f4b796ca060b86cb4454f0680012` is NOT proof of the dirty website contents. Existing unmerged index entries were preserved; no commit or push was performed.
- Worker source matches that HEAD for runtime files. Cloud Build `4e8a824c-0a69-45ad-b659-27709cde10d0` succeeded. Image: `us-central1-docker.pkg.dev/ugcsaas/ugc-worker/ugc-worker@sha256:0aee1fa71fd887cfc08ee9eb90fb3aee66855bc06f3e5eb39afe68b566a0dd3c`.
- All six existing services have 100% traffic on their `r-626f4b63` revisions: generation, video render, reaction render, Carousel, Carousel edit and social publish. The generation release gate passed against actual startup logs, matching baked/runtime commit and pinned image. `ugc-video-render-job` and `ugc-carousel-replenishment` definitions use the same image and runtime commit; neither job was executed by this release.
- Only Vercel `ugc` was deployed. MCP/staging projects were retained. `trending-release-web-3f35202` remains configured with ignored build command `exit 0`, reconfirmed after release; it was not deleted. Actual dollar savings remain UNKNOWN.

## New fixes and files

Ordinary sign-in now targets Explore; explicit checkout and OAuth destinations remain. Recreate warms its code bundle on pointer/keyboard intent. Recent owned photos restore into untouched empty preparations, preserving explicit clears, saved requests, images and approvals. Missing starting-image receipts receive slow GET-only recovery rather than a replacement paid submission.

Implementation files: `lib/billing/purchase-intent.ts`; `components/auth/{auth-method-picker,email-auth-form,google-auth-redirect-handler,google-sign-in-button}.tsx`; `lib/explore/{recent-person-photos,hook-starting-image-polling}.ts`; `components/explore/{format-workspace,hook-starting-frame-workspace,lazy-hook-starting-frame-workspace,talking-head-references}.tsx`.

Tests changed: `lib/billing/dodo.test.ts`, `lib/explore/recent-person-photos.test.ts`, `scripts/{hook-starting-frame-ui,starting-image-status-recovery,talking-head-references}.test.mjs`. Memory: `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`. Added `vercel.json` to install locked worker dependencies and use Webpack, fixing confirmed remote Turbopack module-resolution failures. No dependencies or lockfiles were added for that fix. Receipt/inventory files were added after the frozen deployment as release evidence.

Build-cost PR guard: reviewed actual package/workflow/config changes. Expanded tests do not add a deployment command; the worker install adds build work necessary for shared renderer dependencies. Final remote build-to-ready duration was approximately160s, with cache reuse. Billable CPU minutes/dollar impact were not available. Required tests and staged QA path were retained. One earlier candidate failed at compilation; a corrected candidate and the final candidate succeeded. No redundant deployment to other projects was made.

## Database status and safety hold

Production Supabase: `kltxwijhluawgveykfbt`. Four missing MCP migrations were already applied atomically and recorded with original versions: `20261013112752`, `20261013141043`, `20261013165323`, `20261018043539`. New tables' RLS and denial of anonymous/authenticated table access were checked; commit RPC execution is not granted to browser roles. Confirm-token migration `20261024170716` was already present and was not replayed.

A complete ledger comparison later identified five additional local migrations absent in production:

1. `20261020150800_recover_completed_provider_output.sql`: owner-scoped recovery of a verified completed provider operation; recreates the billing trigger with an exception for the verified collection-only pass. Does not reset credit balances or submit a new provider task.
2. `20261021131000_default_trending_slideshows_to_structure_2.sql`: changes defaults for new rows; leaves existing choices/feeds intact.
3. `20261026105718_retry_reconnected_action_required_target.sql`: replaces the retry function so restored connections can be retried deliberately; owner checks and duplicate-publication protections remain. Applying its definition does not retry a target.
4. `20261026141500_trending_slideshow_automation.sql`: creates three account-owned service-only tables; creates no active automation or publication.
5. `20261026213000_resource_batch_notifications.sql`: creates a service-only opt-in table; sends no email.

These five are NOT APPLIED. The attempted BEGIN/DDL/ROLLBACK validation was cancelled after the connector's destructive-operation warning. A subsequent read confirmed recovery RPC and automation/notification tables still absent. The DROP is `DROP TRIGGER`, not DROP DATABASE/PROJECT/TABLE; replacement is in the same transaction. The old retry definition, billing trigger and table defaults were captured in `.tmp/ugc-release-db-before-pending-20261027.json`. No further database mutation after the user's safety question. Applying changes still carries deployment/locking and billing-logic risk and requires transaction verification; local tests do not establish production billing acceptance. Until applied, the deployed related recovery/automation/notification capabilities are not fully released; the existing action-required retry defect remains.

## Verification and limitations

- VERIFIED: production SEO readback: all50 sitemap URLs HTTP200 with title, description and canonical; none had noindex. Robots includes the production sitemap and private-route exclusions. Plugin0.2.10 download hash matches the source checksum. Evidence `.tmp/ugc-release-live-seo-20261027.json`.
- VERIFIED: real production public pages /, /mcp, /mcp/claude, /mcp/codex across five widths and both themes:40 layouts, clipboard/setup link pass, zero page errors. Used a temporary harness correcting an obsolete unique-link assertion; original fixture failure remains documented. Desktop1440/mobile390 screenshots manually inspected in `.tmp/marketing-layout-browser-live/`.
- VERIFIED locally: Webpack build/types, native packaging checks, scoped lint, MCP suite, business20/20, new entry/recovery69/69, entry/TalkingHead48/48, worker contracts122/122, renderer/font46/46, pending migration tests37/37 and action-required retry4/4. Counts overlap. Logs `.tmp/ugc-release-*20261027.log` and `.tmp/ugc-*regressions*20261027.log`.
- VERIFIED fixture: Hook/Wall/TalkingHead modal desktop/mobile, loading/dismiss/reopen, variants/approval/enlarge and no overflow. Single preview/Change contract, explicit choices, source/identity receipt separation, saved-request recovery and no automatic POST retry have test coverage.
- NOT TESTED in production: fresh authenticated email/Google sign-in, actual remembered-photo restoration in the user's browser, paid generation quality/timing, checkout, fresh render/schedule/provider publication, browser-closed execution and token refresh. The exact screenshot spinner cause is UNKNOWN.
- Existing broader failures remain: Explore1290/1293 (three stale source/catalogue expectations), scheduling UI106/109 (three stale assertions). Independent PostgreSQL onboarding concurrency tests blocked by unavailable Docker engine. They were not rewritten merely to make this release green.
- Production runtime error/fatal query for this deployment returned no matching logs in the checked15-minute window; this does not prove untested flows work. Drain/monitor configuration not audited.
- Existing starting-frame job `5ca95d8b-4a36-4339-8658-ffe9a912c8a3` completed in approximately63s with ready matching media `ae8800a1-0611-49a1-8322-310ecfcdf766`. No replacement generation, credit spend, test schedule or social publication was initiated.

## Preflight and memory

Actually consulted AGENTS, nonnegotiables, relevant Explore/clear history, source/callers/tests and preflight tool. Large historical context files were not fully reread; no full-history claim. Skills consulted during the release: ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-starting-frame, ugc-video-prompt, ugc-scheduling, ugc-regression-gate, vercel-cost-guardian, Vercel deployments-cicd/CLI and Supabase guidance. Next.js build guidance was consulted during implementation. Incidents UGC-UI-035/036 and UGC-VID-021 remain open for authenticated acceptance; code/fixture evidence is distinguished above from production acceptance.

## Exclusions and rollback

Every actual Vercel upload exclusion is enumerated in the inventory JSON. Existing ignore rules exclude agent tooling, Git metadata, Vercel local state, design studies/historical screenshots, old resource-cover variants, worker Docker ignore metadata and the separately hosted Tinder route. Secrets/local env, caches, build products, local tools and temporary outputs were not part of the source snapshot. Encrypted private source packages were included; plaintext private assets remained excluded. These exclusions do not represent omitted requested SEO/runtime fixes.

Website rollback: previously live deployment `dpl_7RCmDsbfGBjZsX8E3M78p15keGgE` / `ugc-jb8aa9mx5-ugcpilot.vercel.app`. Worker rollback: each service's prior `r-45bf657b` revision, image digest `sha256:dee0eed824f9287f9939dee1564596a1ca97340ebc981b9a7ff174cfced784ea`; prior job images backed up under `.tmp/ugc-job-before-*`. Retain additive MCP schema on application rollback; do not drop customer data. Five held migrations have no production rollback needed because they were not applied.
