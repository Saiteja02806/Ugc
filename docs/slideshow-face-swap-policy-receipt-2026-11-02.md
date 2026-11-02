# Slideshow Face Swap policy correction

Changed components/explore/format-workspace.tsx, components/explore/slideshow-reference-picker.tsx, components/workspace/ugc-chat-workspace.tsx, lib/explore/slideshow-face-swap.ts and scripts/slideshow-face-swap-ui.test.mjs; updated EXPLORE_CONTEXT.md and docs/ai-context/clear.md.

Face marks are restricted to existing generation-selected sources. Opening/marking does not expand contextSlides. Quote counts unique selected slides only when a face exists. User confirmed Version 1 only: planner skips later versions and deduplicates slide IDs.

Four focused regression tests PASS. TypeScript PASS; scoped lint zero errors/two pre-existing warnings. Local browser PASS for eligibility, toggle, outside-close, reopen and Clear. Desktop Generation/Face Swap and mobile screenshots are under .tmp/explore-review. Some fixture thumbnails unavailable. Live image generation and credit debits NOT VERIFIED; no deployment. UGC-UI-082 remains open for hosted acceptance.

Procedures: existing context-memory, immutable-contracts, UI-clarity and regression-gate instructions; relevant Explore decisions/nonnegotiables and incident history previously read. Full historical documents were not re-read this continuation. Existing user work preserved.
