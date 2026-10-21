# Hook motion prompts for an approved starting image

## Updated adaptation review

All98 plans have now been authored separately and integrated into local
preparation auto-fill. Three agents verified canonical local source hashes and
decoded frame counts, inspected ordered source frames including opening/ending,
and expanded32 complex clips to every decoded frame in contact sheets. An
independent reviewer compared every rewritten plan with prior observations and
performed additional visual spot checks. This is source-motion review; no edited
starting image or generated video is qualified by it.

Final status:87 static reviews of a four-second action adaptation;11 decisions
required. All98 paid animation admissions remain blocked. The three source files
are `lib/explore/hook-keyframe-motion-plans-a/b/c.json`; the pure validator rejects
stale IDs/hashes, false frame evidence, unsupported review labels or a generated
visual-pass claim. Separate legacy catalog review flags were not promoted.

Additional decision cases beyond the initial risk inventory:

- Hook22 / `11f2baa840d10b65bc4c4dee`: the glasses hand leaves view then returns
  empty across the lips while the other hand holds the camera. Hidden glasses
  placement is not shown; remove the contradictory continuous-grip instruction.
- Hook39 / `99ff813ebc24c61f1c92828e`: removed sunglasses leave below view, then
  the same bare hand returns to the forehead. Decide prop continuity explicitly.
- Hook72 / `b7c86d6729a69666ddf46ed5`: long repeated finger/tongue/bottle action
  needs an explicit shorter-duration choice; no drinking action is present.

Together with Hooks15/19/28/51/57/64/83/84 these make11 decision cases. Hook08's
opening now continues already-interlaced fingers; Hook74's hand begins already
rising below the mouth. These corrections prevent repeating an action already
underway in frame0.

The local screen auto-fills explicit action text, keeps user motion edits
separate from image edits, restores suggestions on request, and reflects sound
OFF/ON in a complete prompt preview. All are nonbillable preparation operations.
Review sources and prompts together in
`outputs/hook-motion-rewrite-2026-10-21/index.html`; the page starts with the11
decisions. `scripts/build-hook-motion-review.mjs` rehashes all98 MP4s before
building it. The notes below record the initial pre-adaptation audit and remain
useful for understanding source risks, not the current adaptation count.

Local validation completed:216 prompt/draft/rendered-workspace/upload/regression
checks pass, plus the read-only review server check; targeted ESLint and the
final Next webpack build (including TypeScript) pass. The combined rewrite
evidence records4,276 inspected frame indices across9,751 decoded frames, with
32 videos reviewed in full decoded-frame contact sheets in this pass. This
does not imply every source frame was re-reviewed across all98 videos.

The read-only review page is available at `http://127.0.0.1:8188/` while its local
helper runs. `scripts/serve-hook-motion-review.mjs` listens only on loopback and
serves an exact file allowlist, supports video range requests and rejects writes,
unknown files and project/environment files. Its HTTP response was verified;
browser visual inspection remains pending because browser use is disabled in
Work settings. This is neither a public deployment nor production acceptance.

Status: static catalog and deterministic compiler implemented locally. No image
or video was generated, no provider was called, and no database or deployment
was changed for this work. The legacy video-reference prompt catalog is intact.

## What was checked

The source is the **active** `getHookReferenceGalleryItems()` release, including
its additions/new batch and exclusions, rather than the older nine-Hook paired
catalog. All 98 active IDs have a reviewed performance record and exact matching
canonical video SHA-256. Every source record declares `all_decoded_frames`.
This audit read all 98 performance descriptions; it did not decode or visually
re-review those source videos or qualify generated output.

All 98 performance descriptions depend on original/source performance or timing
and mention duration. Forty-two explicitly prioritize source gestures over the
image's still pose. These are useful observations, but inappropriate instructions
when the provider receives only an approved opening image. The legacy wrapper
also requests identity replacement and supplies the video as the performance
source. Neither that wrapper nor its text-removal command belongs in animation.
Creator overlays should already be removed during starting-image generation.
The motion stage prohibits added captions while preserving physical object text.

Durations range from 1.633984 to 8.633984 seconds: 80 sources are shorter than
four seconds, three are exactly four, and 15 are longer. A fixed four-second
animation therefore cannot truthfully promise unchanged source timing for 95
references. No timing improvement or facial-fidelity benefit follows from
stretching text to four seconds. Reviewed duration variants are required.

Two distinct active records are titled **Hook 46**. Hook 13 is absent from this
active release, so array positions differ from displayed titles. Source folders
also repeat across batches. Always bind drafts, prompts and approvals by
reference ID plus canonical SHA-256, never by title, array index or folder alone.

## Cases requiring individual decisions

The complete 98-record inventory, original observations and risk flags are in
`lib/explore/hook-keyframe-motion-catalog.json`. Important exceptions include:

| Current title / ID suffix | Observed issue | Required review |
| --- | --- | --- |
| Hook 19 / `e683292d4cd22b2a8b5a9cd8` | Opens on an airplane window, then pans to the performer and passengers. | There is no face to replace in the actual first image. With no portrait passed to animation, a later reveal cannot be anchored to that person's face. Explicitly select and approve a later performer frame, adapting the opening sequence, or leave this reference unavailable for this path. Never silently skip the reveal. Earlier user descriptions called the window example Hook 18; identify it by ID/hash before changing anything. |
| Hook 15 / `43cc1dae0a6cfcb03e0a9333` | 8.633984 seconds with two takes; recorded review locates the cut at frame 170, 5.667 seconds. | Decide whether to preserve two takes or deliberately adapt to one. A generic continuous four-second reaction contradicts the reviewed sequence. |
| Hook 51 / `d7a0b28cd22cc29d618a5a6d` | Forward arm stretch jumps to a different neck-stretch pose. | Preserve a deliberate transition or review a continuous adaptation; do not invent a timestamp from the prose. |
| Hook 28 / `917cba028b9bc9cfda3e9f9b` | A colleague enters and adjusts glasses behind the foreground performer. | Animation must not perform another identity replacement. A person absent from the opening image is an unseen-scene generation problem; preserving their original appearance is not established. |
| Hook 64 / `775bf4f0fc41f253d04663e2` | Camera retreats into a wider café/table view, revealing laptop and pen; old prose requests foreground identity replacement. | Remove identity-replacement commands and review newly revealed geometry/background people. |
| Hooks 83 / `607bfccda5e91e0d8731fa94`, 84 / `e5870158a2ad1494edc92741` | Extremely low angle shows only the upper face at the bottom edge. | Respect the intentional crop. Do not claim the full face was inspected or silently convert to a full portrait. |
| Hooks 02 / `7c53cba88343579e7e15c8b0`, 07 / `2a74d53ba481fd0f99b84179`, 47 / `892b0f65083c8cf03270a7c9` | Three different glasses actions: remove and hold, lift onto head, put onto nose. | Keep separate opening states, object trajectories and ending states. A shared glasses-reaction template reverses important actions. |
| Hooks 06 / `55cb1594a04550147e829d7f`, 12 / `03d314d5268b8c31ec390bf1`, 45 / `322af5b0d5778b474cfcfdf4` | Can/mug/tumbler contact with lips; Hook 12 includes a small liquid trickle. | Check hand/object contact and face occlusion. Preserve the small spill rather than inventing a spray. |
| Hook 57 / `743919c25a4f61942184a81b` | Drink can leaves view; the same now-empty hand returns to cover the face. | Review the off-screen prop transfer/placement instead of allowing the can to vanish in the hand. |
| Hook 75 / `7a81a25a6fb874013b14dbf1` | Turns from selfie to profile and back. | A single opening image does not prove identity/proportion stability through the unseen profile. Inspect intermediate frames in a later approved test. |

Hands covering the mouth, glasses, drinking, head turns and camera moves occur
throughout the catalog. Static risk flags help prioritize review; they are not a
complete machine vision diagnosis. Calm stretches (Hook 08 and Hook 48), quiet
skepticism and restrained smiles must not become generic wide-mouth surprise.

## Implemented contracts

`lib/explore/hook-keyframe-motion.ts` separates three concerns:

1. `getHookKeyframeMotionReviewDraft` exposes ID/hash-bound source observations,
   risks and, for six representative references, deliberately authored candidate
   action plans. Every draft explicitly returns `canSubmitPaidAnimation: false`.
   Candidates are not produced by replacing words in old prompts.
2. The catalog keeps all 98 entries at `needs_motion_review`. No generic fallback
   turns source observations into a provider prompt. Changed/missing hashes fail
   closed, as do unreviewed opening frames or durations.
3. `compileReviewedHookKeyframeMotionPrompt` accepts a trusted reviewed record
   with opening state, ordered action beats, camera direction, ending state,
   constraints, review provenance, reviewed frame index and reviewed durations.
   It emits deterministic self-contained image animation instructions. The
   approved image owns facial appearance/proportions and the whole opening scene.

The default admission function `getHookKeyframeMotionPrompt` reads only the
catalog. All 98 currently remain blocked. A server must never accept an asserted
`motionReview` from a request body as trusted approval. Image ownership,
user-approved starting-image identity, provider capabilities, costs and request
receipts remain separate admission requirements in the surrounding workflow.

The compiler owns duration and sound. Motion beats cannot import hidden video or
portrait references, another face-swap command, source timing, creator-overlay
cleanup, embedded output-duration instructions, or conflicting soundtrack rules.
Changing to a nonzero extracted frame requires a reviewed plan for that frame;
the full original action sequence must not restart from an already completed pose.
Opening/middle/ending phases encode order, not invented timestamps. The requested
duration is allowed only when that variant has been explicitly reviewed.

`visualQualification` is stored separately as `not_tested`, `passed` or `failed`.
Static prompt readiness does not prove identity preservation, natural fingers,
performance timing, camera reconstruction or production readiness. An accepted
starting image likewise cannot prove facial consistency in unseen intermediate
views. No source video or separate portrait is supplied by this compiler.

## Validation and next review

Run the new pure tests and the unchanged legacy tests with:

```powershell
node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test lib/explore/hook-keyframe-motion.test.ts lib/explore/reference-video-prompts.test.ts
```

Coverage includes all 98 exact source mappings; all unreviewed entries blocked;
unknown/hash-changed references; the duplicate Hook 46 labels; explicit risky
exceptions; the three opposed glasses actions; stale opening poses; unreviewed
durations; source-dependent and conflicting action text; sound OFF/ON; and a
statically reviewed fixture that stays visually `not_tested`.

Next, inspect an extracted source frame and the edited/approved starting image
alongside each proposed action plan. Record opening-pose and duration review
before promoting a catalog entry. Start with a restrained no-hand reference and
one ordinary mouth-cover reaction, then review glasses/contact/occlusion/camera
exceptions. Any paid image or video generation needs separate user approval.
After an approved test, inspect intermediate frames and compare facial shape,
features, proportions, hand contact, camera movement, timing and actual silence.
Do not describe this static implementation as a facial-fidelity solution or
deploy it as qualified output behavior without that review.
