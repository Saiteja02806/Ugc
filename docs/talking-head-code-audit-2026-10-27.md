# Talking Head + Demo code audit — 27 October 2026

Scope: deployed reference release dpl_B6HT7nNDKy5HXq6ETmk7gY48Fnno; exact saved source .tmp/talking-head-live-release-20261027. This reviews correctness, not a full security scan or fresh production media/publishing test. No application fix, deployment, paid generation or social mutation performed.

## Findings

### P2 — Stalled generation submission blocks in-page recovery
lib/explore/workflow-generation-client.ts222-227 awaits video workflow-start POST and response JSON without an abort signal or deadline. ConnectedGeneration keeps submittingRef true until generate settles, while recover returns early at workflow-generation-boundary.ts250-251 whenever submittingRef is true. Thus a response/body that remains pending leaves Preparing indefinitely from the application's perspective and Refresh status cannot make progress without leaving/reloading the page. Durable request identity helps recovery after remount but does not release this mounted state. Use bounded waits while preserving the original receipt/key and exposing read-only recovery; do not automatically retry a paid POST.

Controlled reproduction runs real createWorkflowGenerationClient with an unresolved fetch, confirms no signal and an already-starting rejection, then resolves the response for cleanup. It does not claim a live provider incident or wait indefinitely to prove a universal network timeout.

### P2 — Purely visual overlay edits erase corrected subtitle words
components/explore/workflow-finishing-boundary.tsx57 includes complete composition in its audioSelection fingerprint;68-70 clears all corrections on any difference. hook-workflow-preview.tsx298-299 supplies full ExploreFormatEdit objects, which contain text color, position, value and typography. Changing those visual fields leaves speech unchanged but discards the user's corrected names/words and can restore original transcription errors at export. Compare only audio-affecting source IDs/trims/volume/track semantics for invalidation; preserve corrections for visual edits.

Reproduced through the actual finishing boundary with existing React fixture: establish corrections, change overlay color only, observe corrections becomes[]. No API/provider call needed.

## Other paths reviewed
- Upload/replacement: stale revisions, owned asset admission, recovery pending flags, source selection, demo/audio association and previous-preview retention.
- Generation: image/video/audio validation, approved starting-frame payload, prompt/script roles, immutable request snapshot and request/job recovery.
- Editing/finishing: independent opening/demo states, scope, dirty/save blockers, subtitle selection, audio layering, output signature and persisted receipt validation.
- Scheduling: readiness, exact source/target receipt verification, same-key retry, uncertain response handling and cross-tab locks.
No additional finding is asserted from missing live evidence or stale fixtures. Passing static inspection is not a production end-to-end guarantee.

## Validation and limitations
Two focused defect reproductions PASS on deployed source; logs .tmp/talking-head-additions-20261026/code-audit-{reproduction,generation-stall}.log. These assert present defects, not repaired behavior. Temporary tests remain only under ignored production snapshot/scripts. Prior audit:58backend/session/local DB tests PASS; real audio-render test PASS; broad133case run117PASS/16FAIL with documented fixture/provisioning drift. Do not sum overlapping counts or call broad gate green. No new signed-in browser/model/output/schedule/queue/provider acceptance.

Source reading: hook-workflow-preview, useWorkflowSession, useLocalWorkflowMedia, useWorkflowSourceVideo, useTalkingHeadReference, TalkingHeadClipEditing, WorkflowFinishingBoundary, useWorkflowFinishing, WorkflowGenerationBoundary/client, workflow-session, workflow-schedule-client/transport and relevant tests/types. Mandatory context-memory/immutable-contracts/regression-gate procedures consulted in this conversation. Existing source/context constraints retained; no UI/layout/backend contract altered.

Incident IDs:UGC-UI-017 andUGC-OPS-008, both OPEN with named regressions. Primary files changed only this report and append-only docs/ai-context/clear.md. All user runtime changes preserved.
