# Talking Head Sound placement — 29 October 2026

Implemented locally; no deployment or generation. UGC-UI-064.

The Talking Head starting-frame path uses WorkflowCreationForm, distinct from the public Hook VideoGenerationStudioPanel. Its existing startingFrameSoundControl was a sixth child of the Video settings grid. Moved it to the reserved footer inside Your instructions and replaced the caller's checkbox with the existing Hook-style Sound on/off switch and volume icon. Exactly one control remains.

The handler still updates startingFrame.generateAudio via frameSelection.setFrame. Existing workflow-generation-client request/fingerprint reads that value. No default, source frame, photos, prompt, model/duration, provider, payload/schema or stored receipt changed. No sound capability was added to other generation paths. Busy-state disabling remains. Phone and forms without this prop retain their settings and prompt behavior.

## Changed files

- components/explore/workflow-creation-form.tsx: instruction-area placement and reserved space; remove settings-grid duplicate.
- components/explore/hook-workflow-preview.tsx: accessible switch/icons, same starting-frame setting.
- scripts/workflow-creation-form.test.mjs: actual form render verifies location, one control, toggle/disabled behavior and absence without prop.
- scripts/hook-workflow-preview.test.mjs: adjust old literal class assertion for conditional prompt-footer spacing.
- scripts/talking-head-references.browser.cjs: --sound-only mode renders the production caller's exact switch markup inside the real form. Desktop/mobile geometry and keyboard/click assertions; no real submission.
- EXPLORE_CONTEXT.md; docs/ai-context/clear.md; this receipt.

## Preflight and scope

Read context-memory, immutable-contracts, UI-clarity and regression-gate skills in full; protected nonnegotiables, supplied AGENTS, relevant Explore sound/UI history and existing incident evidence under the previously authorized relevant-sections approach. Installed Next use-client guide read. Repository preflight PASS. Existing worktree changes preserved. Boundary is two presentation components and their tests; rollback needs no backend changes.

## Verification

- 101/101 tests PASS: creation form, Hook/Phone workflow, generation API contract, starting-frame references, section/studio UI and recovery. .tmp/talking-sound-tests.log.
- TypeScript --noEmit PASS; scoped ESLint PASS; diff check PASS with line-ending notices only.
- `node scripts/talking-head-references.browser.cjs --sound-only` PASS at1366/1536/390px: one switch inside the instruction box, none in Video settings, keyboard Space/click toggling, no horizontal overflow, switch within prompt bounds. Actual form/CSS and production switch markup; fixture frame setter/auth/media, no generation. .tmp/talking-sound-browser.log.
- Visually inspected sound-instructions-1366.png and sound-instructions-390.png under .tmp/talking-reference-browser/. User screenshot is the reported before state, not a production golden baseline.
- Initial unscoped browser attempts stalled while playing gallery footage after scrolling to the prompt. They were stopped; Sound-only acceptance does not claim the unrelated full-gallery suite passed. Its original playback path is preserved outside the scoped mode.

VERIFIED locally: control placement, one-control behavior, accessible toggle, preserved bound flag, disabled state, form regressions and responsive geometry. NOT VERIFIED: authenticated live UI, actual generated soundtrack and full hosted acceptance. No deployment, media/provider charges, database changes or MCP build.
