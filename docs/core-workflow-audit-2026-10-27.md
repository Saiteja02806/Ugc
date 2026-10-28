# Core Talking Head / generation / scheduling audit - 27 October 2026

Verdict: core model admission and reference forwarding are verified at the code/contract layer; scheduling has real production success evidence but also a confirmed recovery defect. Do not describe every model and reference combination as production end-to-end verified.

No application code, migration, deployment, paid generation, transcription or publication changed during this audit. Changed only this report, append-only clear.md and the Explore context follow-up. An empty browser-local audit draft was opened, its synthetic audio/text cleared, and the original resume URL restored.

## Findings requiring attention

1. **P1 / UGC-SCH-006 - production still blocks retry of an old action-required target.** Target b2b629be-eb5a-4aa4-a058-72d32add40f8 originally failed with tiktok_invalid_grant. Its current connection is connected, nonrevoked, has a refresh token with future refresh expiry, and has four later published targets. Access-token expiry alone is not proof that refresh is broken. Read-only inspection of the actual deployed public.retry_social_publish_target(uuid,uuid,text) confirms an unconditional action_required return before current connection validation. The local migration20261026105718 fixes this and passes4/4 PGlite tests; the live function remains old. No retry or migration invoked. This is an existing production defect, not a new failure of initial schedule creation. A fresh token refresh was not attempted.

2. **P2 / UGC-UI-028 - incompatible audio remains selectable in the Omni picker.** Actual production check: select Omni Flash1.1, attach a synthetic3-second silent WAV locally, enter valid instructions. The attachment is accepted in the form, but Generate stays disabled and the message requires Seedance/WAN or removal. No Generate click occurred. WorkflowAudioReference consults maxAudioDuration but not allowedKinds before opening/accepting a file. The backend safety checks work; selection-time guidance is incomplete. Existing incompatible attachments must remain removable and model changes must not silently discard user inputs. This UX fix is not implemented by an audit.

3. **UGC-OPS-002 historical Seedance delivery remains unresolved for one recent record.** App job cc899a93-7ad1-44a6-82f9-943399d7982c remains failed/PROVIDER_OUTPUT_COLLECTION_FAILED while its ReAPI operation is provider_succeeded with a saved task ID. Existing October20 documentation already proves a read-only retrieval from the isolated CDN; it explicitly did not persist recovery to the app database. The exact-host fix is present in the active adapter; current regression tests collect that host safely without another generation POST. This historical failed record is not proof that the current adapter still rejects the host. Recovery of that existing result remains separate from generating a replacement. See docs/reference-upload-and-delivery-release-2026-10-20.md and docs/seedance-delivery-and-reference-limits-2026-10-20.md; prior recovery-migration deferral is preserved.

## Production evidence, last seven days

Read-only connected production Supabase project kltxwijhluawgveykfbt; queries checked around2026-10-27 09:49UTC. Counts cover the project/account database, not exclusively this Talking Head draft.

- 39published Instagram/TikTok targets have provider post IDs: Instagram9, TikTok30. No selected scheduled/queued/publishing target was more than15minutes overdue in this window. No YouTube target appeared; YouTube production acceptance remains unverified.
- Explore specifically:7published TikTok schedules, each with persisted target, scheduler identity, completed publish_social_post job and provider post ID;1failed/action_required TikTok schedule with saved scheduler and failed worker. No Explore schedule in this window lacks targets. Three cancelled non-Explore rows without targets are not classified as broken active schedules.
- Video generation: Google Omni8completed (2with reference video), WAN5completed (3with reference video), Seedance1completed plus1historical collection failure. Successful jobs have output_persisted provider operations. No Kling job and no audio-reference generation appeared in this window. Historical model success does not establish image/voice fidelity or every input combination.
- No explore_generation_requests rows in this period, so these generation successes cannot be presented as a fresh atomic Talking Head journey.
- Evidence saved under .tmp/core-workflow-audit-20261027/production-evidence.json. Sensitive tokens, user captions and prompts were not selected.

## Model-specific admission and delivery

These are **application/connected-route limits**, not every capability of each model family.

| Model / current route | Images | Audio reference | Video reference | Output settings / special rules |
| --- | --- | --- | --- | --- |
| Omni Flash1.1 / Google Gemini | up to10supported | rejected before generation; direct API also rejects | ordinary Talking Head reference attachment is blocked; supported Explore edit route accepts source up to10s with separate appearance images |3-10s ordinary generation,720p/1080p. Edits send full source bytes and omit forced output duration/aspect ratio. |
| Seedance2.5 / ReAPI | up to30 | one owned2-30s clip, up to15MB | one owned2-30s clip, up to200MB |4-30s ordinary output,480p/720p. Explicit edit needs4-30s source and native duration=-1/size=adaptive. |
| WAN3.0 / ReAPI | up to10;16MB image cap with timed refs | one owned1-15s clip, up to15MB | one owned1-15s clip, up to32MB |2-30s output,480p/720p/1080p; source-video seconds plus output seconds must fit30s, checked server-side before reservation and in worker. |
| Kling3.0 / Runway | up to2 first/last keyframes | rejected here | rejected here |3-15whole seconds,720p; no recent production execution evidence collected. |

Approved literal starting-frame animation is a separate mode: conflicting image/video/audio references are blocked rather than turning that image into a general reference. Sound/generated speech is different from an uploaded audio reference. Demo audio and final background music are separate finishing inputs; an Omni audio-reference restriction does not disable those editing features.

Trace verified: WorkflowCreationForm/WorkflowAudioReference -> getWorkflowGenerationDraftError/createWorkflowGenerationClient -> handleAIStudioVideoGeneration -> immutable job input -> resolveHookVideoProvider/runGenerateHookVideoJob -> buildReapiVideoRequest or generateGeminiOmniVideoBuffer -> durable provider task/output collection. Client snapshots exact selected file identities and API validates owned ready assets, IDs/URLs/MIME/size/duration and model settings before billing. Invalid, foreign, mismatched and conflicting references do not silently become prompt-only generations. ReAPI request fields retain ordered image_urls, video_urls, audio_urls; native first-frame paths use image_with_roles. Google sends actual image/video bytes in separate roles and does not receive an unsupported audio field.

Provider sources checked today:
- [Google Omni limitations](https://ai.google.dev/gemini-api/docs/omni): current API does not support uploaded audio references; audio inside reference-mode video is ignored. General multimodality marketing is not the admission contract.
- [Google Omni1.1 family specification](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/gemini/omni-1-1-flash): ten-image family limit; direct-route cap remains an application-supported choice, not a fresh paid test.
- [ReAPI Seedance parameters](https://test.reapi.ai/docs/seedance-2-5) and [ReAPI WAN parameters](https://reapi.ai/docs/wan-3-0): exact wire fields, reference roles, output/combined-duration constraints. Extra provider capabilities are not automatically exposed in this app.

## Actual deployed source identity

Website getugcpilot.com: dpl_7RCmDsbfGBjZsX8E3M78p15keGgE READY. Exact retained source .tmp/talking-head-live-release-20261027. Unrelated primary worktree changes were not substituted for live behavior.

Generation worker:100%traffic to ugc-ai-generation-worker-r-45bf657b, verified startup build/runtime commit45bf657be7624aa2b0de6f95f3d19cb049feddd0 and pinned image. Four critical files (reapi-video, gemini-omni-video, hook-video-provider, generate-hook-video) match the tested source after line-ending normalization. A stale infrastructure release label initially pointed to0a8bc1; it was rejected as identity evidence and actual startup identity was verified instead. No stale-worker defect inferred. Evidence worker-release-identity-verified.log and worker-source-comparison-verified.json.

## Scheduling trace

WorkflowFinishingBoundary prepares/verifies its final source and exact target selection -> authenticated POST /api/schedules -> createUserSchedule in lib/scheduling/service.ts -> owned source/account validation and durable scheduled_posts/targets/jobs -> createSocialPublishSchedule -> createGcpSocialPublishSchedule/Cloud Tasks -> runPublishSocialPostJob -> saved provider operation/post ID -> frontend verifySavedSchedule. Pending composition schedules use durable reservation/preparation and final target reconciliation rather than browser-only state.

Tests verify timezone conversion, exact retry identity, target/job persistence, duplicate callbacks/claims, cancellation, early delivery, transient/permanent failure, provider-operation reuse and final target projection. Production rows prove server worker/provider completion for the seven Explore cases above. A browser-closed timed experiment and a new scheduled post were not performed; no live external publication was triggered for the audit.

## Checks run and honest failures

All commands use the isolated website source unless explicitly marked primary; log directory .tmp/core-workflow-audit-20261027/. Counts overlap and must not be summed as independent coverage.

- Actual client/recovery/API contract and reference-flow suite:120tests,119PASS/1FAIL. The one failure is an unrelated slideshow image source-text assertion expecting referenceImageUrl = cleanTrustedHttpsUrl after that handler gained owner-aware canonicalization; it does not exercise video submission. Log generation-contracts.log.
- Omni/ReAPI worker integration source suite:24PASS plus one test-file load failure caused by executing a compiled-worker-style .ts test directly (missing reapi-video.js in src). Log provider-payloads.log. Re-ran the compiled ReAPI suite with publishing worker tests:52/52PASS, provider-worker-built.log. Source worker suites assert no paid provider network calls and verify actual MP4 edit timing/silence with synthetic fixtures.
- Scheduling service/time/retry/dispatch and actual PGlite atomic/pending DB suite:56/56PASS, scheduling.log.
- Primary local candidate action_required retry migration:4/4PASS, retry-fix-local.log. This does not mean deployed.
- Wider UI/audio/finishing suite:96tests,81PASS/15FAIL. All15stop at known missing lazy-hook-starting-frame-workspace fixture import. No application change made to hide those failures. Log workflow-ui-audio.log. The wider gate is not green.
- Active generation worker release checker PASS using actual startup commit. Gcloud reads only; no infrastructure change.
- Production browser negative test: valid instructions + local silent3s WAV + selected Omni => Generate disabled, explanatory model-support message. The file and text were removed, original resume page restored. Image proof below shows the selected model/local attachment; disabled state was separately read from the real button.

![Live Omni negative input check](C:/Users/chund/OneDrive/Desktop/UGC/.tmp/core-workflow-audit-20261027/omni-audio-rejected-live.jpg)

## Scope, memory and remaining acceptance

Read mandatory context-memory/immutable-contracts/scheduling/video-prompt guidance, scheduling contract, relevant actual Explore/clear history, prior release/audit reports and the real client/API/worker/scheduler source/tests. Large historical context-read truncation limitation from earlier receipts remains; no claim that every historical paragraph was reread. Existing UGC-SCH-006 and UGC-OPS-002 findings revalidated; new UGC-UI-028 records selector UX gap. No new code fix or deployment requested/performed here. EXPLORE_CONTEXT.md and clear.md receive append-only audit evidence.

VERIFIED: exact active core adapter source, model/input rejection, ordered reference forwarding in tests, production Omni rejection before clicking Generate, existing schedule/target/worker/provider evidence and retry defect. NOT VERIFIED: fresh paid audio-reference jobs, new Kling run, generated identity/voice/motion fidelity, YouTube production publication, a new complete Talking Head generate/edit/render/schedule journey, and provider token refresh for the old target. These require controlled acceptance and cannot be inferred from passing mocks or historical success.
