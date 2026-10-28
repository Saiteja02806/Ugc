# Starting-frame failure retry — 27 October 2026

Status: **locally verified; not deployed; production acceptance OPEN (UGC-UI-038)**.

The creator-reference `retainedFrame` guard classified every version-2 saved image attempt as an obsolete frame, including failed attempts on references without a curated replacement. `generationDisabledReason` then blocked Generate another. Changing the model did not necessarily escape that version-2 condition. A new regression fails against the original component and passes with the corrected guard.

The guard now applies only when the reference has an actual curated replacement. A deliberate retry preserves source, photos and settings while creating a fresh request identity. Running and unconfirmed submissions retain the existing duplicate-spending protection. Provider 402 messages now explain that the attempt returned no frame and suggest changing model or retrying, without exposing internal response metadata or claiming a credit/refund outcome.

## Scope and rollback

Files changed for this request:

- `components/explore/hook-starting-frame-workspace.tsx`: narrow retained-frame condition and explanatory comment only; pre-existing photo-restoration edits preserved.
- `lib/explore/starting-frame-error.ts`: readable provider 402 diagnostic.
- `scripts/hook-starting-frame-ui.test.mjs`: creator fixtures, failed/cancelled same-model retry, changed-model retry after remount, and curated-replacement protection.
- `scripts/starting-frame-model-extension.test.mjs`: diagnostic assertions.
- `EXPLORE_CONTEXT.md`: appended local behavior/evidence receipt.
- `docs/ai-context/clear.md`: append-only UGC-UI-038 incident/evidence.
- This report.

Rollback boundary: remove only this request's guard condition/comment, 402 mapping, test additions and appended receipts. Do not revert entire files: the shared worktree contains unrelated intentional changes and unresolved merge conflicts. No dependencies, migrations, prompts, worker settings or API payload shapes changed. Temporary fixture sources, logs and screenshots live under `.tmp/starting-frame-retry-20261027/`.

## Evidence

Production read-only status: job `4d540d5d-7f3d-47b4-a647-629243c6bed1` failed with JOB_FAILED and the screenshot's raw 402 diagnostic. It belongs to `talking-emmgr4c3`, draft `4fc2eac2-ab15-447c-9ffa-bec852203960`, with a Gemini 3 Pro receipt. Screenshot selection is Seedream 5 Pro; that does not establish which model generated the failed request. Other-reference Seedream attempts later completed. The provider's underlying reason for 402 remains UNKNOWN.

The exact old failing browser storage was unavailable in the separate in-app browser. The native signed-in browser was showing another reference with successful history, so its current preparation was not reset. The reproduced code path is evidence of the blocking defect, not a reconstruction of all screenshot-time state.

Commands and outcomes:

- `python tools/preflight.py --repo . --task "Fix terminal starting-frame image failure preventing same-frame retry and image model changes"`: required-source availability checked.
- `node --experimental-transform-types --test scripts/hook-starting-frame-ui.test.mjs scripts/starting-frame-model-extension.test.mjs scripts/starting-image-status-recovery.test.mjs scripts/hook-starting-frame-variations.test.mjs`: **64 PASS**, no skips. Includes uncertain-submission, receipt, multi-variation and cross-tab guards. New creator/remount test failed before the fix (43 PASS, 1 FAIL).
- `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test lib/explore/hook-keyframe-client.test.ts lib/explore/hook-keyframe-generation-api.test.mjs`: **25 PASS**, including owned status, request replay, reservations and retained legacy v2.
- Scoped `npx eslint` on the two runtime and two test files: **PASS**, no warnings after unused test variables were corrected.
- `npx tsc --noEmit --incremental false`: **PASS**.
- Scoped `git diff --check`: **PASS**.
- Actual component and CSS browser fixture: **PASS** at 1440×900 and 390×900, before/after disabled-state assertion, close/reopen, explicit new attempt, no horizontal overflow or browser errors. Fixture auth, source delivery and image-job responses; no paid inference. Edge failed to launch in sandbox; isolated Chrome check succeeded. Not production acceptance.
- Initial strip-only test command could not parse an existing TypeScript parameter property; rerun correctly with transform-types above.

Visual evidence: `.tmp/starting-frame-retry-20261027/before-1440.png`, `after-1440.png`, `before-390.png`, `after-390.png`. Desktop before/after and mobile after manually inspected. The old obsolete-source warning disappears only on references without a replacement; existing modal, model control, source, photo chooser and result actions remain.

## Protected contracts

| Contract | Result |
|---|---|
| Same-source/model retry after failed or cancelled job | VERIFIED locally |
| Model switch and retry after reopening | VERIFIED locally |
| Source hash, identity photo IDs, fresh request key | VERIFIED locally |
| Uncertain/running job blocks replacement submissions | VERIFIED by existing focused tests |
| Real curated replacement keeps legacy-source protection | VERIFIED locally |
| Failed output cannot be approved | VERIFIED by API/client and UI tests |
| Desktop/mobile result actions remain reachable | VERIFIED in isolated browser |
| Scheduling and video-generation execution | NOT TESTED in this patch; no relevant code changed |
| Paid model success / provider 402 resolution | NOT VERIFIED |
| Authenticated deployed retry | NOT VERIFIED; not deployed |

Preflight sources actually consulted: repository AGENTS instructions, relevant EXPLORE_CONTEXT sections, incident ledger including current report, full nonnegotiables, `ugc-context-memory`, `ugc-immutable-contracts`, `ugc-ui-clarity`, `ugc-starting-frame`, `ugc-regression-gate`, and bundled Next use-client documentation. Historical context files are very large; reads of their full output were truncated, so a complete historical reread is not claimed. Supabase skill consulted for read-only production evidence. No changes to scheduling or model input contracts were necessary.

Release remains separate: the shared tree contains unresolved conflicts and a newer production deployment than the old isolated release snapshot. Neither a broad deployment nor promotion of that stale snapshot was attempted. No end-to-end claim follows from these local checks.
