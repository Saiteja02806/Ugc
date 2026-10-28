# Investing & Money: production prompt wiring and Recreate display

Status: runtime wiring VERIFIED by deployed bundle inspection; popup correction LOCALLY VERIFIED; deployment and authenticated production acceptance OPEN.

## Production finding

The production Wall page identified deployment `dpl_C1UzT3KFgb91yCiTtcrhimJA5acV`. Its loaded recreation bundle `79289-1cad8f1a57d36621.js` contains all six reviewed reference IDs and transfers approved starting-frame motion instructions into the video composer. Preparation bundle `88048.eef87066001f8f75.js` contains the six reviewed source records and Wall motion builder, compiles the animation preview, and displays image instructions, but does not render the animation prompt. Thus the six Wall prompts were deployed and wired into default recreation; the requested initial popup display was missing. This is separate from the 116 Hook candidates in UGC-VID-021.

The signed-out production browser reaches sign-in. Bundle inspection proves shipped code and wiring; it does not prove a particular user submitted a paid job or which prompt a historical provider job consumed. Those claims remain NOT VERIFIED.

## Minimal correction and changed files

- `lib/explore/hook-keyframe-prompt-preview.ts`: expose whether the current reference ID, source SHA and opening index match one of the six reviewed Wall directions.
- `components/explore/hook-starting-frame-workspace.tsx`: render that compiled animation prompt in an initially expanded Video prompt disclosure using existing styles. Preserve this file's concurrent unrelated changes.
- `lib/explore/wall-money-references.test.ts`: verify all six default/custom/explicit-empty prompts, source mismatch rejection and other workflow exclusion.
- `docs/ai-context/clear.md`: append UGC-VID-022 and verification evidence.
- `EXPLORE_CONTEXT.md`: append this display decision and production boundary.
- This receipt.

No prompt wording, source timestamps, generation submission, identity selection, model selection, pricing, worker, auth, database or scheduling implementation changed. Existing user motion instructions retain precedence. Explicitly empty instructions remain empty. The displayed preparation preview uses the existing four-second preview compiler; the video stage still compiles for the subsequently selected duration and sound setting.

## Verification

- `python tools/preflight.py --repo . --task ...`: performed during preflight.
- `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --test lib/explore/wall-money-references.test.ts scripts/hook-starting-frame-ui.test.mjs`: 57/57 PASS.
- Scoped ESLint on the three application/test files: PASS.
- `npx tsc --noEmit --incremental false`: PASS.
- Targeted `git diff --check`: PASS.
- Actual preparation component, dialog and CSS in an isolated Chrome fixture: 12/12 cases PASS (six references at 1440x900 and 390x900). Exact compiled text, initially open disclosure, collapse/expand, close/reopen, no horizontal dialog overflow, no page errors and zero POSTs verified. Auth, media delivery, face assets and final video form are fixtures; this is not production acceptance. Desktop/mobile clip-1 screenshots manually inspected.
- Fixture setup initially lacked explicit source provenance, encountered sandbox localhost denial and later served text without UTF-8 charset. Corrected harness and final run passed; no application workaround was introduced for fixture failures.

Evidence: ignored `.tmp/wall-money-production-prompt-check/` contains production readback metadata/bundles, baseline source copies, expected compiled prompts, test/type/lint logs, `prompt-browser-receipt.json` and twelve `prompt-{clip}-{width}.png` screenshots. No approved full-app golden screenshot was available. Cross-tab hosted navigation, refresh under production authentication, paid provider payloads and generated-pixel fidelity remain NOT TESTED. Source/identity separation, timestamp binding, custom instructions and generation gates are VERIFIED by focused tests; scheduling and unrelated feature runtime behavior are NOT TESTED by this scoped patch.

## Preflight and release boundary

Inspected AGENTS, nonnegotiables, relevant Explore context and ledger entries, repeatable source-review guide, callers, persistence and dirty worktree. Skills read: ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-video-prompt, ugc-opening-frame-prompt and ugc-regression-gate; installed Next client guidance inspected. Large context histories were reviewed incrementally in this continuation, not reread completely. No fresh source-video review or paid generation is claimed.

UGC-VID-022 is locally corrected, production OPEN. UGC-VID-021 records the user's requirement for notification before live deployment and deployment approval. No deployment performed. The worktree includes extensive unrelated changes and unresolved merge entries; do not deploy it wholesale for this correction. Prepare and validate a scoped release from the verified production snapshot after approval, then verify authenticated Recreate. Roll back only this task's disclosure, preview flag and test hunks; preserve concurrent work and all existing media/jobs.
