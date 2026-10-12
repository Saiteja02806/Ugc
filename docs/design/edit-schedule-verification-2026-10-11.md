# Local Edit and Schedule verification — 11 October 2026

The tested editing and scheduling paths pass locally. This is local acceptance only: the user requested local checks after the production domain required sign-in. No production account, media library or publishing destination was changed.

## Browser checks

| Surface | Verified behavior | Boundary |
| --- | --- | --- |
| Hook clip editor | Two independently timed text blocks; text preset and placement; trim; original volume; draft retained when returning to previews | Actual local FormatWorkspace; saving deliberately disabled in preview mode |
| Hook demo editor | Trim 0.5–3.5 seconds; custom text 0–3 seconds; crop/pan adjustment and retained framing; Apply demo edits and reopen | Actual local FormatWorkspace; full clip shown, with crop reviewed separately and applied during export |
| Demo playback | Loaded media with a 7.566667-second duration; playback started at the trim start; stopped and reset to 0.5 seconds after the selected segment | One previously open tab had a stalled preview. A fresh page loaded and played correctly, retaining the edits. The stall was not reproduced after reload |
| Hook Schedule | Caption, date, time and selected platforms retained across Edit/Schedule navigation; unavailable saving correctly disabled | Actual local preview, without authenticated persistence |
| Talking Head + Demo | Shared editor saved talking-head text/trim and demo text/trim independently; final preparation used both edited clips, selected subtitles, music and demo audio | Actual components/controllers against isolated mock authentication, media and HTTP finishing jobs |
| Schedule review | Caption preview; Instagram and YouTube account selection; date, time picker and timezone; correct final asset and destination settings in submission; past dates blocked | Actual ScheduleEditor with mock accounts and a capture-only save callback |
| Final confirmation | No schedule request before confirmation; exactly one mock schedule request after confirmation, for the newly finished combined asset | Isolated HTTP fixture; no social-network publishing |
| Changes after finishing | Changing clip text invalidated the saved final preview and prevented preparing the old draft | Actual Talking Head editing and finishing controller in the isolated fixture |

## Request evidence

The isolated Talking Head sequence recorded three finishing requests:

1. Talking head: source `...000001`, trim 1–4 seconds, text “Talking-head verification” for 0–3 seconds.
2. Demo: source `...000002`, trim 0.5–2.5 seconds, text “Demo verification” for 0–2 seconds.
3. Combined video: edited talking head `...000010` and edited demo `...000011`, English clean subtitles at the bottom, repeated music and demo audio, and the selected demo framing.

Confirmation submitted asset `...000012`, with caption “Shared editor result”, Instagram destination and `2026-12-01T05:00:00Z` for 10:30 in Asia/Calcutta. There were three render requests, one schedule request and zero overlapping renders.

The separate ScheduleEditor submission captured the final asset, caption and both Instagram/YouTube accounts with their platform settings. It converted 1 December 2026, 10:30 Asia/Calcutta to `2026-12-01T05:00:00.000Z`.

Mock job completion verifies wiring and asset identity; it does not generate modified video bytes. Real video exports were checked separately below.

## Automated checks

171 distinct targeted tests passed:

| Test area | Passing tests |
| --- | ---: |
| Scheduling platform settings, preferences, action policy, target requirement and time validation | 35 |
| Explore duration, shared editor, schedule draft and demo audio state | 26 |
| Finishing API, store and UI controller | 52 |
| Finishing jobs and storage | 36 |
| Real clip export and video composition | 22 |
| **Total** | **171** |

The export checks use FFmpeg and cover trim, audio, timed text, multiple text blocks, emoji, framing/composition and preservation of the source file. The worker TypeScript build and targeted lint passed. The changed fixture scripts passed `git diff --check`.

The verification work repaired the controller test harness to load the actual reference-audio helper, added an interactive serve mode to the existing isolated editing fixture, and exposed the scheduler fixture submission through the DOM for read-only inspection. It did not change product functionality.

## Saved evidence

- [Loaded demo editor](../../output/edit-schedule-verification-2026-10-11/demo-editor.jpg)
- [Schedule review](../../output/edit-schedule-verification-2026-10-11/schedule-review.jpg)
- [Talking Head mock HTTP requests](../../output/edit-schedule-verification-2026-10-11/talking-head-receipts.json)
- [ScheduleEditor captured submission](../../output/edit-schedule-verification-2026-10-11/schedule-review-submission.json)

Authenticated production saving, hosted render execution, durable production scheduling and delivery to real social accounts remain unverified in this local-only check.
