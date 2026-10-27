# Talking Head + Demo end-to-end audit — 27 October 2026

Verdict: PARTIALLY VERIFIED. No claim of a fresh authenticated production end-to-end pass.

## Evidence scope
Audited the exact deployed website source snapshot .tmp/talking-head-live-release-20261027, deployment dpl_B6HT7nNDKy5HXq6ETmk7gY48Fnno, production base c630c66f plus scoped reference release. Do not substitute newer uncommitted primary-worktree features/tests for live behavior. No runtime edits, deployment, paid generation or publication in this audit.

| Stage | Evidence | Status |
| --- | --- | --- |
| Reference files/posters/seek | All14 supplied/replacement live files return200, exact prepared SHA256/bytes; posters200 and ranges206.23canonical/18visible membership tested. | VERIFIED file/integration layer; signed-in gallery interaction NOT VERIFIED |
| Reference selection and starting frame | Canonical manifest/source registry, exactt0 PNG hash/dimensions; invalid/missing source fails; old IDs retained. Long originals remain full previews; legacy video-reference mode blocks>30s rather than trims. | VERIFIED code/tests; live image generation NOT TESTED |
| Generation admission/recovery | workflow-generation-client validates reference types/length/duration, freezes request key/body, posts workflow-start and recovers same accepted request. Script/Sound/starting-frame prompt routes inspected. | Local client tests pass; provider quality/job completion NOT VERIFIED live |
| Upload and saved session | Owned IDs stored, exact selected result recovery, pending replacement feedback and owner/stale-result isolation. useWorkflowSession and uploadDemo/reference pathways inspected. | Local behavior tests PASS; fresh production upload/reload NOT TESTED |
| Demo/editing | Independent source/demo drafts, saved trim/text/framing, pending-write blockers, current raw preview, edit-state recovery and explicit output selection. | Local composition checks PASS; live pixel/export parity NOT TESTED |
| Three audio scopes | Real source renderer test with synthetic tones verifies opening speech, demo original/attached sound and whole-video music at separate time ranges. | Real local render PASS; live hosted render NOT TESTED |
| Finish request | POST /api/explore/finishes; GET same requestKey; owned output/uncertain receipt handling, no blind replacement request. | API/store tests PASS with mocked external boundaries |
| Scheduling | WorkflowFinishingBoundary submits /api/schedules and validates exact source/idempotency/targets via verifySavedSchedule; local atomic DB/client tests verify persistence/replay. | Local tests PASS; real schedule/queue/provider delivery NOT TESTED |

## Commands and outcomes
- Production-source selection/client/session/composition suite:133tests,117PASS/16FAIL. Failures investigated:13 layout fixture failures stop at missing lazy-hook-starting-frame-workspace mock;2catalogue tests still expect9items or rely on changed array positions;1music test initially lacked built worker output. These are test/provisioning failures, not proof of16customer defects. Gate is not green; fixtures were not modified in this read-only audit.
- Backend API/store/session/schedule-preparation/local atomic DB/client suite:58/58PASS, no skips. Log .tmp/talking-head-additions-20261026/production-backend-audit.log.
- Composition/review suites after worker build:30PASS plus1audio-render dependency failure. Existing installed worker dependencies linked into isolated snapshot; real audio-render test then PASS. Log production-audio-render-audit.log. Counts overlap first suite and must not be summed as distinct coverage.
- npm run worker:build PASS for isolated production source. No worker deployment.
- Exact media/source tests earlier5/5PASS; reference import49/49 applies to primary workspace only and is not an end-to-end production result.

## Relevant live/local differences
Live source retains manually entered HH:mm scheduling and lacks the newer uncommitted shared picker/history/optional face-photo parity work. That is a release-state difference, not evidence that schedule persistence itself is broken. Do not describe those local-only capabilities as deployed. The reference-only release intentionally did not deploy unrelated workflow changes.

Live starting-frame Talking Head supports speech only with Sound on; silent output with Sound off is intentional. Full reference previews include original demos, while generation directions intentionally keep a talking-head opening and use the user's script; Demo is attached separately. Viewing a full reference does not promise generating its full demonstration or original runtime.

## Limits and next acceptance
Browser control remained disabled/unresponsive during prior checks. No fresh authenticated journey, user-specific persisted draft, output media/job IDs, schedule/target IDs, queue/worker receipt or provider post was collected. No specific current production upload/render failure was reproduced. A real successful controlled journey is still required before answering that the entire workflow works end to end. Publishing requires explicit authorization; audit itself submitted none.

## Sources inspected
Mandatory context-memory/immutable-contracts/regression-gate/scheduling skills; prior feature/release receipt and existing protected contracts from this conversation. Inspected deployed hook-workflow-preview.tsx, use-talking-head-reference.ts, talking-head-reference-client.ts, starting-frame-workflow.ts, workflow-generation-client.ts, workflow-session.ts/tests, workflow-finishing-client.ts, workflow-finishing-boundary.tsx, workflow-schedule-client.ts, simple-workflow-schedule.ts, workflow-scheduling-panel.tsx and local tests. Historical UGCSCH001/002 and UGCOPS003 safeguards remain open; existing fixture drift is consistent with UGCOPS004. No new customer defect asserted and no incident marked fixed.

Only this audit document changed in the primary worktree. Supporting generated worker output/logs remain ignored in .tmp; unrelated user changes preserved.
