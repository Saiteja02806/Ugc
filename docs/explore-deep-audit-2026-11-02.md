# Explore and starting-frame audit — 2 November 2026

Overall status: PARTIALLY VERIFIED. Confirmed upload and recovery defects prevent a clean end-to-end acceptance. Audit only: no application fixes, deployment, production writes, billing changes, new paid requests or queue replay. Existing dirty work preserved.

## Findings, ordered by priority

### P1 — Production media uploads blocked from the new domain (UGC-UI-111)

Read-only bucket configuration and actual OPTIONS preflight rechecked. gs://ugcsaas-media allows GET/HEAD/PUT from getugcpilot.com/www and selected localhost origins, but omits both Vidmake origins. OPTIONS PUT with content-type from vidmake.io and www.vidmake.io returns200 without Access-Control-Allow-Origin; legacydomain returns its matching origin. A successful HTTP200 preflight alone is not permission for browser uploads.

CharacterWorkspace downloads each catalog look, uploads an owned reference, then submits generation. Starting-frame and Explore media pickers also use the shared owned-upload path. New uploads can therefore stop before any generation job exists; reuse of an already-owned saved asset has a different path. This is a confirmed blocker, not proof that every Failed to fetch is this exact request. The screenshot's authenticated network request was not available.

Remediation: separately authorize and apply the two exact Vidmake origins while preserving existing CORS rules, then verify actual browser upload/completion and owned media persistence. No production configuration changed in this audit.

### P1 — Saved stages do not guarantee automatic job recovery (UGC-VID-053)

`lib/explore/hook-keyframe-generation-api.ts:154` admits starting frames with maxAttempts1. `worker/src/processor.ts:401` terminally fails RetryableJobError when attempt_count+1 reaches max_attempts. The durable image runner throws RetryableJobError for a harmonizer failure and definite retryable provider rejection, but this admission budget exhausts immediately. The UI offers Generate another starting image rather than a demonstrated same-job resume after terminal failure.

Production read-only query:73/73 starting-frame jobs in the preceding7days have max_attempts1. Temporary diagnostic based on the real compiled processor test, configured with that budget and real processor logic, confirms statusfailed and deliverydeleted rather thanqueued. The diagnostic's markFailed store stub records terminal state; no database or queue mutation occurred. Existing27processor tests pass separately.

Stage persistence itself is sound in focused tests: Stage2 rejection does not return Stage1 as success, saved Stage1 is reused by a fresh runner, harmonizer failure propagates, changed/corrupt inputs fail closed, concurrent deliveries cannot both obtain the paid-submit grant. That is helper-level behavior; the admission/processor boundary still needs repair.

Remediation: add bounded recovery for definite rejection/local harmonization/finalization within the same admitted request and existing stage ledger; preserve uncertain paid-submission blocking and old fingerprints. Do not simply replay all failed provider submissions or generate a fresh charged request. Add an admission→processor→stage test, not only direct runner tests.

### P1 — Starting-frame stages omit explicit ratio configuration (UGC-VID-054)

`worker/src/lib/openrouter-gemini-image.ts:86` emits image_config only when imageSize is present. The scene and identity inputs at188/192 carry aspectRatio but no imageSize. An actual builder probe with aspectRatio9:16 returns image_confignull. Thus the ratio variable does not become an explicit API ratio setting on these stage requests. Character generation explicitly opts into2K configuration and follows a different path.

`worker/src/lib/image-output.ts:49` preserves substantial mismatches using contain with a white background. Synthetic928x1152 red input, requested9:16, became720x1280 with a white top pixel. Correct saved canvas dimensions therefore do not prove correct model framing or source composition. This may contribute to previous crop/background issues, but is not established as their sole cause.

Remediation: new versioned stage requests should carry explicit supported ratio configuration and a deliberate output-shape/quality gate. Preserve accepted historical stage fingerprints; do not silently change retry inputs. A padding-only output must not be treated as visual fidelity evidence.

### P2 — Caption/scene/outfit fidelity remains a manual acceptance risk (UGC-VID-049)

Current prompts instruct both stages to remove captions/text and preserve source pose/scene or explicitly selected background/outfit. Source-default roles and independently selected first-photo role overrides are frozen in preparation/job fingerprints. Earlier real test receipts record main caption removal and requested outfit preservation in one sample, alongside failed full-frame QA: changed crop, added microphone, remaining physical lettering. No new paid image or pixel-quality test was performed in this audit.

The local harmonizer is a CIE-LAB color/grain pass using fixed normalized skin regions, not a semantic caption remover or detected-face tracking system. Its successful completion cannot certify caption removal, correct face location, scene preservation or exact wardrobe. Do not report a perfect image from pipeline status alone.

### P2 — Explore regression gate remains red (UGC-OPS-021)

`npm run test:explore`:1348tests,1178pass,170fail; worker build succeeds. Failures span13files. Major causes include stale VM harnesses that return a string for getModelProviderInfo (91composer plus30reference-input cases), missing newer imports in34job-recovery cases, old blue-selection style assertions, changed model/duration assumptions, and local caption-font rendering failures. These are not170independently proven application defects.

Temporary composer diagnostic loads the actual provider-logo helper rather than the mock string:69/91pass,22fail. Remaining failures were not waived or fully classified; no tracked test expectations were weakened. Existing full suite remains red.

An isolated `explore-single-pass-subtitles.test.mjs` run outside the sandbox still fails FONT_UNAVAILABLE with "The Editorial fonts could not render these words." Production Linux rendering impact UNKNOWN. The broad suite also reports two video-finishing failures. Restore a trustworthy harness and verify all caption styles on the actual worker platform before declaring finishing/export accepted.

## Production records and runtime evidence

Read-only queries used projectkltxwijhluawgveykfbt, matching supabase/.temp/project-ref. Selected schema metadata, bounded job fields and aggregates only; no user photos, tokens, prompts or private URLs exported.

- Prior7days:73starting-frame jobs;61completed,12failed. Failed reasons:7HTTP402,2incomplete/noimage,3predispatch persistence. These are historical, mixed-provider/model jobs, not a success-rate estimate for the new pipeline.
- All61completed records have mediaAssetId; no completed record missing that field was observed. All73recorded sourceFrame.index values are0. Presence of an ID is not image-quality proof or a full storage-integrity audit.
- New starting-frame jobs admitted since the website release at2026-11-02T07:57Z:0. No persisted openrouter-image-scene/identity/harmonize-v1 rows exist at audit time. Consequently no hosted proof of the new stage ledger executing end to end is available.
- Recent6h generation-worker severityERROR query returned none. Empty logs do not establish successful execution when there are no admitted jobs.
- Strict worker gate passed: ugc-ai-generation-worker-r-aae72c9a active100percent, pinned image digest, verified startup log and matching baked/runtime aae72c9af8df8cdab481c5977e2ec408ba868343. Website follow-up worker tree is identical. No worker release mismatch observed.

## Flow boundary review

| Boundary | Result | Evidence/limit |
|---|---|---|
| Explore public entry, desktop/mobile | VERIFIED | Production screenshots1440/390, nine destinations, four Quick start links, no page horizontal overflow; no broken inspected images/loaded cover video errors |
| Navigation to private Talking Head/character | PARTIAL | Signed-out test browser redirects to sign-in as expected; authenticated workflow unavailable |
| New photo/catalog reference upload | FAILED | Missing Vidmake CORS origin verified by configuration and actual preflight |
| Owned saved photo selection | VERIFIED locally | Owner, type, object size, duplicate validation; wrong owner/stale/deleted output tests |
| Original source frame | VERIFIED locally | t0/index0/sourcehash/preparationkey checks; historical timestamps preserved |
| Background/outfit options | VERIFIED locally | Source default, first selected influencer photo override, draft fingerprint invalidation; generated-pixel fidelity not certified |
| Prompt/receipt/job admission | VERIFIED locally | Frozen full prompt, role and source bindings, cost/model validation;111focused tests |
| Stage1→Stage2→harmonizer | VERIFIED locally |33stage/provider/harmonizer/contract tests plus10worker dispatch tests; no hosted postrelease run |
| Failed-stage automatic recovery | FAILED | maxAttempts1 admission contradicts retryable runner; terminal processor diagnostic |
| Completed result→approval→animation | VERIFIED locally | Owned job/media checks and stale-input rejection; authenticated live approval/animation not exercised |
| Video generation/edit/demo/schedule/export | PARTIAL | Broad suite1178pass170fail; no fresh paid video, real publish or closed-browser scheduling test |

## Commands and artifacts

- npm run test:explore — FAIL1178/1348; `.tmp/explore-deep-audit/explore-tests.log`.
- Node module-mock starting-frame API/result/client/draft/prompt/motion/history/variation/photo-carryover/animation-reference suites — PASS111; starting-frame-tests.log.
- Worker dist durable-image-stages/openrouter-gemini/image-harmonizer/receipt-contract — PASS33; stage-tests.log.
- Worker source generate-image.hook-keyframe tests — PASS10; worker-keyframe-tests.log.
- Worker processor tests — PASS27; processor-tests.log.
- Temporary one-attempt processor diagnostic — PASS1, asserts terminal failure for retryable error; one-attempt-final.log. First diagnostic correctly reached fail handler but needed a state-recording stub rather than the original "must not fail" stub.
- Isolated temporary composer diagnostic —69/91pass; composer-diagnostic-final.log. Initial diagnostic helper required actual JSX runtime imports; corrected locally without editing repository harness.
- Isolated subtitle rendering, including unsandboxed local run — FAIL FONT_UNAVAILABLE; subtitle-isolated.log.
- Provider payload/normalizer synthetic probe — image_confignull;928x1152→720x1280 with whitetoppixel.
- Production Explore screenshots `.tmp/explore-deep-audit/production-explore-1440.png` and390.png captured and visually inspected. No overlap or horizontal overflow seen. Console contained image/aspect/preload warnings but no errors; not claimed warning-free.

## Scope, instructions and outstanding acceptance

Read context-memory/immutable/UI/regression procedures in preceding same-session work; starting-frame/video-prompt and Supabase skills read for this audit, current source and relevant Explore/incident/nonnegotiable contracts consulted. Current explicit original-t0 policy supersedes historical skill advice to pick later clarity frames. No new prompts written. Large historical context was not reread in full; no claim otherwise.

Only this report and append-only incident entries were added by the audit. No app/source/test implementation fix, infrastructure change, deployment, paid API call or production record mutation. Other dirty files and concurrent work remain untouched.

The browser available to the audit is signed out; a sign-in request is pending. Full authenticated UI→upload→billing→queue→Stage1→Stage2→harmonizer→savedasset→approval→video execution is NOT VERIFIED. A fresh bounded run and output review are required after upload/recovery defects are addressed. Existing earlier real trials do not substitute for a new hosted end-to-end run.

Recommended order: fix upload CORS; fix bounded same-job retry while retaining uncertain-call protection; add versioned explicit image configuration and output review; repair test harness/font validation; then execute one authenticated source-specific starting-frame→approval→video pilot and verify saved stages, credit ledger and generated pixels. No release should be certified end to end from current evidence.
