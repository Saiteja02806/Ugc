# Talking Head Create heading cleanup

Scope: hide the redundant Talking head video heading only in Create; preserve accessible source labeling, modes, upload/reuse controls and other workflows. Local development server running at http://127.0.0.1:3000; preview at /explore/create-hook?preview=1.

Files changed: components/explore/workflow-video-source-section.tsx (optional hideHeading), components/explore/hook-workflow-preview.tsx (opt-in), scripts/workflow-source-video-ui.test.mjs, scripts/talking-head-workspace.browser.cjs, EXPLORE_CONTEXT.md, append-only docs/ai-context/clear.md and this receipt. Existing concurrent changes preserved.

Preflight: AGENTS instructions, Explore context/history and latest updates, clear/nonnegotiables, context-memory/immutable-contracts/UI-clarity/regression-gate skills, installed Next page guide and current callers/tests inspected.

VERIFIED locally: six source-control tests, full workflow desktop/mobile browser checks including320px, TypeScript, scoped lint and diff checks. Fresh screenshots in .tmp/talking-head-full-workspace. No backend, generation, scheduling or persistence logic changes. Incident UGC-UI-014 locally verified; no production rollout. Local authenticated save/generation/provider checks NOT TESTED. Rollback only hideHeading prop/caller/test additions, preserving earlier feature work.

Actual Next dev page also loaded successfully after initial compilation at http://127.0.0.1:3000/explore/create-hook?preview=1. DOM inspection confirms sr-only heading and intact Generate/Upload/Creative Assets controls. Preview is intentionally not connected to saving/generation/publication. An additional component-only fixture is running at http://127.0.0.1:65374 with local reference/gallery/media interactions.
