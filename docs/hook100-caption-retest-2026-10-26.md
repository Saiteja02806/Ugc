# Hook 100 caption correction and real video review — 26 October 2026

Caption removal PASSED this controlled retest. Full video recreation FAILED
acceptance. No other public/private reference changed and no deployment occurred.

## Requested change and implementation

The user authorized fixing the caption failure, testing Hook 100 again, and
generating/reviewing a video only after the image was correct. The pilot-only
image builder now names the exact three caption lines and their approximate
lower-middle region (63–80% of image height), requires deletion of every white
letter/black outline/shadow, and requires reconstruction of the photographic
scene underneath. It distinguishes physical-scene preservation from preserving
the added caption pixels. No blur, crop, covering box or substitute text is
allowed. The opening, clarity-anchor and identity roles remain unchanged.

New accepted requests freeze the updated prompt hash. Existing accepted trials
recover their saved prompt rather than recompiling new wording over old input.
The first failed trial remains intact; the new receipt is in `caption-v2/`.

## Real image test

- Same source, original t=0 frame, clarity frame 70, owned portrait and Gemini
  3 Pro 2K model as the first trial; one new create call.
- Image operation:
  `v1_ChYzZF9lYXNqSkZaekg2OTRQNVlHeUNREhYzZF9lYXNqSkZaekg2OTRQNVlHeUNR`.
- Generated PNG SHA-256:
  `be95224cc4acf20813719555c2f5e0e7bf95190b93a3b8d704b1d1c3541968c8`.
- Visual PASS for one video trial: no caption, outlined fragments, ghost words
  or replacement rectangle. Neck/sweater reconstructed. Original glasses-on,
  hand-at-temple, side gaze and parted-mouth pose retained, with recognizable
  selected portrait likeness and source window/beams/sweater/earbud setting.
- Raw output 1536×2752; the existing application normalization prepared the
  720×1280 animation input, hash
  `80a33eb5e385439e0180157ef7aa0cb72c36408ca152792297f8914821e96bc1`.
- Retained Google input was read back and confirms both source-frame hashes,
  selected portrait and complete revised cleanup prompt. One stochastic image
  success does not establish reliable cleanup across other sources.

## Real video test

- Model: `gemini-omni-1.1-flash`; four seconds; 720p portrait; one create call.
- Video operation:
  `v1_ChdyZURlYXJQa09ZSG42OTRQdGRQQjRRWRIXcmVEZWFyUGtPWUhuNjk0UHRkUEI0UVk`.
- Retained interaction verifies the exact normalized approved opening, the exact
  owned portrait, `<FIRST_FRAME>@Image1`, `<IMAGE_REF_0>@Image2`, and the complete
  application's motion prompt. Neither source evidence frame is a video input.
- Storage preparation initially received `storage.objects.create` 403; no
  object or video inference was created by that attempt. No IAM change was made.
  The successful diagnostic supplies the verified local images at the adapter's
  file-read boundary, which converts them to real inline SDK image blocks.
  Provider inference and retained-input checks are real. This isolated transport
  does not verify production upload permissions or deployed application jobs.
- Final video: exactly 4.000 seconds, 720×1280, 24 fps, 96 decoded pictures and
  no audio stream. Raw provider output contained audio despite the silent prompt;
  the existing application silencing helper removed it. All 96 decoded frame MD5
  hashes are identical between raw and silent outputs.

## All-frame visual review

All 96 frames were inspected across four native-frame contact sheets. Frames
16, 30, 89 and 90 were also inspected at extracted 640-pixel width. Exact frame
PTS are recorded for 96/96 frames. Source comparison uses the previously
inspected 112-frame source, not a poster or guessed middle-frame timeline.
Indices below are zero-based.

| Generated frames / time | Observation and source comparison |
|---|---|
| 0–11 / 0–0.458 s | Correct glasses-on opening and hand at temple; gaze screen-right. |
| 12–24 / 0.500–1.000 s | Glasses removed once and lowered. Opening action exists rather than starting from the later clarity pose. Contact geometry is approximate. |
| 25–32 / 1.042–1.333 s | Turns toward lens earlier than source, which reaches the frontal pose around 1.9 s. |
| 33–64 / 1.375–2.667 s | Central reaction becomes closed-mouth/smiling; source holds surprised parted-mouth expression. |
| 65–89 / 2.708–3.708 s | Returns screen-right with questioning open mouth, glasses down; source scene remains. |
| 90–95 / 3.750–3.958 s | CRITICAL: sudden cut to identity-photo bedroom, gray shirt and necklace; source window scene, black sweater and earbud disappear. |

No creator caption reappeared in any reviewed frame. Facial appearance is
broadly consistent through the window-scene section, but the final scene switch
and expression/timing differences fail full-recreation acceptance.

The cut is in the raw provider video, not local post-processing. The provider
received correct separate roles and the complete no-scene-cut/identity-only
instructions. Its internal cause remains UNKNOWN. A possible contributor is
that the source action plan ends at 3.733 seconds while requested output lasts
4 seconds; this requires a controlled test, not an asserted root cause.

## Receipts, usage and boundaries

This retest used one new image create and one video create, with no automatic
paid retry. Earlier first-trial image is separate and preserved. New image usage:
2524 input tokens, 1357 output tokens, 168 thought tokens, 4049 total. Video:
2809 input tokens, 23168 video output tokens, 455 thought tokens, 26432 total.
Provider responses did not return settled dollar cost; no currency estimate is
claimed. Application credits and database records were unchanged.

Artifacts under `outputs/hook100-full-recreation-trial-2026-10-26/caption-v2/`:

- Actual image/output, original t=0, clarity frame and portrait.
- `image-prompt.txt`, `video-prompt.txt`, frozen `trial-receipt.json`.
- `image-visual-review.json` and `video-frame-review.json`.
- `retained-image-summary.json`, `retained-video-summary.json` with hashes/roles.
- `generated-video-raw.mp4`, `generated-video-silent.mp4`.
- `video-frames/frame_manifest.json`, 96 decoded images and four contact sheets.

## Changed files and checks

- `lib/explore/hook-keyframe-image-prompt.ts`: targeted Hook 100 cleanup wording.
- `lib/explore/hook-full-recreation-pilot.test.ts`: exact cleanup contract checks.
- `scripts/run-hook100-full-recreation-trial.mjs`: separate retest receipt and
  frozen-prompt recovery.
- `scripts/run-hook100-video-trial.mjs`: image-review gate, one submission,
  operation recovery, exact local-input bytes, provider read-back and final review.
- `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`, existing pilot verification
  receipt and this report: current evidence/limits.
- Generated media and JSON artifacts remain ignored local diagnostic evidence.

Preflight sources/skills: AGENTS, Explore context, clear/nonnegotiable contracts,
mandatory context-memory/immutable-contracts, starting-frame, frame-analysis,
video-prompt and temporal modes, regression-gate; connected create-media
capabilities inspected for transport limits. Those limits require the direct
application-adapter diagnostic instead of the one-reference MCP generation tool.

Checks: 26 focused pilot/API tests PASS; scoped ESLint PASS; script syntax PASS;
application `npx tsc --noEmit` PASS; all-frame raw/silent identity PASS; real
retained image/video input hashes and role checks PASS. Full build and broad
Explore suite were not rerun for this small prompt change; the prior broad suite
has unresolved failures already documented in the pilot verification receipt.

Protected behavior: source/identity/timestamp roles and frozen recovery VERIFIED
locally and at provider input; full generated-video fidelity FAILED; no UI,
scheduling, migration, other-reference or deployment change was made. Production
storage, queue, authenticated UI and release acceptance remain NOT TESTED here.

Incident updates: UGC-VID-006 caption recurrence has one passing corrected-image
trial but is not globally fixed. UGC-VID-010 original t=0 action is present, but
overall recreation remains unqualified. New OPEN UGC-VID-011 records the
appearance-reference ending-scene cut.

## Next controlled motion correction

Keep this exact approved image for the next motion experiment. Explicitly hold
the source ending continuously through the entire requested four seconds,
preserve the surprised expression during frontal gaze, and evaluate the
optional identity reference's scene-leakage behavior. Review every final-tail
frame. Do not silently trim the failed tail, call the current clip faithful,
automatically submit another video, or expand to other references based on the
caption success alone.
