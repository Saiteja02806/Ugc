# Seedance source edit: local implementation and proposed test

Status: local implementation; not deployed. After initially declining a paid
test, the user explicitly approved one four-second test on 21 October 2026.
Exactly one request was accepted as `task_01a15b20ef8b77bbaf8d7faf0606023e`.
The result has been collected and inspected. No production database records
were changed. Facial-fidelity acceptance did not pass.

Hook and Wall distinguish editing the supplied footage from creating another
clip inspired by it. The existing photo picker continues to order the main
face first and supporting views afterward. No new provider or database schema
is introduced. Photo-only and prompt-only generation remain available.

## Corrected request

For Seedance editing through ReAPI the adapter sends:

```json
{
  "model": "doubao-seedance-2.5-face",
  "omni_reference_task_type": "edit",
  "duration": -1,
  "size": "adaptive",
  "resolution": "720p",
  "generate_audio": false,
  "content_filter": false,
  "output_format": "mp4"
}
```

The compiled prompt names `@Video 1` as the footage to modify and `@Image 1`
as the intended face. `@Image 2` through `@Image 6` supply additional views of
that same person. It requests facial proportions and features, preserves the
source performance/clothing/scene/timing, and does not instruct a new scene.
The task declaration does not guarantee model compliance or facial fidelity.

Short edit sources and incompatible models stop before app credit reservation.
The worker checks independently. Previously accepted tasks retain their saved
provider contract and recover the same task ID without another paid POST.
Output timing is checked against the source. Sound OFF reaches the provider
and removes any returned audio without changing decoded video frames.

## Approved test assets

- Original: `C:/Users/chund/Downloads/csdss.mp4`, 720×1280, 30 fps,
  104 decoded frames, approximately 3.467 seconds.
- User approved padding a **separate test copy** by repeating its final frame.
  Copy: `outputs/seedance-edit-test-2026-10-21/test-source-four-seconds-silent.mp4`.
  Four seconds, 120 frames, no audio. Offline verification checks all 104
  original pictures exactly and the 16 appended final-frame copies.
- Main photo: `D:/influncer 1 library/Softly Lit Neutral Bedroom Portrait.png`.
- Supporting photos, in order: suffixes `04_35_16 PM-4`, `04_35_34 PM-1`,
  `04_35_38 PM-3`, `04_35_35 PM-2`, `04_35_15 PM-3`, all PNGs from the same folder.
- All six originals are copied unchanged and SHA-256 hashes recorded. Photos
  are mostly frontal/slight turns; several are visually similar. They do not
  provide a full set of opposite profiles or establish a geometry guarantee.
- The source contains a hand over the mouth in much of the clip. Review must
  include uncovered-mouth frames, eyes, hand occlusions and transitions, not
  only the final frozen frame. Remove the creator-added caption while retaining
  the scene and reaction sequence.

Preparation is offline and repeatable with
`node --experimental-transform-types scripts/prepare-seedance-face-edit-test.mjs`
after the worker build. Its proposed request uses reserved `.invalid` URL
placeholders. Actual upload URLs must replace those before submission; no
upload or database record has been created by preparation.

## Cost and approval boundary

The [live model price](https://reapi.ai/models/seedance-2-5) displays approximately
$0.161 per billable second for 720p with video input (checked 21 October 2026).
The [provider billing rules](https://test.reapi.ai/docs/seedance-2-5) bill source
plus output, subject to the video-input minimum, and reserve auto duration at
30 output seconds before settling to actual output.

For a four-second source and expected four-second result, eight billable seconds
give an estimated **$1.29** provider cost. Auto duration temporarily reserves
approximately **$8.05** (50 billable seconds at the displayed rounded rate).
The app's separate estimate would be 16 app credits at its default four credits
per second; a direct diagnostic provider call must not charge those app credits
or mutate the production database. No independent sound-OFF discount is assumed.

Ask for one paid test with the assets, 720p settings and reservation explained.
No automatic retry, alternative provider, second candidate or deployment.
Preserve the accepted provider ID before polling and keep the exact submitted
payload/usage receipt. If acceptance is uncertain, recover that task rather
than create another one.

## Visual acceptance after the paid test

Compare the generated face with the main photo and supporting views at multiple
uncovered and occluded frames. Check face shape, eye spacing, nose width/profile,
lip shape, jawline, skin detail and drift over time. Check source gestures,
expressions, head/gaze movement, hand placement, clothing, camera, room and
lighting; caption removal; source duration and final hold; and actual silence.
Report failures explicitly. A valid HTTP response, different file hash or removed
caption is not evidence that facial replacement succeeded.

No deployment until the resulting clip has been reviewed. Production database
changes remain deferred under the user's instruction.

## Local verification

- API/instruction tests: 32 passed.
- Rendered workflow submission tests: 79 passed.
- Provider/worker/recovery tests: 51 passed.
- Additional full worker edit test with mocked ReAPI and an actual MP4: passed;
  exactly one POST across initial delivery and recovery, four-second timeline,
  six ordered photos, native audio flag false, no delivered audio, and all
  returned decoded pictures/timestamps retained during silencing.
- Source workspace/audio/media regressions: 78 passed.
- Worker TypeScript build, web production webpack build, web TypeScript check
  and lint passed. The web build initially hit a local resource failure and
  then ENOSPC; only this project's generated `.next/cache` (about 2.64 GB) was
  removed, and sequential rebuild/type checking passed.
- Visual browser inspection is blocked because local browser use is disabled
  in Work settings. Rendered tests are not a live browser or production pass.
- Paid provider acceptance was subsequently verified for the exact edit
  contract and six ordered images. Generated facial accuracy remains pending
  inspection of this accepted task; never submit another task automatically.

## Accepted diagnostic receipt

- Isolated runner: `scripts/run-approved-seedance-face-edit-test.mjs`.
- Local receipt: `outputs/seedance-edit-test-2026-10-21/paid-test-receipt.json`.
- Source and six PNG uploads verified byte-for-byte through their provider-
  readable URLs before submission. No portrait resizing or replacement.
- One paid POST to ReAPI, task ID saved before the first poll. Exact request
  contains `edit`, automatic duration, adaptive shape, 720p, sound OFF and
  `content_filter: false`. All `@Image 1` through `@Image 6` and `@Video 1`
  are present in the actual submitted prompt.
- No application job, customer credit reservation, database/schema change,
  deployment, alternate provider or second candidate. Existing configured
  GCP storage and ReAPI secret are used; credentials are never saved in the
  diagnostic receipt or logs.
- Recovery uses `--recover-existing` and the saved task ID. A prior uncertain
  submission with no accepted ID refuses any additional POST.

## Completed test: observed result

- Provider task: `task_01a15b20ef8b77bbaf8d7faf0606023e`, status completed,
  model confirmed by task GET as `doubao-seedance-2.5-face`.
- Exactly one paid POST. Provider usage: **1,281 credits = US$1.281**;
  this is the settled charge, not the temporary US$8.05 reservation estimate.
- Actual collected output: 720×1280, 24 fps, 89 frames, **3.709 seconds**.
  The source was independently verified as four seconds. The difference is
  0.291 seconds, which fails the existing 0.25-second edit timeline guard.
  The provider's returned duration has not been concealed by extending the
  generated output. A production worker would reject this timeline under its
  current guard; retain the provider result and receipt for review rather than
  launch another paid task or describe a transport failure.
- Native provider output already contains no audio. The app's silence step
  also passes, with every decoded picture and timestamp retained exactly.
- All **89 decoded output frames** were inspected in four contact sheets.
  The source room, clothing, hair, framing and hand-over-mouth / surprised
  reaction sequence are broadly retained; creator-added caption is removed.
  Performance timing and facial expressions are not locked exactly.
- **Facial fidelity does not pass visual acceptance.** The output face does
  not convincingly preserve the reference photos' facial proportions. This is
  a qualitative assessment under different expressions, warm scene lighting
  and a relatively small face region. It is not a biometric identity score,
  precise landmark measurement or proof that every Seedance edit will fail.
- Local generated result (not the prepared source):
  `outputs/seedance-edit-test-2026-10-21/seedance-generated-silent.mp4`.
  Raw provider result: `seedance-generated-raw.mp4` in the same directory.
  Evidence: `output-technical-audit.json`,
  `source-generated-timing-comparison.jpg`,
  `reference-generated-face-detail.png`, and the four
  `generated-frames-*.jpg` pages.
- No second generation, alternative provider, production deployment, application
  job, customer app-credit charge or database modification was performed.
  Input-flow correctness is now tested against an accepted live request; visual
  fidelity and source-timing preservation remain unresolved for this example.
