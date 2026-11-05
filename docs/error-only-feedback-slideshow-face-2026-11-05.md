# Error-only workflow feedback and Slideshow face selection — 5 November 2026

Status: IMPLEMENTED LOCALLY; local contract checks pass as recorded below. No build, commit, push, deployment, production settings change or paid model/media generation. Corrected hosted behavior and actual generated face/copy quality remain OPEN. Concurrent edits were preserved.

## Confirmed problems and corrections

The shared floating component previously rendered any nonempty message/actions. Slideshow passed ordinary credit estimates and Cancel, so normal generation produced an issue-like card. Shared feedback now requires an actual `role="alert"` descendant. Callers pass genuine errors explicitly; idle guidance, ordinary costs, progress and success remain accessible without a floating card. Genuine errors retain the existing location, full content, X and recovery. Missing references, failed access and insufficient credits remain validation failures; no disabled/billing/pending protection is relaxed.

Existing workflow Cancel, Retry and read-only Check earlier requests controls now render in the existing results toolbar rather than being reachable only through an issue card. Normal result/progress cards, generation spinners, primary actions, non-workflow Studio controls and event handlers remain. No new status/reopen pill, global styling or dependency was added.

The face issue was a separate handoff defect. The actual client already froze `slideshowFaceSelection` for its subsequent face-swap stage, but the API's named-image resolver and planner ignored that field. The planner saw source slides and generic `+` attachments only. Thus it could ask for a missing face upload despite the dedicated picker being complete. The screenshots establish the reported mismatch; the exact historical hosted request was not retrieved, so this is the confirmed code gap, not a claim about unseen logs or model internals.

The API now verifies the selected primary/supporting photos against owned ready image records, size/type constraints and the current selected source slide IDs before planning/image-credit admission. It preserves ordered identity IDs and canonical source-target order. Browser photo URLs and copied source lists are not trusted as identity/source authority.

The durable planner input freezes those verified IDs and targets; the model receives target IDs and the verified photo count. Identity pixels remain reserved for the existing later face-swap stage. They do not become source/background/layout attachments or base-generation identities. The planner is told that the dedicated chooser already supplied face references and not to request them again. Existing post-generation swap count, version selection and charges are unchanged. New face-aware plans use plannerVersion5; no-face input/version4 shape and historical receipts remain unchanged. Changed photos/targets cannot reuse an accepted old plan fingerprint; no automatic paid retry is introduced.

The user's explicit displayed business-name correction is retained verbatim in the original request. Planner instructions permit a clear requested name to override the saved name only in this generation's copy, preserving other saved business facts and unsupported-claim safeguards. This does not modify the saved profile and does not certify an ungenerated output's spelling or copy accuracy.

An old clarification is shown only while its original prompt, uploaded attachments and dedicated face selection still match. Adding/replacing/reordering photos, changing marked slides or editing instructions hides obsolete feedback without deleting historical receipts or submitting a new request automatically. Genuine missing-data clarifications remain available for the matching request.

## Files changed by this task

- `components/explore/workflow-feedback.tsx`: error-semantic portal gate.
- `components/explore/workflow-creation-panel.tsx`: routine status becomes accessible-only; actual error/recovery remains visible.
- `components/generation/ai-studio-composer.tsx`: explicit error prop and accessible routine description.
- `components/workspace/ugc-chat-workspace.tsx`: image/slideshow error wiring, existing generation actions in results toolbar, clarification face/prompt scope.
- `components/video/video-generation-workspace.tsx`: video workflow error wiring and existing actions in results toolbar.
- `components/explore/slideshow-clarification-notice.tsx`: suppress obsolete clarification.
- `lib/ai-studio/image-generation-api.ts`: pass dedicated selection to the actual named resolver; actionable validation failures.
- `lib/explore/slideshow-named-context.ts`: server-owned face asset/target validation and planner metadata.
- `lib/explore/slideshow-request-plan.ts`: optional verified face context and authoritative chooser/name guidance.
- `lib/explore/slideshow-plan-service.ts`: durable face-aware snapshot/version and model context.
- `lib/explore/slideshow-generation-recovery.ts`: clarification scope includes photo order and exact targets.
- `lib/ai-studio/image-generation-api.test.mjs`: real resolver/API boundary tests with zero generic uploads, owner/deletion/missing/invalid guards and source order.
- `lib/explore/slideshow-plan-service.test.mjs`: actual model request construction, metadata-only input, frozen plan and no repeated model calls.
- `lib/explore/slideshow-generation-recovery.test.ts`: unchanged legacy no-face scope and selection invalidation.
- `scripts/explore-format-generation-ui.test.mjs`: actual client request/cancel/recovery location and obsolete question behavior.
- `scripts/workflow-action-feedback.test.mjs`: all workflow variants, routine suppression/error preservation and retained guards/actions.
- `scripts/workflow-floating-feedback.test.mjs`: normal messages/actions never create issue cards.
- `scripts/workflow-sections.test.mjs`: assert accessible readiness but no visible routine message; preserve error/refresh/action tests.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/nonnegotiables.md`, `docs/ai-context/clear.md`: append-only current contracts/incidents/evidence.
- This receipt. Global reusable lesson appended to `C:/Users/chund/.codex/mistakes.md`, without private media/customer/log content.

Other dirty files, including preload navigation, starting-frame scene corrections and Remotion authoring, are concurrent work and were not changed by this task. The new global mistakes rule, project ledger and protected contracts were read first. Large historical Explore/clear files used the user's existing relevant-complete-sections exception. No context history was removed.

## Preflight and scope contract

Actually read: updated AGENTS instructions, global mistakes ledger, complete protected nonnegotiables, applicable complete Explore/Carousel/incident sections, context-memory/immutable-contracts/UI-clarity/regression-gate/video-prompt skills, installed Next `use-client.md`, existing client/API/planner/fingerprint/recovery/face-swap code and tests. Repository preflight ran; `.tmp/error-only-face-swap/preflight.log`.

Minimal boundary: presentation gating and existing control placement; verified metadata-only selection handoff and matching clarification scope. Preserve ReAPI, Terra medium Talking Head Remix, Slideshow's existing model choice, source pixels versus identity roles, frame timestamps, ownership, saved jobs/pending receipts, billing, queues, scheduling and all unrelated work. No motion prompt or source-frame chronology was rewritten; no frame-analysis/output-quality claim is made. Rollback only these task-specific hunks/tests/context additions, retaining concurrent modifications and historical receipts.

## Verification

Commands are direct Node/non-build checks; no npm umbrella that builds workers was run.

1. Local regression command uses `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test`, with the files listed in `.tmp/error-only-face-swap/final-regression.log`: **323/323 PASS, zero skipped**. Covers actual client construction, API/named resolver, model payload, durable plan replay, clarification scope, face-swap targets/version/charges, photo uploads, negative ownership/deleted/missing inputs, shared notices, sections, session/recovery and composer sizing. `.tmp/error-only-face-swap/acceptance-tests.log` contains the final rerun after removing unused stale-copy branches. Counts overlap earlier279checks and must not be summed.
2. Scoped ESLint on changed runtime/test files: **zero errors, two existing unused-variable warnings** in the image workspace (`_createdAt`, `formatGeneratedAt`). No unrelated cleanup. `.tmp/error-only-face-swap/lint-final.log`.
3. `git diff --check`: PASS; `.tmp/error-only-face-swap/diff-final.log`.
4. Full app `node node_modules/typescript/bin/tsc --noEmit --incremental false`: **FAILED on three concurrent Remotion promo errors**, `isWinner` and `highlight` at1198/1901/1928. No error in the files changed for this task was reported. Entire app types are not claimed green. `.tmp/error-only-face-swap/types-latest.log`; related independent retest incident already records the same gap.
5. Static browser comparison: actual shared component trees/CSS,10workflow×viewport scenarios at1440 and390px. Before baseline produces1routine card; current routine states produce0, genuine errors1, no horizontal overflow and identical prompt geometry between routine/error. `.tmp/error-only-face-swap/visual-results.json`, `visual.log`. Screenshots Slideshow routine/error desktop/mobile and Talking Head states were generated; representative Slideshow desktop/mobile images inspected. These are isolated synthetic layout fixtures with test settings/results scaffolding, not a newly compiled or authenticated application. Handler behavior/X/recovery is separately verified in component tests; fixture screenshots are not backend acceptance.

The initial elevated visual-check attempt hit automatic permission-review timeout; the ordinary local execution succeeded after correcting its fixture import path. No approval timeout was treated as proof of an unsafe action. Initial test failures about old button locations/visible normal copy were corrected to assert the new requested contracts while keeping handlers and safeguards. One new asynchronous fixture initially asserted before its submit continuation; waiting for that continuation fixed the fixture without changing runtime admission.

## Protected behavior and remaining checks

| Contract | Result |
| --- | --- |
| Routine cards absent; errors/X/recovery retained | VERIFIED locally across five workflow variants; NOT DEPLOYED |
| Cancel/Retry/check-earlier remains accessible | VERIFIED actual-parent toolbar/handler tests; static layout only for pixels |
| No prompt/settings/footer displacement | VERIFIED isolated desktop/mobile comparison; actual newly compiled application NOT TESTED |
| Selected photos and exact target reach planner | VERIFIED client→API→owned resolver→actual planner-payload tests; no generic-upload requirement |
| Invalid/foreign/deleted photos cannot reach planning or reserve credits | VERIFIED local API tests |
| Identity/source separation and existing swap billing/version scope | VERIFIED metadata-only planning plus existing swap regressions; real generated identity NOT VERIFIED |
| No duplicate automatic planning/recovery, legacy no-face receipts | VERIFIED local durable-claim/fingerprint/recovery tests |
| Saved profile and explicit displayed-name instruction | Source/request preservation and prompt guidance VERIFIED; generated replacement copy NOT VERIFIED |
| Scheduling/provider/model behavior | Unchanged source, relevant sections/recovery guards tested; live publishing NOT TESTED |
| Whole-worktree types | FAILED on unrelated concurrent Remotion source; leave acceptance OPEN |

Incidents: UGC-UI-20261105-ROUTINE-FEEDBACK-CARDS and UGC-GEN-20261105-SLIDESHOW-FACE-PLANNER-HANDOFF. Cross-project lesson GLOBAL-20261105-FEEDBACK-AND-PLANNER-STATE. Technical local correction verified; both remain OPEN for actual hosted/output acceptance. A real corrected request must show no false face-upload question and the selected face only on the marked slide, alongside prompt/copy accuracy review. That requires future authorized runtime/provider testing; no paid generation was made here. No claim that records prevent every recurrence.
