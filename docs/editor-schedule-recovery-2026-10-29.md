# Editor and scheduling recovery — 29 October 2026

Status: locally verified; hosted acceptance remains NOT VERIFIED. No deployment, generation, publication, dependencies, database migrations, worker changes or MCP build in this patch. Earlier intentional worktree changes are retained.

## Findings and local changes

1. **Draft read timeout:** the screenshot message is emitted when the 15-second client deadline expires. This includes token acquisition, HTTP and JSON parsing. It does not establish that the user's connection is at fault. A failed read now has a read-only retry in Schedule; its callback travels through Hook/Demo and Wall composition state. Old reads are canceled when the selected clip changes or the editor unmounts. Initial retry preserves local typing; deliberate reload of an already-loaded conflicted draft retains replacement semantics. The response includes safe Server-Timing durations for authentication, draft read, initial-content lookup and total time. These timings are local code until deployed; no production trace was captured.
2. **Repeated destination scheduling:** confirmation previously compared only the video signature. A confirmed Instagram receipt could make a new TikTok selection behave like the already-scheduled post. Confirmation now also compares platform/account pairs. One explicit click with a changed valid destination prepares a new request and archives the earlier confirmed receipt. Uncertain requests still recover their original frozen targets and request key. A selected Instagram platform with no Instagram account remains invalid and names Instagram, with instructions to choose an account or deselect the platform. Nothing is silently deselected.
3. **Faded editor:** the Hook controls fieldset was disabled throughout draft saving. Trim, text and preview adjustment now remain usable while the already-submitted snapshot saves. Duplicate save/continue remain guarded. Newer edits remain dirty, and Save & return does not navigate away if the user edited after submission. Source/audio-loading protections remain.
4. **Repeated loading:** the draft-load effect depended on a restore callback that inherited parent callback changes. Changing callbacks could restart reads on ordinary renders. A ref now carries the latest restore handler without restarting the selected clip's read. A regression test covers callback changes before and after completion.
5. **Additional browser-confirmed save blocker:** demo draft saving was gated by text-fit/export validation. Structurally valid unfinished drafts can now be saved, while the fit warning and composition/export validation remain active. The browser saves exact overflowing words and retains the warning. This is a recurrence of UGC-UI-048-CONTROLS, recorded under UGC-UI-063.

These mechanisms were verified independently. They do not prove which mechanism caused the exact user's hosted session, nor establish a production latency improvement.

## Starting-image labels: actual current original-opening contract

The source frame is additional to the user's selected influencer photos. Current prompt version 7 uses:

| Selected influencer photos | Ordered inputs |
|---|---|
| Two | IMAGE 1 ORIGINAL_OPENING_SCENE; IMAGE 2 INFLUENCER_IDENTITY; IMAGE 3 SUPPORTING_INFLUENCER_IDENTITY_1 |
| Five | IMAGE 1 ORIGINAL_OPENING_SCENE; IMAGE 2 INFLUENCER_IDENTITY; IMAGE 3–6 SUPPORTING_INFLUENCER_IDENTITY_1–4 |

Image 1 controls the original t=0 lighting, scene, outfit, pose, camera, hands, props and occlusion. Its captions, physical logos and readable text are removed. Image 2 supplies facial identity; remaining photos supply more views of the same identity. Portrait rooms, clothing, lighting and poses must not replace the source scene. These are instructions, not a guarantee of correct generated pixels.

The labels are returned by `worker/src/lib/hook-keyframe-generation-contract.ts:hookKeyframeProviderImageLabels`. Google requests bind labels to the ordered image parts in `worker/src/lib/gemini-image.ts`; other image routes obtain the same roles in `worker/src/jobs/generate-image.ts`. The exact two/five-photo output was asserted and written to `.tmp/starting-frame-label-examples.md`. The local Nano Banana routes cap influencer photos at four; the other configured starting-image routes cap them at five. Five photos cannot be assumed supported on every selected model.

Video generation is a separate step: the approved generated image is the literal first frame. Raw selected influencer photos are additional appearance references only on the supported Omni route. WAN and Seedance remain single-image routes. No model routing or prompts changed in this patch; historical receipts remain unchanged.

## Scope, files and rollback boundary

Application files:
- `components/explore/use-clip-draft-save.ts`: stable restore handler, cancelable reads and stable explicit reload callback.
- `components/explore/format-video-editor.tsx`: save-time control interactivity; expose failed-read retry in clip snapshot.
- `components/explore/format-demo-section.tsx`: composition read-retry forwarding and separate draft/export validation.
- `components/explore/format-workspace.tsx`: callback-aware clip/composition state equality.
- `components/explore/pending-schedule-panel.tsx`: destination-bound confirmation, retry action and account explanation.
- `lib/explore/clip-draft-client.ts`: parent cancellation and accurate timeout wording.
- `lib/explore/clip-draft-api.ts`: safe draft-read timing headers.
- `lib/explore/pending-schedule-client.ts`: optional retry callback type.
- `lib/explore/wall-pending-composition.ts`: retry forwarding.
- `lib/explore/workflow-scheduling-draft.ts`: name selected platforms lacking accounts.

Tests: `scripts/clip-draft-recovery.test.mjs`, `scripts/explore-format-common-editor.test.mjs`, `scripts/explore-pending-schedule-ui.test.mjs`, `lib/explore/clip-draft-api.test.mjs`, `scripts/explore-demo-loading.browser.cjs`. Documentation: this receipt, `EXPLORE_CONTEXT.md`, append-only `docs/ai-context/clear.md`.

Rollback only the hunks described here; preserve previous avatar, picker, model, duration and tab-isolation work. No changes to scheduling records/schema, publishing workers, credits, generation or provider mutation logic.

## Preflight

Ran `python tools/preflight.py --repo . --task ...`: prerequisites discoverable/readable. Reviewed supplied AGENTS.md, current git status/diffs, applicable Explore control/recovery and scheduling history, protected nonnegotiables and scheduling contract. The previously authorized relevant-section/history-evidence approach was used; this report does not claim a new full read of the entire historical Explore/incident ledger. Full skills read: context-memory, immutable-contracts, ui-clarity, regression-gate and scheduling. Read installed Next.js `use-client.md` before editing. Starting-frame contract/provider source inspected for the label audit; no image/video prompts were edited.

## Verification and limits

- **173/173 PASS:** combined component, draft recovery/API/PGlite persistence, demo and account-selection suite. Log `.tmp/editor-scheduling-regression.log`. Covers stale responses, cancellation during authentication, storage failure, conflict revision, lost-save replay, changed destinations, no mutation on read retry, same-request recovery and exact target binding.
- **6/6 PASS:** compiled existing worker starting-image contract suite. The initial direct source test invocation failed because worker TypeScript imports compiled `.js`; reran the existing compiled suite successfully. Exact v7 two/five-photo label assertions also PASS.
- **TypeScript PASS:** `npx tsc --noEmit`; scoped ESLint PASS. `git diff --check` PASS apart from Git line-ending notices.
- **Browser PASS:** `node scripts/explore-demo-loading.browser.cjs`, actual components, styles, draft hook/client and fixture HTTP receipts. Save/reopen exact edits, overflowing draft persistence with retained export warning, playback, Hook trim/text timing, shared Talking Head/Wall controls and mobile widths 320/360/390. Browser script now waits for the verified draft revision after reopening rather than assuming visible fields mean loading is complete. Screenshot review: `.tmp/explore-demo-loading-browser/hook-single-timing-1366.png` and `wall-footer-320.png`; fixture geometry is unchanged and is not a production golden baseline.
- **Browser PASS:** `node scripts/schedule-confirmation.browser.cjs`, one compact status/link at desktop/mobile. `.tmp/schedule-confirmation/confirmed-1280.png` and `confirmed-390.png`.
- Browser launches inside the sandbox failed; outside-sandbox local checks succeeded. No hosted writes were made.

Protected behavior status:

| Behavior | Result |
|---|---|
| Existing words, explicit blanks, styles, trims and Wall full duration | VERIFIED in local draft/component tests; no default/layout migration |
| Edits made while save is pending survive as dirty work | VERIFIED |
| Save & return snapshot check and duplicate-save guard | VERIFIED in component/session code and regression coverage |
| Read retry cannot submit a save/render/schedule | VERIFIED |
| Uncertain schedule retains original request/targets | VERIFIED |
| Account IDs/timezone/picker and publishing payload contracts | VERIFIED locally; presentation unchanged |
| Source/identity label ordering | VERIFIED contract/provider audit; generated pixels NOT TESTED |
| Real deployed scheduling persistence/worker publication | NOT TESTED in this patch |
| Exact production slowness/overlay cause | NOT VERIFIED; no correlated hosted trace |
| Fresh production build and authenticated full-site acceptance | NOT TESTED; no deployment requested |

Incidents UGC-SCH-016, UGC-UI-062 and UGC-UI-063 have local verification only. No claim that the production issue is resolved.
