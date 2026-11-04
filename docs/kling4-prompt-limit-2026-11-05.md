# Kling 4.0 long-prompt rejection — 5 November 2026

Status: local code defect VERIFIED and corrected. ReAPI's exact accepted prompt ceiling and successful long-prompt media generation remain NOT VERIFIED. No paid generation, deployment or production configuration change.

The application did not contain a 4,000-character Kling 4.0 rule. It omitted Kling 4.0 from the shared model policy entirely, so this model fell through to the old 1,000-character legacy Runway limit. The same policy is re-exported into frontend validation and used by the server and direct worker admission. The generic error could therefore be produced before ReAPI received any task. A new regression reproduced the actual policy returning 1000 instead of 10000 before the fix; .tmp/local-https/kling4-policy-before.log preserves that failure. The user's exact old job/provider receipt was not supplied or audited; do not claim all historical failures had this cause.

Correction: assign Kling 4.0 an explicit 10,000-character APPLICATION safeguard, matching this application's existing general video budget. This is not an assertion that 10,000 is ReAPI's native ceiling. Frontend, API and worker now use that model-specific budget. Add an assembled-prompt guard in the API before credit admission, and enforce the same budget in the final ReAPI request builder before credentials/network access. Text is preserved in full; there is no summarization, suffix removal, truncation or provider switch. The existing trim of surrounding whitespace is unchanged. Saved provider-operation recovery still bypasses rebuilding an accepted request.

Scope and files changed in this task:

- worker/src/lib/video-prompt-policy.ts — explicit KLING_4_VIDEO_PROMPT_MAX_LENGTH and model branch.
- worker/src/lib/reapi-video.ts — final request-length validation using that shared constant.
- lib/ai-studio/video-generation-api.ts — validate complete assembled Kling 4.0 prompt before admission. Existing unrelated dirty API changes preserved.
- lib/ai-studio/prompt-policy.test.ts — old fallback reproduction, model-specific boundaries and appended-guidance budget.
- lib/ai-studio/video-generation-api.test.mjs — exact 10,000-character preservation and excess rejection in both ordinary and atomic admission paths.
- scripts/workflow-generation-api-contract.test.mjs — real Talking Head/Phone clients to real API preserve 4,001/6,000/10,000 characters and the final marker; 10,001 cannot reserve credits.
- scripts/explore-format-generation-ui.test.mjs — actual Studio workspace accepts heavy Kling 4.0 words, preserves them across model changes and retains Kling 3.0 rejection.
- worker/src/jobs/generate-hook-video.test.mjs — direct worker passes all long-prompt characters to ReAPI and rejects excess before operation reservation.
- worker/src/lib/reapi-video.test.ts — text/frame request builder preserves exact long content and rejects 10,001 before any fetch.
- docs/ai-context/clear.md — append-only UGC-VID-20261105-KLING4-PROMPT-LIMIT incident and verification.
- EXPLORE_CONTEXT.md — source-of-truth finding and local-only acceptance limit.
- docs/kling4-prompt-limit-2026-11-05.md — this receipt.

Preflight actually read: AGENTS.md engineering rules; full protected nonnegotiables across bounded reads; relevant complete Explore/clear entries under the user's prior historical-read exception; ugc-context-memory, ugc-immutable-contracts, ugc-video-prompt, ugc-ui-clarity and ugc-regression-gate SKILL.md files; installed Next use-client guide; shared policy/callers, client/API/job/adapter, tests and git status. tools/preflight.py ran with this task; .tmp/local-https/kling-prompt-preflight.log. No source-video analysis or prompt-content rewrite was needed, so no frame-fidelity claim is made. No package/config/schema changes or production/worker build.

Provider research, read 5 November 2026:

- [ReAPI Kling 4.0 documentation](https://reapi.ai/docs/kling-4-0) documents the configured endpoint and request fields but states no exact character maximum for prompt.
- [Kling's own 4.0 guide](https://kling.ai/quickstart/kling-4-model-user-guide) specifies an 8,000-token input window. Tokens are not characters, and that native specification does not establish ReAPI's own gateway ceiling.
- [ReAPI model page](https://reapi.ai/models/kling-4-0) likewise supplies no prompt ceiling. Its public server-rendered textarea has no maxLength attribute. Public model metadata GET returned 404; attempted public asset inspection returned 403. Neither is evidence of long-prompt acceptance.

No different vendor's 2,500/4,000/8,000-character policy was applied to ReAPI. No paid task was started merely to probe the boundary. A successful upstream task with the exact sent prompt hash/length is still required to certify provider acceptance and generated-output fidelity.

| Protected behavior | Result |
| --- | --- |
| Heavy Kling 4.0 prompts are not rejected by legacy fallback | VERIFIED locally: 4,001/6,000/10,000 boundary tests across actual clients/API/direct worker/request builder; real signed-in localhost Studio accepts 5,063 characters. |
| Prompt remains complete | VERIFIED: exact text equality and final-marker assertions through queued input, worker provider arguments and request builder. No silent shortening. |
| Excess blocks before spending | VERIFIED: 10,001 rejected before API credit admission, worker operation reservation and adapter fetch. Browser marks invalid and disables Generate. |
| Other models / legacy recovery | VERIFIED in scoped regressions: Kling 3.0 2,500; legacy Runway 1,000; ReAPI Omni 2,000; Seedance/WAN 10,000 unchanged. Pending-request and saved-operation paths unchanged and tested. |
| Source/identity, sound, duration, credits and provider | Source diff preserves their wiring; ReAPI remains selected and Terra medium is untouched. No new reference modes or media capabilities. |
| Starting-frame and script limits | Existing 6,000-character direction and script constraints retained. Kling 4.0 is currently excluded from the approved starting-frame model helper; this task does not add it or change frame-role support. |
| Scheduling/publishing | No picker/API/job/worker publishing changes. Live durable scheduling/publication NOT TESTED. |
| Actual ReAPI acceptance / video quality | NOT VERIFIED. No external generation was submitted. |

Validation commands/results:

1. `node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --experimental-test-module-mocks --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/ai-studio/prompt-policy.test.ts scripts/workflow-generation-api-contract.test.mjs lib/ai-studio/video-generation-api.test.mjs scripts/explore-format-generation-ui.test.mjs` — 153 PASS, zero failed/skipped. Log .tmp/local-https/kling4-full-app-tests.log.
2. `node --import ./scripts/worker-source-test-loader.mjs --experimental-transform-types --experimental-test-module-mocks --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test worker/src/lib/reapi-video.test.ts worker/src/jobs/generate-hook-video.test.mjs` — 50 PASS, zero failed/skipped. Tests execute current TypeScript sources without building worker/dist. Log .tmp/local-https/kling4-worker-tests.log.
3. Actual client/recovery/settings group — see .tmp/local-https/kling4-recovery-tests.log; existing next-server-only loader, transform-types and test-module-mocks flags, files scripts/workflow-generation-client.test.mjs, scripts/workflow-generation-recovery.test.mjs and lib/ai-studio/generation-settings.test.ts. No real credits or external requests.
4. App `npx tsc --noEmit --incremental false`; worker `npx tsc -p worker/tsconfig.json --noEmit --incremental false`; scoped ESLint of the three changed runtime files; scoped `git diff --check` — PASS. Logs .tmp/local-https/kling4-final-types.log, kling4-worker-types.log and kling4-lint.log.

Two initial new tests had invalid fixtures and were corrected without changing runtime contracts: ordinary Studio cannot claim Explore person-photo purpose, and an uncertain submission remains recoverable after a model change. The final tests respect those contracts; no reference permission or pending lock was weakened to pass them.

Actual signed-in localhost check at /ai-studio?mode=videos: selected Kling 4.0, entered 5,063 characters, confirmed final marker intact, aria-invalid=false and Generate enabled. Then entered 10,001, confirmed aria-invalid=true, too-long error and disabled Generate. Mobile 390×844 retained all5,063 characters with no horizontal overflow and Generate enabled. Never clicked Generate. Restored original empty field and Seedance 2.5 selection; readback confirmed both. Inspected .tmp/local-https/kling4-long-prompt-mobile.png. Desktop screenshot timed out and is not claimed as visual evidence. Cold compilation/refresh caused navigation/menu retries; only successful readbacks are accepted evidence.

Rollback: revert only this task's explicit policy, final guards and associated tests/docs. Preserve existing Talking Head, notification, result-review, audio, automation and other concurrent work. No deploy, production settings or provider credentials were changed.

Final verification: recovery/settings group74/74PASS, appgroup153/153PASS, workergroup50/50PASS (277 total across the three separate file groups). Final appnonincrementalnoEmit completedexit0; workernoEmit/scopedESLint/diffchecksPASS. No productionbuild/deployment. Browserfield/modelrestore confirmed. UpstreamReAPIacceptance stillNOTVERIFIED.
