# Trending history text and backward scrolling — 2026-10-10

The owner reported missing Wall-of-Text previews when returning to a post, plus occasional inability to reach all four earlier cards in a 20-post feed. Fixes are implemented locally; deployment and authenticated production acceptance remain pending.

## Missing text after a skip

The shared-PNG overlay GET used `loadTrendingCreativeEditor`. Its assignment access and draft lookup allowed only `active` and `selected`. The normal durable skip changes a Wall assignment to `completed_skipped`. History preserves the card locally, but moving it from the inactive previous slot into the active slot remounts its text preview. The new overlay request then returned 404, which the browser displays as “Text could not load.” This is a deterministic access failure after a persisted skip, not evidence that the saved text was deleted.

Overlay GET now uses a separate read-only preview loader that accepts owned active, selected and completed-skipped assignments. The lookup verifies assignment ID, creative ID and authenticated owner. It hydrates the original saved content, applies any stored owner edit, and retains the exact revision check and PNG hash delivery contract. Overlay POST for unsaved editor drafts and edit/save endpoints retain stricter editing access. Reading the earlier card does not select it or change its decision.

Six tests execute the actual route and assignment query functions with controlled storage/auth boundaries. They cover all three readable states, owner/creative mismatch, unavailable states, authentication, revision conflicts, private response headers and continued denial of editor-draft access to skipped cards.

## Backward-scroll event race

The feed re-centers its small snap window after every history transition. A delayed native `scrollend` from that re-centering can arrive after the next wheel input arms a gesture but before its movement. The old settlement code saw the viewport at rest and cleared the user-gesture flag. Subsequent movement could consequently be treated as programmatic and returned to the current card.

The native event no longer expires an armed gesture at rest; the existing 160ms idle fallback does that only after input settles. New regression tests reproduce the adverse event order for backward and forward navigation, and verify that a wheel that never moves still expires before later programmatic scrolling. Held touch, active drag, animation, disabled/modal and duplicate-commit guards remain intact.

This reproduces one concrete cause of intermittent blocked browsing. The exact production gesture from the report was not captured or reproduced in an authenticated session.

## Validation

- 69 Trending interaction/layout/scheduling hand-off tests pass, including the three new event-order regressions.
- Six read-only preview route/query tests pass.
- 37 revisit-scheduling and reconsideration regression tests pass.
- Web TypeScript and scoped lint pass; no migration is required.
- The development preview now contains 20 posts. Native wheel navigation at 1366 × 680 follows posts 1 → 2 → 3 → 4 → 5, then 5 → 4 → 3 → 2 → 1. Repeating the history cycle leaves the reviewed count at four, without replaying skips. The same forward/back sequence passes at 1536 × 776.
- Browser checks use the real Trending deck/history/feed components with local DOM-rendered text and media. Shared-PNG access is checked separately through route/query tests with mocked external boundaries; these are not authenticated production acceptance.

Local screenshot evidence:

- `.tmp/trending-revisit-20261010/wall-back-14.png`
- `.tmp/trending-revisit-20261010/wall-back-15.png`

No production database content, review decision, deployment or infrastructure was changed during this repair. Final acceptance after deployment must use `https://www.getugcpilot.com` with a signed-in session.
