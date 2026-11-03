# AI Studio prompt clearance and Explore shortcuts

Implemented the latest clipped-text correction and completed the preceding interrupted Explore header request. No deployment.

Files changed this scope:
- components/generation/ai-studio-composer.tsx: empty-reference column auto-sizes instead of44px, allowing actual64px tile plus padding.
- scripts/ai-studio-prompt-layout.browser.mjs: actual composer/reference tile layout regression.
- components/explore/explore-workspace.tsx and explore-workspace.module.css: nine requested direct header links; responsive contained navigation.
- scripts/explore-navigation-ui.test.mjs: scope existing quick-start-card assertions to cards, validate new9header route mappings including preview handling.
- EXPLORE_CONTEXT.md, docs/ai-context/clear.md and this receipt.

Preflight: current dirty state/callers, mandatory context-memory/immutable-contracts/UI-clarity/regression-gate procedures, relevant Explore/clear/nonnegotiable contracts and installed Next CSS guide applied. Full large historical context files not reread this turn; previous full-output attempts truncated. Preserve existing user changes; no dependencies, configuration, route, API, prompt model or backend changes. Root cause/source evidence and OPEN UGC-UI-109/110 recorded before edits. Rollback bounded to auto column and new header markup/styles.

VERIFIED: actual AiStudioComposer + ReferenceFilesUpload at1440/390 has12px gap between tile right and textarea left; empty placeholder and typed multiline prompt readable, attached-state textarea lies below tile, no page overflow. Upload service isolated; no file upload/provider call. Screenshots .tmp/ai-studio-prompt/prompt-1440.png and prompt-390.png inspected. Settings text in isolated preview is fixture content, not complete signed-in AI Studio acceptance.

VERIFIED: actual /explore9links match existing destinations; last link can focus/scroll into viewport; no horizontal page overflow at1440/390. Screenshots .tmp/explore-shortcuts/explore-1440.png and explore-390.png inspected. Sidebar, cards, Upgrade/Sign up routes, generation settings and handlers unchanged by scoped diff. The screenshot retains keyboard focus outline as intended.

Tests:30composer/sizing/UTF8 PASS;25navigation/workflow/UTF8 PASS (overlap in UTF8 count); TypeScript noEmit PASS; scoped ESLint PASS; scoped diff check PASS. Initial old quick-start test counted all13links; adjusted to its4card scope and added9nav mapping assertions. Actual navigation beyond link destination inspection uses existing access policies; no sign-in/provider/paid generation exercised. Hosted acceptance NOT VERIFIED. No deploy.
