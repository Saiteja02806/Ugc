# Talking Head + Demo: subtitle preview/export analysis

## Conclusion

The reported two-line Serif black box is a browser preview defect. The corresponding saved production MP4 uses Instrument Serif, one-line phrases, a compact black box and word fades. The previous interactive overlay used Georgia, allowed two lines, used the generic lower position and drew an almost full-width rectangle. Other specialized styles also lost their defining behavior in that overlay.

The UI corrections are implemented locally. They have not been deployed. Production subtitle startup latency is still unresolved: the configured worker service has minimum instances zero, and the inspected requests used the one-shot Cloud Run launcher. Enabling the already implemented warm receiver and routing is a separate production change with ongoing instance cost.

## Evidence from the reported video

Read the existing owned result and its saved speech; no new cloud render or paid transcription was submitted.

- Finished asset: `56e5e751-98c5-4ce0-8bb6-0dee7498d152`.
- Finish request: `7ce77313-cfba-4b71-8bd4-476265662054`.
- Job: `a3dfc042-61a9-4bf0-82c6-426407fab240`.
- Source: `b86a9464-c50e-49e4-8b4f-9973cfaf5f82`, matching the user's 19.2-second footage.
- Verified metadata: English, Serif black box, Bottom, `serif-box-v2`, 75 words, 478 × 850.
- At 0.8 seconds, the downloaded production MP4 displays **Most mobile apps** on one line. Future words are grey, with each whole word fading to white. This directly differs from the supplied two-line screenshot.

![Actual saved production frame](../.tmp/subtitle-parity-20261014/production-0.8.png)

This establishes the behavior of that saved video. It does not prove that every historic output or older browser session used the same renderer.

## All eight styles

Rendered all eight styles offline using the exact downloaded source and saved real Scribe transcript. Every result retained 75 words and a 19.2-second timeline. The existing real example videos and their pixel/audio/placement tests also passed.

| Style | Expected export behavior | Previous interactive preview | Correction |
| --- | --- | --- | --- |
| Clean | Regular Arial, naturally grouped phrases, no box; up to two lines when needed | Closest match; generic positioning and browser font metrics | Retains natural grouping, with centered phrase geometry and proportional outline |
| Bold box | Bold phrases on a fitted translucent dark box | Drew a broad fixed rectangle rather than a phrase-sized background | Fits the background to the actual phrase lines and uses bold text |
| Active word | Only the word currently being spoken turns yellow; finished words return to white | Basic highlighting existed; generic typography/layout | Keeps the current-word behavior, phrase grouping and proportional outline |
| Editorial | Bundled editorial font, italic lead, large heavy keyword, supporting blocks, blue active word and small keyword entrance | Plain Arial phrase; no editorial composition or keyword behavior | Loads the same bundled font and uses the shared editorial keyword/block planner |
| Word pop | One bold word at a time, about 2.2 × base size, a 94% → 100% entrance, no word held through silence | One word existed, but only 1.35 × size and no entrance | Uses one timed word, the larger size with safe-width reduction and entrance scaling |
| Karaoke | Grey phrase; yellow fills across each word during its real interval and holds during short gaps | Changed whole-word colour immediately at the word start | Uses a progressive clipped fill for each word, with completed words remaining filled |
| Marker highlight | Purple rectangle behind only the active word; white phrase stays still | Yellow active-word text, without the marker rectangle | Draws the purple marker behind the current word without recolouring the phrase |
| Serif black box | Instrument Serif, one line, compact opaque rounded box, Bottom anchor at 75%, whole-word grey → white fade | Georgia, two-line wrapping, broad box, generic bottom anchor, immediate colour change | Loads Instrument Serif, shares the export's one-line grouping/anchor, fits the box and applies eased whole-word fades |

Two lines are valid for several phrase styles. Serif black box and Word pop specifically require one line/word. The SRT accompanying Word pop retains grouped phrases; the actual ASS/video displays individual words.

The new interactive layouts produced the same phrase counts as the offline exports for this real transcript: Clean/Bold box/Active word/Editorial 15, Karaoke/Marker highlight 14, Serif 19. Word pop displays 75 individually timed words. Shared grouping and planners prevent the earlier semantic differences; browser shaping and antialiasing can still differ from libass at individual pixels. The finished MP4 remains the final typography reference.

![Eight offline exports using the user's actual speech](../.tmp/subtitle-style-audit-tvAmLs/contact-sheet.png)

Only Serif was re-read from this production session. Clean has the earlier production acceptance recorded in `talking-head-subtitles-verification-2026-10-12.md`. The other styles were checked through local actual-FFmpeg output and browser previews, not eight newly submitted hosted jobs. New UI acceptance on the deployed production domain remains pending deployment.

## Button and review changes

- `Continue to edit` in the uploaded-video preview now fits its label and stays centered.
- Change/Edit controls sit in a wrapping action row and no longer stretch across each video card.
- Caption generation/review opens a centered dialog. The selected sequence plays beside timestamped transcript rows; mobile stacks the video and words in a scrolling body with a fixed header/footer.
- Generated words are no longer forced into a 224-pixel sidebar scroller. Valid corrections update the draft immediately and the preview follows them. Done, Escape and the close control retain corrections. Temporarily blank/invalid inputs return to the last valid word.
- Closing/reopening the dialog does not resubmit transcription. Reset corrections restores the provider words. Replacing source media hides stale captions.
- The preview uses the existing sequence/audio/framing logic, including both clips and their real combined clock. Opening review pauses background players.

![Centered caption review with the user's actual source and transcript](../.tmp/subtitle-parity-20261014/browser/actual-caption-review.png)

![All eight corrected interactive previews](../.tmp/subtitle-parity-20261014/browser/all-eight-previews.png)

## Measured latency

Production database timestamps, read on 14 October 2026:

| Request | Created → worker started | Worker started → completed | Total |
| --- | ---: | ---: | ---: |
| Caption review `078605ae-a3e3-42db-bb2e-c73e1295dbd6` | 118.62 s | 12.01 s | 130.63 s |
| Serif export `7ce77313-cfba-4b71-8bd4-476265662054` | 129.47 s | 68.55 s | 198.02 s |

The pre-start interval includes dispatch/queue/execution startup; these timestamps alone do not isolate every lower-level operation. Both records have Cloud Run launcher operation IDs. The earlier execution/stage audit independently localized the dominant delay to worker startup. Current `ugc-video-render-worker` configuration has `minScale: 0`, `maxScale: 1`, a 300-second service timeout and request-based CPU throttling. Merely improving browser polling cannot remove this wait.

The export also has meaningful style work: this local CPU audit took about 38.7 seconds for Serif and 57.1 seconds for Editorial, versus roughly 5.7–7.9 seconds for the lighter phrase styles. Those measurements include offline composition/encoding and actual libass font probes, but exclude cloud startup, download, new ASR, upload and database work. They are not production latency targets.

The caption-only path already avoids final subtitle burning/upload, and style/word edits reuse the saved original speech result. The UI now exposes progress/recovery clearly. The remaining dominant speed fix is the existing opt-in `enable_interactive_explore_finishing` warm-worker deployment, plus the app's `GCP_EXPLORE_FINISH_TASK_URL` route. Both are necessary. Its rollout/cost/rollback plan is documented in `talking-head-caption-speed-fix-2026-10-13.md`; no infrastructure or billing setting was changed in this task.

## Validation and reproducibility

- App TypeScript, worker compilation and scoped ESLint passed.
- Full `npm run subtitles:test`: **258 passed**, zero failures/skips. Includes actual rendered pixels, eight styles/three placements, original audio, caption/export cache reuse, ownership, cancellation, uncertainty, recovery and scheduling readiness.
- Actual-React browser fixture passes compact button widths, centered review, all eight previews, one-line Serif, responsive layout without overlap/overflow, cross-demo seeking, correction/export propagation and reopening/reload without another POST.
- The separate offline renderer audit uses real source media and cached words: `node scripts/subtitle-style-parity.audit.mjs`. It never calls a provider or uploads.
- Interactive real-video audit: `node scripts/subtitle-preview-parity.browser.cjs` passed all eight layouts with no page/layout errors and captured desktop/mobile review. Its local media/API boundaries are fixtures. Existing source/transcript evidence lives in `.tmp/subtitle-parity-20261014`; generated exports/contact sheet/report are in `.tmp/subtitle-style-audit-tvAmLs`.
- Private media/transcripts and signed download URLs are not added to public assets. Temporary signed-URL files were removed. Public font additions are copies of the existing OFL-licensed Serif/Editorial fonts and include their licenses.

After deployment, repeat Generate → review/correct → preview all styles/positions → export → inspect the saved MP4 on `https://www.getugcpilot.com`. Measure startup and processing separately after any warm-worker rollout before claiming the delay is solved.

## Follow-up: caption-button shaking and concise controls

Inspected the supplied 12.37-second screen recording, `Talking Head + Demo _ UGC Pilot - Comet 2026-10-14 00-14-56.mp4`. The repeated caption status reads briefly switched the action's `busy` flag. The label alternated between **Generate captions** and the wider **Generating captions…**, wrapping beside the heading and changing the card height. Extracted half-second frame samples show that repeated jump.

Background hydration, polling and focus/online recovery now read status quietly without changing the mutation busy state. Explicit manual refresh still indicates work, and pending/uncertain requests keep their dispatch guards. The caption button has a stable 164-pixel width and a steady **Generating…** label throughout the pending lifecycle. Ready transcripts retain **Review captions** during checks.

The launcher is reduced to **Captions** and its action. Removed explanatory paragraphs, duplicate queue messages and the idle correction notice. The centered editor retains an accessible screen-reader description, a concise generation status, errors, recovery/cancellation and correction controls.

Subtitle appearance's plus/minus mark now uses the orange brand accent and a visible background. The example retains its short style name and Play/Pause/Retry action; its explanatory paragraphs and idle playback notice are removed. A second orange minus button beside Play collapses appearance, pauses the example and restores keyboard focus to the summary. The summary minus also closes the section.

Follow-up validation: 66 focused tests passed, including a new regression proving automatic polling/focus reads leave the action busy flag steady. The actual-React browser fixture passed repeated pending-response checks with identical button geometry/label, orange summary/example marks, collapse from both controls, paused audio/focus restoration, absence of the removed paragraphs, and the existing caption review/export/reload flow. TypeScript, scoped lint and diff whitespace checks passed. These follow-up changes remain local.
