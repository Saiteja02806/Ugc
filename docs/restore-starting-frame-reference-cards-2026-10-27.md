# Restore starting-frame reference cards

27 October 2026. UGC-UI-040: **locally verified, not deployed**.

The user rejected the unsolicited starting-frame panel, added helper prose, hidden input cards and irregular Ratio display. `WorkflowCreationForm` hid the original reference section whenever starting-frame mode was active; `HookWorkflowPreview` supplied the verbose replacement. This was a UI regression, not a request to redesign the established workflow.

## Implemented boundary

Keep Choose image, Video reference and Select audio in their original three-column grid. An approved starting frame occupies the image card. Its existing-style + overlay has the accessible name Change starting frame and opens the frame/photo controls; Remove returns to the ordinary Choose image card. The duplicate permanent face chooser and promotional model hint are absent. Remove the speech/audio explanatory paragraph. Keep Sound in Video settings. Ratio uses the existing selector component, with only the selected frame's ratio offered; remove From your frame. Model/input validation remains intact, including incompatible timed references. Restoring cards does not silently enable unsupported provider inputs.

No backend, prompt, model limits, dependencies, migrations, schedule execution or generation payload changes. Prior retry/loading fixes and unrelated worktree changes preserved. Rollback only this task's scoped hunks; whole-file rollback would discard earlier work.

Files changed:

- `components/explore/workflow-creation-form.tsx`: retain cards, insert frame in image slot, normal ratio selector, optional Sound settings slot.
- `components/explore/hook-workflow-preview.tsx`: compact frame control, callbacks retained, Sound state moved to settings, remove verbose replacement panel.
- `components/explore/starting-frame-animation-references.tsx`: compact image tile with picker, remove persistent hint. Existing noncompact callers retain their selectors.
- `scripts/workflow-creation-form.test.mjs`: update obsolete hidden-card contract to explicit requested three-card/ratio contract.
- `scripts/starting-frame-animation-references.test.mjs`: compact picker/control/no-hint assertions and required fixture imports.
- `scripts/workflow-demo-audio-state.test.mjs`: Sound test follows its settings slot; same scope, script, Demo and audio-preservation assertions retained.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`: append user correction and verification evidence.
- This report.

## Verification

`node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test scripts/workflow-creation-form.test.mjs scripts/starting-frame-animation-references.test.mjs scripts/hook-workflow-preview.test.mjs scripts/workflow-demo-audio-state.test.mjs scripts/hook-starting-frame-ui.test.mjs scripts/workflow-generation-client.test.mjs`: **153 PASS**, no skips. Includes generation model/input gates, source/draft ownership, retained Demo/script, Sound, uncertain request protection, retry, latest photo selection and pending feedback. An initial invocation without the repository loader failed on extensionless imports; corrected invocation above passes. Old tests expecting hidden cards and Sound inside the removed panel were updated to the user's new contract.

Scoped ESLint and `git diff --check`: PASS. `npx tsc --noEmit --incremental false`: PASS. Preflight availability check PASS; full shared release/build not attempted with unrelated merge conflicts present.

Isolated actual form/reference components, CSS and base UI browser fixture at1440×1000 and390×1000: three cards, starting image in first card, hidden-until-Change photo controls, picker dismissal, normal Ratio single supported option, frame removal restoring empty image chooser, unchanged instruction text and no horizontal overflow all PASS. Auth/media delivery are fixtures; no paid generation or production writes. Fixture screenshots: `.tmp/restore-reference-cards/after-1440.png`, `after-390.png`, `picker-1440.png`, `picker-390.png`; final browser receipt and logs alongside them. Desktop/mobile and popup screenshots visually inspected. Initial Change text clipped inside the existing circular action; replaced by the existing-style + icon with accessible Change label, then reran. Final fixture selectors account for hydrated Ratio accessible labels and dismissal animation.

User screenshots are evidence of the rejected UI and intended original card design. No approved golden screenshot is claimed. Restored UI is pending user acceptance.

| Protected behavior | Status |
|---|---|
| Three existing cards, single starting-frame preview, Change/Remove | VERIFIED locally |
| No permanent duplicate chooser or unsolicited model/helper paragraph | VERIFIED locally |
| Normal Ratio appearance, frame ratio preserved | VERIFIED locally |
| Source/identity roles, current photos, retry and loading | VERIFIED by existing regression tests |
| Model incompatibility and timed-reference generation guards | VERIFIED by generation client tests |
| Demo/script/Sound state preserved | VERIFIED by regression tests |
| Scheduling/publication and full navigation | NOT TESTED in production; no execution changes |
| Authenticated hosted acceptance and paid output quality | NOT VERIFIED |

Preflight sources consulted: AGENTS instructions, relevant Explore context and ledger including UGC-UI-001/013/038/039, protected nonnegotiables, context-memory, immutable-contracts, UI-clarity and regression-gate skills, current Hook versus Talking Head callers, and bundled Next use-client guide. Full historical context reads have previously truncated output; a complete historical reread is not claimed. No frame/prompt selection changes required new source-video analysis.

The shared tree contains unrelated changes and unresolved merge conflicts. No commit, broad deployment, stale-snapshot promotion or production reset occurred. This report separates local behavior from hosted acceptance.
