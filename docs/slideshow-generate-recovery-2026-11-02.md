# Slideshow Generate and Face Swap recovery

Implemented: full-width44px white Generate with existing workflow action style; singular slide label. Client affordability now checks base generation plus one charge per distinct marked face slide, independent of versions. Ordinary base generation cost line retained; warning guides adding credits or clearing marks. Recover saved request behavior retained. Saved-face and uploaded-portrait errors have independent Retry actions without clearing chosen face.

Changed files:
- components/generation/ai-studio-composer.tsx
- components/workspace/ugc-chat-workspace.tsx
- components/explore/slideshow-face-choice.tsx
- lib/explore/slideshow-face-swap.ts
- scripts/slideshow-face-swap-ui.test.mjs
- scripts/slideshow-face-choice.browser.mjs
- EXPLORE_CONTEXT.md
- docs/ai-context/clear.md
- this receipt

Preflight: current dirty tree/callers inspected; context-memory, immutable-contracts, UI-clarity and regression-gate skills read; protected nonnegotiables, relevant Explore/clear history and Carousel context sections, installed Next CSS guide reviewed. Large historical context files not fully reread this turn. Existing unrelated user work preserved. Minimal rollback boundary: Generate compact override, combined precheck/helper, picker error UI/tests. No dependencies, API shapes, billing reservations or worker changes.

Protected behavior: normal source slide selection/generation, once-per-selected-slide swap, Version1-only, + attachments, sparkle, selection-only Generate hiding, existing pending-request recovery guards VERIFIED unchanged by source/tests. Source/identity prompt wiring, schedules and account writes unchanged by diff, not exercised.

Checks:
- TypeScript noEmit PASS; scoped ESLint zero errors (two pre-existing unused warnings in ugc-chat-workspace).
- node --test scripts/slideshow-face-swap-ui.test.mjs scripts/source-utf8.test.mjs:6 PASS, including duplicate selected marks, versions, no face/no marks, rate2, base quote separation and combined guard wiring.
- node scripts/slideshow-face-choice.browser.mjs:PASS actual component, isolated library failure/retry responses, selection retained, no uploads/provider calls. Mobile failure and recovery screenshots .tmp/slideshow-fixes/library-error.png and library-recovered.png inspected.
- .tmp/slideshow-button-review.cjs:PASS actual local Explore slideshow. Desktop Generate336px/parent336px; mobile316px/parent316px; height44px; rgb245,243,240; hidden in Face Swap and restored on outside-close. Screenshots slideshow-1440.png and slideshow-390.png under .tmp/slideshow-fixes inspected. One initial harness click targeted a textarea point covered by the face popover; changed to unobstructed header click without application change.
- Scoped git diff check PASS.

Limits: precheck uses current known balance and does not atomically reserve future swap credits. Concurrent spending/balance changes and actual billed provider execution require hosted acceptance. Face-library network boundaries are isolated in the regression. No paid generation, deployment or account mutation performed. Local UI/logic VERIFIED; production end-to-end NOT VERIFIED. Incidents UGC-UI-104/105 have local evidence, hosted acceptance pending.
