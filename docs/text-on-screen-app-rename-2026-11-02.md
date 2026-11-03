# Text on screen — remaining-screen naming pass

2 November 2026. Local changes only; no deployment.

## Scope implemented
Renamed visible Wall of text / Wall-of-Text variants to **Text on screen** in Creative Assets, Trending and its editors/pickers/walkthrough/content mix, Viral, business Settings, scheduling, the AI Studio automatic overlay label, pricing, public landing/demonstration/blog/guide pages and their metadata. Updated public API/render error copy and public MCP reference descriptions. Lowercase prose uses text on screen. Existing URLs, slugs and tool input identifiers stay intact.

Minimal scope: display copy and matching test expectations only. No styles, palette, layout classes, dependencies, migrations, billing, generation prompts, queue logic or videos changed. No user-owned or historical records rewritten. Existing dirty worktree preserved.

## Protected contracts / evidence
- VERIFIED by pre-task snapshot comparison: all 50 source/data edits are only approved naming changes, including two abbreviated labels (Wall video and automatic Wall text). Quoted route/endpoint strings preserved. JSON parses. Evidence `.tmp/text-on-screen-app/copy-audit.txt` and changes.json.
- VERIFIED by source comparison: format/type keys, API payloads, conditional logic, retry policies, scheduling time/persistence logic, CSS classes and media references unchanged.
- VERIFIED locally: Trending development fixture before/after at1440x1000 and390x844, and actual public guide at its original /guides/wall-of-text-video-for-saas URL. New visible wording, old visible wording absent, no horizontal page overflow. Screenshots manually inspected. Guide mobile wraps naturally; no style change.
- NOT VERIFIED: visual acceptance of authenticated Creative Assets, Settings, scheduling and Viral. Anonymous local Viral route redirected to sign-in. Those source labels and existing relevant tests were checked; a redirect is not evidence of the screen itself.
- NOT TESTED: authenticated production, paid generation, real scheduling/publication. Copy-only patch does not establish integration health. Nothing deployed.
- Existing development Trending fixture mobile header overlap is present in both before/after screenshots; not introduced by this copy change. Do not treat this fixture as approved responsive design.

## Preflight sources actually used
User-provided/root AGENTS instructions; installed Next.js layouts/pages guide; mandatory context-memory, immutable-contracts, UI-clarity, scheduling and regression-gate SKILL.md files; nonnegotiables.md; scheduling-contract.md; relevant Explore/Carousel context and clear.md incident entries (UGC-UI-119). The large historical ledgers were inspected by relevant sections rather than claiming a fresh full reread. `python tools/preflight.py --repo . --task "Rename visible Wall of text labels to Text on screen across other application screens; preserve videos, routes, data, layout and palette; no deploy"` PASS. Existing status and diffs inspected.

## Commands/checks and outcomes
- `npx tsc --noEmit`: PASS, including final run.
- Scoped ESLint over changed files:0errors,3existing source warnings (unused ArticleExternalLink; two Viral img warnings). Two JSON files ignored by ESLint, explicitly parsed separately. Supplemental lint of final MCP/video/scheduling files PASS.
- Node tests used `--import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test`.
- Saved-assets UI contract, business-context form, generation failure classification, content mix/editor/reaction contract, schedule-editor inline, landing-gallery motion and Viral isolation:77PASS/1FAIL.
- render-finalization-policy, wall-text-render-transport, wall-text-publication-delivery, slideshow-automation-ui-contract:15PASS.
- mcp-reference-catalogue and mcp-tool-catalog:8PASS.
- mcp-reference-tools with required `--experimental-test-module-mocks`:13PASS. Initial invocation without that flag failed to start; corrected rather than modifying the test.
- Total final focused assertions:113PASS/1pre-existingFAIL. The Viral requires-an-image assertion expects `allowedKinds={["image"]}`, absent before and after this task. Baseline evidence `.tmp/text-on-screen-app/viral-baseline.txt`. Its assertion remains intact; this unrelated failure was not fixed or concealed.
- `git diff --check` for changed application areas:PASS, line-ending notices only.

## Visual artifacts
`.tmp/text-on-screen-app/trending-before-desktop.png`, `trending-before-mobile.png`, `trending-after-desktop.png`, `trending-after-mobile.png`, `guide-desktop.png`, `guide-mobile.png`. Inspected current guide and Trending before/after. Files named viral-desktop/mobile.png capture the sign-in redirect and are NOT Viral-screen verification. A local fixture video reported ERR_CACHE_OPERATION_NOT_SUPPORTED once; media playback is not verified by this copy task.

## Incidents, limits and rollback
UGC-UI-119 continuation appended before changes and verification appended afterward. No new application defect was silently fixed. Remaining old-name source matches are routes/slugs, internal prompts/diagnostics, comments, source media metadata/content, or developer cover review content. Runtime user-authored or historical content is intentionally not rewritten. Roll back only the display substitutions, corresponding test expectations and new context entries; preserve other working edits. Production acceptance remains outstanding under the no-deploy instruction.

## Every file changed in this task
- components/avatars/saved-creative-assets-tab.tsx
- components/marketing/founder-guide-page.tsx
- components/marketing/landing-format-shelf.tsx
- components/marketing/landing-formats-bento.tsx
- components/marketing/landing-hero-gallery.tsx
- components/marketing/try-ugcpilot-demo.tsx
- components/pricing/pricing-page.tsx
- components/scheduling/schedule-editor.tsx
- components/scheduling/scheduling-workspace.tsx
- components/settings/business-context-settings.tsx
- components/trending/creative-assets-video-picker.tsx
- components/trending/hook-video-schedule-drawer.tsx
- components/trending/trending-content-mix-dialog.tsx
- components/trending/trending-creative-editor.tsx
- components/trending/trending-first-visit-walkthrough.tsx
- components/trending/trending-workspace.tsx
- components/trending/wall-text-detail-view.tsx
- components/trending/wall-text-edit-overlay.tsx
- components/viral/viral-workspace.tsx
- app/try-ugcpilot/page.tsx
- app/viral/page.tsx
- app/e2e/explore-format-preview/page.tsx
- app/e2e/trending-feed-preview/preview.tsx
- app/e2e/trending-walkthrough-preview/page.tsx
- app/blog/ai-ugc-video-generator-how-it-works/page.tsx
- app/blog/ai-video-generator-for-saas/page.tsx
- app/blog/build-in-public-without-showing-face/page.tsx
- app/blog/short-form-video-marketing-saas/page.tsx
- app/blog/ugc-ads-with-claude-mcp/page.tsx
- app/blog/ugc-pilot-vs-hiring-ugc-creators/page.tsx
- lib/business-profiles/business-context-form.ts
- lib/marketing/practical-guides.ts
- lib/marketing/founder-workflow-guides.json
- lib/marketing/mcp-public.ts
- lib/marketing/mcp-tool-catalog.json
- lib/trending/feed-items.ts
- lib/trending/unified-daily-feed.ts
- lib/trending/wall-text-generation-failure.ts
- lib/trending/wall-text-render-request.ts
- lib/scheduling/service.ts
- lib/scheduling/render-finalization-policy.ts
- lib/scheduling/wall-text-render-start.ts
- app/api/trending/video-source-selection/route.ts
- app/api/trending/wall-text/drafts/route.ts
- app/api/trending/wall-text/schedules/route.ts
- app/api/trending/wall-text/feed/actions/route.ts
- app/api/trending/wall-text/feed/prepare/route.ts
- app/api/schedules/[scheduleId]/wall-text-render/route.ts
- components/video/video-generation-workspace.tsx
- lib/mcp/reference-tools.ts
- lib/media/saved-creative-assets-ui-contract.test.ts
- lib/viral/viral-isolation-contract.test.ts
- lib/trending/wall-text-generation-failure.test.ts
- EXPLORE_CONTEXT.md
- docs/ai-context/nonnegotiables.md
- docs/ai-context/clear.md
- docs/text-on-screen-app-rename-2026-11-02.md
