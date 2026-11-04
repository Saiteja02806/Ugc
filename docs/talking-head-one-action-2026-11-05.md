# Talking Head one-action personalized prompt — 5 November2026

Status: requested one-action text/prompt flow VERIFIED locally. Production/video acceptance remains separate; no deployment or production setting changes.

Scope contract: replace the two generation buttons in TalkingHeadScriptSection with one primary Generate prompt action. Use the existing owned business-profile/Terra-medium Remix API once; automatically compose its returned full hook with the frozen source-linked scene directions. Keep output editable/copyable, human review separate for future paid video, and full source transcript separate. Freeze pending prompt context locally with the durable request identity; preserve stale/newer edits, uncertain read-only recovery, explicit-empty/source-owned drafts and previous authored prompts. Copy remains a result utility. No broader constructor/result-view redesign in this patch.

Edit boundary: components/explore/talking-head-script-section.tsx; lib/explore/talking-head-script-draft.ts local versioned schema; lib/explore/talking-head-prompt.ts review-input semantics and receipt metadata; corresponding component/pure tests and append-only contracts/context. Backend API, business-profile ownership/model/prompt, ReAPI/worker/provider routes, image selection/job ownership, Hook/Text on screen, Demo/Schedule, dependencies and hosted schemas/settings stay unchanged. Rollback only this incremental combined-action patch over the existing uncommitted work; do not restore unrelated files.

Acceptance: one primary action/no standalone Remix button; reviewed source + saved business context required; exactly one POST; returned business words occur in output; no video/image POST; current-input context frozen for recovery; no automatic paid repeats; late responses preserve new words; pending/result/manual prompt survives reload; missing business/disabled/storage/failed/uncertain states; script-to-Create stays unreviewed after AI; desktop/mobile UI screenshots plus scoped tests/types/lint and actual signed-in localhost receipt.

Preflight: AGENTS engineering rules; full protected nonnegotiables; relevant complete Explore/clear sections under existing user-authorized historical-read exception; context-memory, immutable-contracts, UI-clarity and regression-gate skills read/reused; prompt skills and source evidence retained from preceding prompt audit, no motion-template rewrite. Installed Next use-client guide read. tools/preflight.py passed prerequisite discovery; git status and actual caller/API/persistence/tests inspected. User screenshot is defect evidence, not an approved golden design. Preserve concurrent Carousel/automation changes.

Incident: UGC-UI-20261105-TALKING-HEAD-DUPLICATE-PROMPT-ACTIONS OPEN before code edits. Broader prompt density issue remains separate; removing a duplicate action alone is not a complete layout redesign.


## Implemented flow

There is one primary Generate prompt action; the separate Remix for my business control is removed. It validates the reviewed full hook and scene input, saves a recoverable request/context snapshot, invokes the existing business Remix endpoint once, then composes the returned personalized words into an editable/copyable prompt. The helper's sourceReviewed flag records permission to adapt the reviewed input, not approval of newly generated speech. The new output is available for draft Copy immediately; its spoken-word acknowledgement stays false for later paid-video admission.

The existing backend loads the owned business profile and freezes its version/context in the paid text claim. No API payload, endpoint, model policy, schema migration or provider route changed. UI-only prompt context is stored beside pending and is never posted in the strict Remix body. New exports retain request identity and business-profile version. A changed business profile also marks output stale.

Pending context freezes scene directions, source selection and hook endpoint before spending. Check saved prompt uses the same primary control in a recovery state and issues GET only. A completed response and its prompt are saved together rather than clearing the paid marker first. If completion saving fails, the original marker remains on disk and reload recovers the paid result. Legacy script-only receipts still recover without new POST; matching current source evidence permits prompt assembly. Unavailable/changed legacy evidence recovers the text with an explicit review message.

Typing words or editing an existing prompt during generation increments the local revision. A late response preserves that work and saves an earlier-result candidate, including across reload; Use generated prompt is a conditional acceptance utility, not another generation action. Corrupt context/request pairing blocks new spending without overwriting the saved data. Missing business context or disabled personalization cannot silently produce a generic prompt. Full original transcripts, ASR/source files, frame/identity selection and motion template prose remain unchanged.

UI: one primary blue action,44px high and full width on mobile, with a short explanation naming the saved business. Copy stays a result utility. The original two constructor sections and their mounted state owners remain. This patch does not implement the separately proposed dedicated prompt-result view; stacked result/nested scrolling from UGC-UI-20261105-TALKING-HEAD-PROMPT-DENSITY remains OPEN.

## Actual localhost / model evidence

Signed-in HTTPS localhost, source talking-websites-explainer. Input: “Top 3 websites the government doesn't want you knowing about.” One Generate prompt click returned “3 content formats SaaS founders should know about.” The complete video prompt appeared automatically with that exact line once, the existing source scene directions and no source demo narration. Unsupported government-motive claim was removed; the source list/discovery structure and business audience were retained. This is one actual semantic spot check, not a promise about every future result.

Network702 POST /api/explore/talking-head-script returned200. Request5fc69f89-11fb-4bc2-a50e-9295dd5cc787 was read back from its owned saved receipt: model/providerModel gpt-6.1-terra; reasoningEffort medium; promptVersion2; businessProfileVersion3; businessNameUGCPilot; current source selection SHA758a9cbcc9aff27b50bc3fd3a3918b3fa844ed4e9e52c4e00571231131eb6d97. Sanitized evidence .tmp/local-https/one-action-live-receipt.json. This test created one owned text receipt on the existing hosted backend, not an isolated emulator. No image/video generation or settings mutation was requested.

Observed disabled Preparing personalized prompt state during the actual request, switched to Starting frame and back, and received the result without resubmitting. Original/full transcript disclosures remained separate. New AI words had reviewed=false while Copy was enabled. Copy displayed Prompt copied. Full reload/resume restored the personalized words, prompt and unreviewed-for-video state; only source GET occurred after reload, no second generation POST.

## Verification receipt

- Final scoped Node regression command: node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --experimental-test-module-mocks --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test --test-concurrency=2, covering lib/explore/talking-head*.test.*, workflow-session, real video-generation API, script section, starting-frame UI/photo carryover, actual parent Demo/audio, workflow-generation client/API contract and workflow-session UI.214/214PASS,0failures/skips; .tmp/local-https/one-action-final-regression-tests.log.
- Most recent focused component/prompt/API/source group36/36PASS, including authored-prompt edits during an in-flight regeneration; .tmp/local-https/one-action-final-focused-tests.log. This overlaps214 and is not added as a separate unique total.
- npx tsc --noEmit --incremental false PASS; empty .tmp/local-https/one-action-final-types.log. Final scoped ESLint PASS,0warnings/errors; empty .tmp/local-https/one-action-final-lint.log. Scoped git diff --check PASS (CRLF notices only).
- Positive, negative, loading and recovery tests cover one POST/synchronous double click; business requirement and profile version; original hook only; exact returned words; automatic prompt creation; missing/disabled context; invalid scene before spending; unknown response/reload/read-only GET; legacy request recovery; corrupted snapshot preservation; completed-save failure; source A-B-A/empty edits; newer script and newer prompt edits; persisted earlier-result acceptance; manual prompt edits/copy/reload and clipboard failure.
- Initial focused failures were old assertions expecting local-only generation/no POST; updated to assert one contextual POST and no extra call for Copy/reload. Initial lint treated helper usePrompt as a React Hook; renamed applyPrompt without suppressing rules. Final checks above are clean.
- No production/worker build, dependency install, deployment or push. Existing authorized Next development compilation/HMR used. Global no-production-build rule retained. Broader repository baseline failures documented in the earlier completion receipt were not presented as resolved by this scoped patch.

## Visual comparison

Inspected before/after pairs on the same saved Sawyer reference, same words/review state, same viewport/fonts and panel position:1440x1000 desktop,390x844 mobile. The two sequential outline actions became one blue action; source disclosures, script, review, old authored prompt and two-tab navigation stayed present. Mobile document width390at390viewport; primary target44pxhigh, approximately337pxwide. No pixel-perfect approved golden baseline or full accessibility certification is claimed. Copy is still in the scrollable result; the broader density recommendation remains separate.

Before: .tmp/local-https/one-action-before-desktop.png, one-action-before-mobile.png. Matched after: one-action-after-matched-desktop.png, one-action-after-matched-mobile.png. Actual combined live-result captures: one-action-after-desktop.png, one-action-after-mobile.png. These files were opened and inspected; they are not generated mockups. User-supplied screenshot remains defect evidence.

## Protected behaviors

| Contract | Result |
|---|---|
| One primary action uses business context before exporting | VERIFIED unit/API/browser/saved receipt |
| Terra medium/v2 and current owned business context | VERIFIED actual saved completion |
| Complete selected hook, source/identity/t=0 separation, no demo insertion | VERIFIED data/template/controlled admission; video output NOT TESTED |
| No automatic video or image generation | VERIFIED action code/network; ReAPI routes unchanged |
| Image preparation/polling and two mounted sections | VERIFIED existing controlled regression and live text request section switch; new live image job NOT TESTED |
| Pending/legacy/corrupt recovery, later words/manual prompt preservation | VERIFIED component and schema tests; normal real reload PASS |
| New speech still needs review before paid video | VERIFIED callbackfalse/client/API/parent regressions |
| Hook/Text on screen, photo carryover, Demo/audio, session guards | VERIFIED scoped controlled regressions; full live publishing NOT TESTED |
| Complete generated-video, provider face references, deployment readiness | NOT VERIFIED; previous provider/source/combined-release limits remain |

## Files changed by this incremental action revision

- [components/explore/talking-head-script-section.tsx](C:/Users/chund/OneDrive/Desktop/UGC/components/explore/talking-head-script-section.tsx)
- [lib/explore/talking-head-script-draft.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/talking-head-script-draft.ts)
- [lib/explore/talking-head-prompt.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/talking-head-prompt.ts)
- [lib/explore/talking-head-prompt.test.ts](C:/Users/chund/OneDrive/Desktop/UGC/lib/explore/talking-head-prompt.test.ts)
- [scripts/talking-head-script-section.test.mjs](C:/Users/chund/OneDrive/Desktop/UGC/scripts/talking-head-script-section.test.mjs)
- [docs/ai-context/nonnegotiables.md](C:/Users/chund/OneDrive/Desktop/UGC/docs/ai-context/nonnegotiables.md)
- [docs/ai-context/clear.md](C:/Users/chund/OneDrive/Desktop/UGC/docs/ai-context/clear.md)
- [EXPLORE_CONTEXT.md](C:/Users/chund/OneDrive/Desktop/UGC/EXPLORE_CONTEXT.md)
- [docs/talking-head-one-action-2026-11-05.md](C:/Users/chund/OneDrive/Desktop/UGC/docs/talking-head-one-action-2026-11-05.md)

Concurrent Carousel/automation work and preceding Talking Head changes remain intact. No unrelated paths staged, reverted or included as this task's implementation. Existing data and historical receipts retained. Full provider first-frame+raw-photo capability, generated lip-sync/identity and hosted acceptance remain outside this one-action text change.
