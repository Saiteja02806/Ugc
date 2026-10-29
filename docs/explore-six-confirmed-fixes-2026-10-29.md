# Six active Explore corrections — 29 October 2026

Status: six corrections implemented and locally verified; local production build passes. No deployment performed. Authenticated production acceptance remains unverified.

## Scope contract

1. Register the 28 published imported Wall videos in the server-owned starting-frame registry, preserving IDs, hashes, frame zero, retired entries and private sources.
2. Disable new paid Hook starting-image submissions for unresolved motion decisions in the existing controls. Preserve accepted-job recovery, existing images, prompts and identity/source roles.
3. Release rejected scheduling intents only after an explicit known pre-creation rejection and successful reconciliation showing no accepted post. Preserve exact requests for ambiguous responses, conflicts, time recovery and transport/server errors. Creator Phone behavior is excluded.
4. Keep remix application errors separate from audio-upload errors; correcting or successfully applying text clears only remix errors.
5. Restore the interrupted slideshow request before opening a different Library item, retaining the exact request, slides, words and recovery action.
6. Recover Wall remix blocks up to 6,000 characters while retaining Hook 600 and Slideshow heading/body limits, source bindings and unfinished drafts.

## Preflight and rollback boundary

Existing worktree changes are user work. Task-start copies and hashes are under `.tmp/six-explore-fixes-20261029/baseline/`; compare against these, not HEAD, when reviewing this task. Creator Phone source and route hashes are recorded and must remain identical. No dependencies, configuration, migrations, prompt templates, new permanent controls, provider calls or deployments are part of this task.

Sources consulted: root `AGENTS.md`; `EXPLORE_CONTEXT.md`, `WALL_TEXT_CONTEXT.md`; `docs/ai-context/clear.md`, `nonnegotiables.md`, `scheduling-contract.md`; context-memory, immutable-contracts, regression-gate, UI-clarity, scheduling, starting-frame and video-prompt skills; installed Next.js client/server and Playwright guides. Relevant history includes UGC-UI-046 (Wall layouts), UGC-UI-048 (draft saving versus export validation), UGC-SCH-010 (relative five-minute intent), and UGC-VID-028 (retired/reclassified sources). Current original-frame-zero policy overrides older first/middle-frame guidance.

## Acceptance

Each correction needs a failing regression before its repair and a passing run afterward. Cover catalogue/hash failures, disabled/click-bypass credit admission, accepted-job recovery, rejected versus ambiguous scheduling and reloads, text-error correction without losing audio errors, interrupted save plus Library link, and long Wall draft reload plus cross-format limits. Run relevant neighboring suites, types and scoped lint. Inspect existing component fixtures at desktop/mobile sizes; local fixtures do not establish authenticated production acceptance.

## Implemented changes and every task-owned file

| Correction | Implementation files | Regression files |
| --- | --- | --- |
| Published Wall source coverage | `lib/explore/starting-frame-reference-source.ts` | `lib/explore/starting-frame-reference-source.test.ts` |
| Block paid images for unresolved Hook decisions; accepted requests recover before the new server gate | `components/explore/hook-starting-frame-workspace.tsx`, `lib/explore/hook-keyframe-generation-api.ts` | `scripts/hook-starting-frame-ui.test.mjs`, `lib/explore/hook-keyframe-generation-api.test.mjs` |
| Correct definite scheduling rejection after verified absence; preserve ambiguous requests and all accepted receipts | `lib/explore/workflow-schedule-client.ts`, `components/explore/format-schedule-panel.tsx`, `components/explore/workflow-finishing-boundary.tsx`, `components/explore/pending-schedule-panel.tsx` | `scripts/explore-format-schedule-draft.test.mjs`, `scripts/workflow-finishing-ui.test.mjs`, `scripts/explore-pending-schedule-ui.test.mjs`, `lib/explore/workflow-schedule-transport.test.ts` |
| Remix correction clears only the independent remix error, including when audio controls are hidden | `components/explore/format-video-editor.tsx` | `scripts/explore-format-common-editor.test.mjs` |
| Interrupted save restores exact slides/request and Resume before a different Library link | `components/explore/format-slideshow-editor.tsx` | `scripts/explore-slideshow-editor.test.mjs` |
| Wall reviewed drafts restore up to 6000 characters; other formats retain existing limits | `lib/explore/remix-text-draft.ts` | `lib/explore/remix-text.test.ts` |

Documentation changed: this receipt, `EXPLORE_CONTEXT.md`, and append-only `docs/ai-context/clear.md` incident UGC-UI-054-EXPLORE-SIX. Existing changes to all listed shared files were retained. Creator Phone files were not edited; SHA-256 comparison against the task-start copies confirms its component and route are identical. The shared finishing boundary's new rejection-release branch applies only to kind `hook`.

## Validation and evidence

- New regressions failed before each repair: missing source 404; paid button/API permitted; rejected scheduling receipt remained in all three panels; corrected text remained blocked; Resume missing; 6000-character draft returned null.
- Final combined focused suites: **298/298 pass**. Command: `node --import ./scripts/next-server-only-test-loader.mjs --experimental-test-module-mocks --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/explore/starting-frame-reference-source.test.ts scripts/hook-starting-frame-ui.test.mjs lib/explore/hook-keyframe-generation-api.test.mjs scripts/explore-format-schedule-draft.test.mjs scripts/workflow-finishing-ui.test.mjs scripts/explore-pending-schedule-ui.test.mjs lib/explore/workflow-schedule-transport.test.ts scripts/explore-format-common-editor.test.mjs scripts/explore-slideshow-editor.test.mjs lib/explore/remix-text.test.ts`. The API regression covers all seven blocked IDs and an accepted image recovered after motion becomes blocked, without another source read or charge.
- Neighboring/server/database suites: **70/70 pass** across atomic direct scheduling, accepted-request recovery, pending schedule service/PGlite database lifecycle, Hook result/preview/draft/history, and slideshow actions. The tests use isolated fixtures/PGlite, not production tables or providers.
- Additional remix test covers both an actual audio-upload-handler failure and a source/audio-read failure; manual correction never clears those errors. Scheduling negatives cover failed/malformed reconciliation, timeout, rate limit, server error, unknown/idempotency conflict, accepted server receipt, cross-tab changes, reload and exact replay.
- `npx tsc --noEmit --incremental false`: **PASS** after explicit catalogue string narrowing.
- `npm run build -- --webpack`: **PASS**, including TypeScript, 296 static pages and the postbuild native-route bundle checks. Initial sandbox run failed creating `.next` directories with EPERM; the same local build passed outside the sandbox. This was compilation only, not deployment.
- Scoped `npx eslint` across the 20 implementation/test files: **0 errors**, one pre-existing unused `sourceFrame` variable warning in the generation API test. `git diff --check`: **PASS** for task implementation/tests.
- Two old assertions expected an earlier scheduling help string. Reproduced that failure with the task-start boundary copy before aligning the assertions with the existing help text. Product wording was not changed to satisfy the tests.
- Browser fixture: task-start and repaired shared Wall/Talking Head editors at **1280, 390 and 320 px** have six **byte-identical PNG screenshots**, with identical measured toolbar heights and no horizontal overflow. Screenshots inspected; hashes and comparison: `.tmp/six-explore-fixes-20261029/visual-comparison.json`. Before/after artifact directories are adjacent.
- The broader demo browser fixture passed upload/edit/save/reopen/loading/overflow/mobile and shared-toolbar scenarios in both versions, then **FAILED** the same later Hook end-of-clip rendered-text assertion in both. Adding an await for React did not resolve it. This is a baseline fixture/behavior gap with root cause **UNKNOWN**, not a newly verified production bug or a completed Hook playback acceptance claim. Kept outside the six repairs.
- Raw logs, baseline copies, and implementation-only diff: `.tmp/six-explore-fixes-20261029/`. The headless browser required execution outside the filesystem sandbox; it served only isolated local HTTP fixtures. No paid generation, production mutation, provider publication or deployment occurred.

## Protected behavior status

| Contract | Result |
| --- | --- |
| Creator Phone component/route and its existing schedule recovery | VERIFIED by task-start hashes and actual shared-boundary regression |
| Retired Wall IDs, immutable source hashes, existing Talking Head frame reads | VERIFIED locally |
| Accepted image recovery, private-source provenance, identity order, original frame zero, unchanged prompts/models | VERIFIED by API/UI/result/history tests; generated pixels NOT TESTED |
| Existing unfinished draft saving, exact slideshow request/text, Hook/Slideshow copy limits | VERIFIED locally |
| Scheduling target records, rollback, idempotency, time conversion and accepted-request replay | VERIFIED in isolated service/PGlite tests; live queue/provider execution NOT TESTED |
| Shared editor desktop/mobile layout | VERIFIED for the six compared screenshots |
| Complete Hook playback browser scenario | FAILED on baseline and current; root cause UNKNOWN |
| Authenticated deployed flows, real imported-media delivery latency, paid output quality, real publication | NOT TESTED / NOT VERIFIED; no deployment requested |
