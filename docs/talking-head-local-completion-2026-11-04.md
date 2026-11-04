# Talking Head local completion — 4 November 2026

Status: text/prompt flow locally verified; generated-video and combined-release acceptance remain partial. Started4November; final local checks completed5November2026 IST. No deployment or production setting changes.

## Scope contract

Fix the missing spoken-word review gate and local draft-lock cleanup; review all 25 packaged source transcripts and hook/demo boundaries. Keep ReAPI video routing and Terra medium/prompt v2 business Remix. User subsequently approved a **Generate prompt** action in Script & Remix: complete spoken hook only, full source transcript separately, editable/copyable output, no automatic video generation.

Prompt export composes the displayed reviewed script with the source-linked scene directions already available to the application. It does not invent a frame-by-frame motion analysis, transcribe again, submit media or spend video credits. The export remains separate from the actual ReAPI video request and its duration/input constraints. Preserve edited prompts across section switches/reload; mark earlier output stale after script/direction/selection changes. Terra remains responsible for business script Remix; deterministic prompt assembly needs no additional AI call.

Protected: source t=0 and identity-photo roles, ordered owned photos and explicit removals, single loaded-frame Change card, mounted preparation sections and in-flight image/Remix owners, legacy receipts and source-scoped drafts, Hook/Text on screen, Demo/audio/Schedule behavior. No dependencies, schemas, provider migration, production settings or deployment. Roll back only the scoped review/lock/corpus/export patch and its tests; do not restore over unrelated concurrent work.

Acceptance: real importer positive/negative checks; client/API review-before-credit tests; strict-mode/pending-hydration/true cross-tab lock tests; actual component source isolation, stale replies, prompt copy/edit/persistence and no-request tests; typecheck/lint; signed-in HTTPS localhost browser desktop/mobile, script/source/section/reload behavior and a real saved Terra Remix receipt. Actual generated-video/lip-sync and unsupported first-frame-plus-photo input remain separate acceptance gates.

## Preflight receipt

Read AGENTS.md, full docs/ai-context/nonnegotiables.md, relevant complete EXPLORE_CONTEXT.md and clear.md sections under the user's explicit historical-read exception, previous Talking Head audit/readiness reports, actual callers/state/API/store/importer/worker tests. Mandatory skills read: ugc-context-memory, ugc-immutable-contracts, ugc-ui-clarity, ugc-regression-gate, ugc-frame-analysis, ugc-starting-frame, ugc-video-prompt, ugc-opening-frame-prompt. Also read Vercel react-best-practices and the installed Next.js use-client guide. Re-ran tools/preflight.py; prerequisites readable. Existing worktree preserved.

Incidents: UGC-QA-20261104-TALKING-HEAD-TRANSCRIPT-READINESS; UGC-UI-20261104-TALKING-HEAD-DRAFT-LOCK-RECHECK; new UGC-VID-20261104-TALKING-HEAD-PROMPT-EXPORT. Prior source isolation correction retained.


## Implemented behavior and local results

**Text/prompt flow VERIFIED locally; complete generated-video acceptance NOT VERIFIED.** No deployment or production settings changes. Existing HTTPS development server remains at https://localhost:3000.

- Review acknowledgement now follows the displayed spoken words from preparation through frame approval, the persisted Create draft, client admission and both durable video-job paths. Missing/false/string acknowledgements are rejected before credit reservation. Editing words or accepting newly remixed words clears review; no AI result reviews itself. Reopening unchanged same-source words preserves a valid selection-bound review. Historical absent review fields stay compatible but require acknowledgement before a new typed-script request.
- Each hook selection has a SHA256 over source/ASR fingerprints, complete selected words and 0-to-hook-end range. Stale selection Remix requests fail before provider invocation; legacy pending receipts remain readable without another paid POST. A changed selection clears the old review without deleting authored words.
- Generate prompt builds editable/copyable text from the entire displayed reviewed hook and the existing source-linked scene directions. Full source transcript is a separate disclosure; boundary/uncertainty notes accompany Original hook. The complete spoken block occurs once. t=0 image/identity/scene priority, natural delivery, no demo narration/cutaway and no generated lettering are explicit. It uses existing directions rather than claiming newly inferred frame-by-frame action timing. Terra still adapts business words; export is deterministic and makes no extra AI/image/video request.
- Prompt edits persist across Starting frame / Script & Remix, close/reopen, source A-to-B-to-A and full reload/resume. Script/direction/selection changes keep old output but disable stale Copy until review/regeneration. Clipboard failure has manual-copy recovery. Suggested duration preserves full words; export does not select provider settings or relax ReAPI duration constraints.
- Draft lock cleanup registers release before asynchronous hydration, skips already-cleaned effects and waits for the same editor's previous browser lock request to finish before reacquiring. Tests cover Strict Mode, pending media, delayed browser release, late stale hydration and real concurrent editor exclusion. Signed-in browser normal entry/reload/resume now works without the earlier warning. Hot reload during active edits was part of diagnosis; it is not evidence about production behavior.

## Transcript and boundary audit

Freshly re-read and SHA256-verified all25 full MP4 sources and original cached Whisper responses. fullText/segments/raw response fingerprints remain unchanged. Compared all25 against independent OpenAI gpt-transcribe full-source ASR (22new checks,3reused independent checks), and inspected each source's 2-second overview and native boundary contact sheet. This is NOT direct listening, exact forced alignment or a verbatim certification. All97 original zero-duration word warnings remain visible in the data. Timing boundaries are approximate semantic hook endpoints; they are not all visual demo cuts.

The importer now requires complete matching source/transcription/review catalogs and explicit fingerprint-matched nonempty hook selections with valid ranges/status/notes. Missing/stale/duplicate reviews, incomplete catalogs or invalid ranges fail before replacing the accepted output. No whole-transcript fallback remains. Future sources require explicit review; no bulk recreation prompts were generated for this catalog.

23 cross_checked_draft records;2 needs_review retired fact-check recordings cannot start a new script Remix. All20 currently visible sources remain available as drafts requiring user review. Known slang/negation disagreements are documented, not silently certified. Tessa's original full ASR omits later demo speech recovered by independent ASR; its hook ends at Listen to this, and the historical raw fullText is preserved. Source captions support the selected ChatGPT/God bless spelling corrections. No overlay text was invented as spoken dialogue for visual grocery demos.

| Source ID | Full source (s) | Hook endpoint (s) | Review | Boundary / uncertainty |
|---|---:|---:|---|---|
| talking-car-story | 9.467 | 9.200 | cross_checked_draft | Archived opening-only cut. Complete introduction ends with optional; no demo in this cut. |
| talking-warm-story | 35.267 | 24.780 | cross_checked_draft | Travel wherever ends the manifestation setup; app endorsement begins immediately afterward. Both ASR agree on selected words except Porsche/get phrasing; retained original caption-supported phrasing. |
| talking-outdoor-discovery | 14.140 | 14.060 | needs_review | Retired fact-check screen recording, not an ordinary talking-head source. Speech is clipped/ambiguous; keep unavailable for fresh script Remix. |
| talking-outdoor-reaction | 10.355 | 10.320 | needs_review | Retired fact-check recording with clipped/ambiguous source speech. Keep unavailable for fresh script Remix. |
| talking-room-explainer | 7.967 | 7.800 | cross_checked_draft | Archived opening-only cut; ends Trust me before website examples. |
| talking-car-explainer | 46.416 | 4.080 | cross_checked_draft | Intro ends until I quit; numbered symptom/body narration follows. No app-demo cut at this boundary, semantic introduction boundary. |
| talking-discovery | 2.207 | 1.340 | cross_checked_draft | Archived opening-only reaction. Quiet initial filler differs across ASR; retained Um pending user review. |
| talking-surprised-story | 1.567 | 1.000 | cross_checked_draft | No way is the complete vocal reaction; no extra dialogue inferred from overlay. |
| talking-mug-story | 27.867 | 27.780 | cross_checked_draft | The complete file is a spoken setup/story. No app screen/demo narration in this file; long introduction preserved, duration gate applies. |
| talking-sophia-designsthings | 40.434 | 7.320 | cross_checked_draft | Stop after ridiculously easy; Save this video / Basically make an app begin instructions before the later screen cut. |
| talking-emmgr4c3 | 33.877 | 12.720 | cross_checked_draft | Stop after I will show you; app booking-code/price-drop demonstration follows. |
| talking-tessam-bible | 15.834 | 4.900 | cross_checked_draft | Listen to this ends presenter hook; Holy trust fall is audio played by the app. Independent ASR recovers demo narration missed by original ASR; never append it to hook. |
| talking-websites-explainer | 26.956 | 2.740 | cross_checked_draft | Complete opening sentence ends knowing about; the first one is begins website demonstration. On-screen demo cut is near the audio sentence boundary, not an exact word aligner. |
| talking-katiemeidt8 | 65.534 | 26.480 | cross_checked_draft | So let me show you ends intro; Just go to this website begins demo. Corrected ChatGPT spelling retained. |
| talking-studyfetchlauren | 61.867 | 10.860 | cross_checked_draft | Let me show you ends introduction; You want to go into StudyFetch starts demo. Independent ASR varies and this is not / and it is not; retain original, user review required. |
| talking-sidghst | 9.821 | 9.540 | cross_checked_draft | Self-contained short joke. The phone is a visual prop while the same sentence continues; no app walkthrough, do not cut words simply at phone reveal. |
| talking-studywithsab | 60.767 | 44.380 | cross_checked_draft | Stop after most efficient way; Whenever I have an exam and upload my content starts demo. Independent ASR disagrees on opps/ops and lock-in negation; source captions corroborate original selected reading. Preserve review warning. |
| talking-bittenbyaturtle | 14.400 | 4.040 | cross_checked_draft | Only Okay I actually cannot believe this right now is speech; remaining app demo is visual/music. Do not transcribe overlay as spoken words. |
| talking-studywithsawyer | 47.000 | 7.980 | cross_checked_draft | In college ends setup; Because now whenever I pull up my paper begins demonstrated explanation. Corrected ChatGPT against native source caption. |
| talking-mumtipswithginny | 33.867 | 5.160 | cross_checked_draft | Just guessing ends question/setup; So we started using an app begins body/demo. Terminal comma normalized to sentence stop, no words added. |
| talking-car-story-full | 48.500 | 9.240 | cross_checked_draft | But that part is optional ends presenter introduction; You will go to YouTube starts demonstrated steps. |
| talking-room-explainer-full | 42.027 | 7.780 | cross_checked_draft | Trust me ends introduction; First is anatomylearning.com begins demonstrated website list. |
| talking-discovery-full | 43.838 | 1.560 | cross_checked_draft | This is crazy reaction followed by visual app demo. Um filler only in first ASR; retained warning, no demo text invented. |
| talking-carla-eatsss | 43.100 | 2.020 | cross_checked_draft | No way is complete spoken reaction; grocery demo afterward is visual/music, not spoken overlay. |
| talking-taliameals | 34.922 | 1.040 | cross_checked_draft | No way is complete spoken reaction; grocery demo afterward is visual/music, not spoken overlay. |

Evidence: .tmp/local-https/talking-head-completion-corpus.json; lib/explore/talking-head-hook-reviews.json; .tmp/local-https/transcript-review/independent.json and each <referenceId>-boundary.jpg; overview images .tmp/local-https/<referenceId>-review.jpg. The permanent review manifest retains independent ASR wording and individual uncertainty notes.

## Actual model / backend evidence

Two signed-in localhost Remix POSTs completed and their saved hosted receipts were read back without changing settings:

- 455cd190-b560-4217-a02e-86ae1f1a04d2: original No way! remains No way!, valid generic opening.
- c6d07919-ffe9-41b5-968d-896a1e3fbbde: source college/ChatGPT setup becomes "so figuring out what to post to get people to discover your SaaS can feel pretty much impossible". Reviewed output preserves the difficulty setup, adapts to the saved SaaS discovery context, adds no demo or unsupported result claim. This is one semantic spot check, not a full business-quality certification.

Both receipts: model and providerModel gpt-6.1-terra, reasoningEffort medium, promptVersion2, current selection hash and businessProfileVersion3. Sanitized evidence .tmp/local-https/talking-head-live-remix-receipt.json and talking-head-live-business-remix-receipt.json. No Luna substitution, automatic repeat call, new image or video generation. These tests create two owned text receipts on the existing hosted backend; localhost is not an isolated database emulator.

ReAPI video route and unsupported-combination guards are unchanged. Official current input rules separate locked frame roles from general references: [Seedance](https://reapi.ai/docs/seedance-2-5), [WAN](https://reapi.ai/docs/wan-3-0), [Omni](https://reapi.ai/docs/gemini-omni). The app retains ordered raw photos and refuses unsupported literal-first-frame + extra-photo requests before spending. Prompt export does not make that unsupported input combination work.

## Verification commands and results

- python tools/preflight.py --repo . --task <actual task>: prerequisites readable; .tmp/local-https/talking-head-fix-preflight.log.
- Non-build Node runner: --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --experimental-test-module-mocks --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --test-concurrency=2. Final scoped group: lib/explore/talking-head*.test.*, lib/explore/starting-frame*.test.*, workflow-session/remix-text-api, real video-generation API, scripts/talking-head*.test.mjs, starting-frame*.test.mjs, hook-starting-frame*.test.mjs, hook-composer-selection, workflow generation client/API/atomic/recovery/receipt, Demo/audio actual parent and workflow-session UI. **436/436 PASS, zero failures/skips**, log .tmp/local-https/talking-head-scoped-final-tests.log.
- Additional exact AST source/voice/demo separation test:1PASS, .tmp/local-https/talking-head-generation-separation-tests.log. It permits only the explicit typed script/review spread and still rejects other hidden/demo fields. Recovery fixture now imports the real pure script validator;19/19PASS, assertions unchanged.
- npx tsc --noEmit --incremental false: PASS, empty .tmp/local-https/talking-head-scoped-final-types.log.
- Scoped ESLint across13 affected application/type/test TS/TSX paths: PASS, zero warnings/errors, empty .tmp/local-https/talking-head-scoped-final-lint.log.
- git diff --check: PASS apart from informational Windows CRLF normalization notices.
- Actual importer positive plus7negative catalog-preservation cases included in436; raw-fullText preservation, output hash changes for changed hook selection and archive admission tests included. Fresh byte/hash audit25/25PASS.
- Initial combined test run:506PASS/1file-load failure due Windows EPERM at node_modules/base64-js; corrected isolated real API rerun11/11PASS. A subsequent command missing the repository alias loader failed before test execution; corrected command passed. These failures are retained in logs, not treated as successful runs.
- Wider neighbor suite:742tests,732PASS/10FAIL. Two failures were stale fixtures: recovery omitted the existing script-validator import and AST prohibition rejected the explicit script spread. Both repaired and rerun successfully. The remaining8 fail unchanged baseline expectations:3CSS assertions,3model/duration/default assertions,1duration-preset assertion and1voice-helper-copy assertion. Reproduced all8 using HEAD's pre-patch form plus unchanged HEAD CSS/registry/worker capability/audio sources: .tmp/local-https/talking-head-neighbor-baseline.log. No application style/model changes were made to satisfy them. The broad repository suite is **NOT green**; do not call this a complete release signoff.
- No worker build or production build was run. Worker/provider contracts exercised through current source fixtures in the scoped suite; compiled-dist tests were not presented as fresh source validation.

## Browser / visual evidence

Real signed-in HTTPS localhost,1440x1000 desktop and390x844 mobile. Source/full transcript GET and warm image-price GET returned200. Business Remix POST returned200 and actual saved receipt/model verified. Generate prompt and Copy added no AI/media POST. Native clipboard success message observed; isolated test asserts the exact authored prompt is copied, with manual-copy failure recovery.

Actual browser verified review-before-export, exact remixed-script inclusion, no inherited prompt on sourceB, sourceA draft/prompt restoration, manual prompt edits surviving section switches and A-B-A, stale Copy/Generate disabled after word edits, full reload/resume restoring edited prompt+review with no lock warning. Temporary script test words were restored and its test-only custom prompt replaced by a fresh complete generated prompt. Existing user drafts were not reset.

Before: .tmp/local-https/talking-head-fix-script-desktop.png and talking-head-fix-script-mobile.png. After: talking-head-prompt-final-desktop.png, talking-head-prompt-mobile.png and talking-head-prompt-output-mobile.png. Inspected output desktop/mobile screenshots: actions reachable by panel scrolling, no horizontal overflow (390px document width at390px viewport), sticky two-section navigation, textarea and Copy usable. Some screenshot/snapshot requests timed out during local compilation and were retried; only existing successful captures count. No approved pixel-perfect golden baseline or user visual approval is claimed.

## Protected behavior receipt / limits

| Behavior | Result |
|---|---|
| Hook-only words; full source separate; no automatic demo narration | VERIFIED selections/data/assembly; actual generated speech NOT TESTED |
| Selection/source fingerprints and source-scoped edits/recovery | VERIFIED25sources, component/API tests and signed-in A-B-A/reload |
| Reviewed script before new typed video billing; Sound/duration guards | VERIFIED real client/API fixtures, both job paths; human truth of a checkbox is not provable |
| Two mounted sections retain image admission/polling and scripts | VERIFIED controlled in-flight/batch tests and browser edits; live image job across switch NOT TESTED |
| Ordered raw photo selection, Change/upload/remove/reload and no silent drops | VERIFIED controlled cross-workflow regressions; live provider combination unsupported |
| One loaded frame card / stable restore geometry | VERIFIED existing scoped component regressions; no new paid frame for this check |
| Hook/Text on screen isolation, Demo/audio and Schedule draft state | VERIFIED controlled regressions; live publish execution NOT TESTED |
| Real Terra medium business text receipt | VERIFIED two owned completions/readbacks |
| Editable copyable prompt, no automatic video, persistence/staleness | VERIFIED component/browser/negative tests |
| Full first-frame + raw photos → spoken ReAPI video / identity / lip-sync | NOT VERIFIED; unsupported input combination remains BLOCKED |
| Production/combined release acceptance | NOT VERIFIED; no deployment and8pre-existing baseline failures |

Six visible unmodified hooks exceed15seconds at the current speech estimate: warm-story, mug-story, emmgr4c3, katiemeidt8, studywithsab and car-story-full. Full prompt export retains them; the app still blocks a too-short paid clip rather than truncating words. Independent ASR drafts, remaining source ambiguities, actual output fidelity and provider capability must remain explicit limitations.

## Files changed in this scoped worktree

- [EXPLORE_CONTEXT.md](C:/Users/chund/OneDrive/Desktop/UGC/EXPLORE_CONTEXT.md)
- [components/explore/hook-workflow-preview.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/hook-workflow-preview.tsx)
- [components/explore/talking-head-script-section.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/talking-head-script-section.tsx)
- [components/explore/use-workflow-session.ts](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/use-workflow-session.ts)
- [components/explore/workflow-creation-form.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/workflow-creation-form.tsx)
- [docs/ai-context/clear.md](C:/Users/chund/OneDrive/Desktop/UGC/docs/ai-context/clear.md)
- [docs/ai-context/nonnegotiables.md](C:/Users/chund/OneDrive/Desktop/UGC/docs/ai-context/nonnegotiables.md)
- [lib/ai-studio/video-generation-api.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/ai-studio/video-generation-api.ts)
- [lib/explore/talking-head-script-api.test.mjs](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/talking-head-script-api.test.mjs)
- [lib/explore/talking-head-script-api.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/talking-head-script-api.ts)
- [lib/explore/talking-head-script-draft.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/talking-head-script-draft.ts)
- [lib/explore/talking-head-script-store.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/talking-head-script-store.ts)
- [lib/explore/talking-head-script.test.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/talking-head-script.test.ts)
- [lib/explore/talking-head-transcripts.json](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/talking-head-transcripts.json)
- [lib/explore/workflow-generation-client.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/workflow-generation-client.ts)
- [lib/explore/workflow-session.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/workflow-session.ts)
- [scripts/import-talking-head-transcripts.mjs](C:/Users/chund/OneDrive/Desktop/UGC/scripts/import-talking-head-transcripts.mjs)
- [scripts/talking-head-script-section.test.mjs](C:/Users/chund/OneDrive/Desktop/UGC/scripts/talking-head-script-section.test.mjs)
- [scripts/workflow-composition-panel.test.mjs](C:/Users/chund/OneDrive/Desktop/UGC/scripts/workflow-composition-panel.test.mjs)
- [scripts/workflow-demo-audio-state.test.mjs](C:/Users/chund/OneDrive/Desktop/UGC/scripts/workflow-demo-audio-state.test.mjs)
- [scripts/workflow-generation-api-contract.test.mjs](C:/Users/chund/OneDrive/Desktop/UGC/scripts/workflow-generation-api-contract.test.mjs)
- [scripts/workflow-generation-recovery.test.mjs](C:/Users/chund/OneDrive/Desktop/UGC/scripts/workflow-generation-recovery.test.mjs)
- [scripts/workflow-session-ui.test.mjs](C:/Users/chund/OneDrive/Desktop/UGC/scripts/workflow-session-ui.test.mjs)
- [docs/talking-head-local-completion-2026-11-04.md](C:/Users/chund/OneDrive/Desktop/UGC/docs/talking-head-local-completion-2026-11-04.md)
- [lib/explore/talking-head-hook-reviews.json](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/talking-head-hook-reviews.json)
- [lib/explore/talking-head-prompt.test.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/talking-head-prompt.test.ts)
- [lib/explore/talking-head-prompt.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/talking-head-prompt.ts)
- [scripts/talking-head-transcript-import.test.mjs](C:/Users/chund/OneDrive/Desktop/UGC/scripts/talking-head-transcript-import.test.mjs)

No dependency, schema, hosted configuration, OAuth, provider-routing, deployment or build-trigger changes. .tmp verification logs, images, corpus/receipt diagnostics and local helper scripts are ignored artifacts, not release source. Existing source videos/ASR responses and historical receipts retained. No staging, commit or push performed in this task.

Concurrent slideshow automation/Sharp/manual Carousel changes visible in git status are excluded from this task receipt and were left untouched. This report is not a review of those changes.

Final read-only browser cross-feature navigation: Create → Demo → Schedule succeeded without alerts. Existing Demo upload/audio/subtitle sections visible; Schedule time chooser remains available and Prepare final video is disabled without footage. No schedule/publishing action was submitted. Browser returned to Create afterward.

Final scoped whitespace check passed. A later whole-worktree diff check found an EOF blank line in concurrently edited scripts/check-automation-sharp-traces.test.mjs; that unrelated file was left untouched.


## Final localhost recovery — 5 November IST

Saved-caption GET and later script/price GETs repeatedly aborted while the local route compiler stalled. Existing PID30036 was verified as this workspace's Next start-server; its managed session64736 was stopped with Ctrl-C. Restarted the existing .tmp/local-https/start-local-https.ps1 under the user's persistent local development-compilation authorization (new managed session25702). No source/config/certificate/auth changes, production build or deployment. Compiler stall root cause remains UNKNOWN; no claim it was a production defect or fixed application code.

After restart: actual signed-in saved-captions GET200 (network657, server2.7s); transcript GET200 (686); image-price GET200 (687). Anonymous saved-caption probe401 confirms auth guard remains. Browser signed in, no visible alerts; saved remixed business words and video prompt restored. Create/Script & Remix left open for user testing. Earlier abort failures remain in network/log history. This operational recovery supersedes any earlier claim that a healthy server had already been left running during the stall.
