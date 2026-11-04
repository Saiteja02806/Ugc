# Character layers overlay and action order — 3 November 2026

Implemented in the worktree. No build, dev server, fixture bundle, push, deployment or paid generation run.

The supplied stacked-layers symbol is represented by the existing Lucide `Layers` icon. A 32px overlay button at the top-right of Gold Hydrogel Patches reveals/hides Clear Hydrogel Patches and Rose Pink Patches. These two cards were inferred from the original screenshot's check marks; this interpretation was stated in commentary following the user's icon clarification. Other accessory cards remain visible. This is a scoped grouping, not a change to all accessory families.

The overlay is a sibling button, avoiding invalid nested buttons and accidental parent selection. It has an accessible label, title, expanded state, focus outline and native disabled state. Clicking it changes disclosure state only. Collapsing preserves selected variants and highlights the layers icon when one remains selected. Reopening reveals the selected card; “No accessories” still clears all selections. Existing trait IDs, reference ordering, thumbnail URLs, prompts, owner checks and generation behavior are unchanged. Unrelated cards use a `display: contents` wrapper to preserve their grid sizing. The parent alone uses a positioned wrapper for its overlay.

The existing primary Save button now appears above Download, including the Saved/Saving states. Existing labels, styling, click handler, disabled rules and download asset/user props are unchanged. No new download control was added.

## Checks

- **209/209 character tests PASS**, including actual dock rendering/handlers for initially hidden variants, reveal, selection, collapse, selected-icon indication and disabled lock. Tests verify other patch choices stay visible. Actual canvas tests assert Save before Download, unchanged save callback/owned download props, saved/saving locks, and no stale result actions during loading/empty/error states.
- Scoped lint PASS: zero errors, seven existing component warnings. `npx tsc --noEmit --incremental false` PASS; targeted `git diff --check` PASS. Logs: `.tmp/character-thumbnails/actions-{tests,types,lint}.log`.
- No CSS change to existing card, result stack or neighboring workflow styles; added overlay/wrapper rules only. Existing candidate stack remains vertical with the same gap.
- **Fresh screenshot comparison, touch/keyboard browser interaction and hosted acceptance NOT VERIFIED.** No browser bundle was built under the user’s no-build restriction. Tests invoke actual component handlers in a controlled runtime; they are not a live-browser acceptance claim.

## Files changed

- `components/characters/influencer-canvas.tsx`: reorder existing actions only.
- `components/characters/influencer-canvas.test.mjs`: three actual component action/state regressions.
- `components/characters/influencer-customizer-dock.tsx`: local disclosure state, hide two variants, accessible layers toggle and hidden-selection indicator.
- `components/characters/influencer-studio.module.css`: overlay, focus/disabled/selected rules and minimal wrapper styles.
- `components/characters/accessory-dock.test.mjs`: actual layers disclosure regression, earlier None test retained.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`, this report: append-only scope/evidence. Incident `UGC-UI-20261103-CHARACTER-ACTIONS-VARIANTS`.

Preflight: current status/callers/CSS inspected; context-memory, immutable-contracts, UI-clarity and regression-gate skills, relevant Explore/ledger entries and installed Next guidance were read in this ongoing task. Preflight script confirmed sources readable. No fresh full-history read of the large context files is claimed. User's icon attachment guides appearance; it is not treated as application instructions.

Rollback only these disclosure rules/state and the action reorder; preserve earlier thumbnails/None behavior and concurrent work. No storage, database or cloud setting rollback is needed.
