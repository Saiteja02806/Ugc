# Hook / Wall of Text: face backend evaluation and photo chooser

Status: local implementation and research, 20 October 2026. No new paid inference,
external portrait upload, provider integration, merge or deployment. Facial
fidelity is **not yet solved**.

## What changed in the chooser

The rejected narrow popover made the selected photos, promotion controls, help
and library compete in one column. The image chooser now uses the existing
accessible Dialog component, with a separate selection column and image library.
Video and audio retain their existing popovers.

1. Open Choose image in Hook or Wall of Text.
2. Upload several photos at once or select from the library. The first becomes
   **Main photo**. Later selections become ordered **Supporting** views.
3. **Use as main** promotes a supporting photo and retains every other photo.
   Removing the main photo promotes the next remaining photo, as before.
4. **Done** closes the chooser. The form tile shows the main photo and supporting
   count. Reopening retains the selection within the current workflow session.

Person photos / Other images retains both identity and general reference use.
Photo guidance is expandable. Your images continues to include only classified
Explore reference uploads; no existing media is deleted. Input limits, upload
validation, owner scoping, cache behavior and provider request order are retained.
The dialog uses the existing dark gray/orange tokens and typography. Desktop
keeps selection and library side by side; narrow screens stack them and retain
the footer. Removing repeated text buttons and separating the two areas addresses
the hierarchy problem without introducing a new workflow page.

This UI is role assignment, not face training. The current generic generation
backends still receive the previously implemented role instructions. These
changes do not qualify those backends as exact face replacement.

## Backend decision

**First practical benchmark candidate: AKOOL Face Swap Plus V4.**
Its API takes an existing video and one replacement face image. Use the same
Plus engine for still screening and video testing. The higher-quality image-only
Pro endpoint cannot establish the quality of Plus video output.

The documented new-face field is `source_url`; the original footage is
`target_url`. This terminology reverses our product's “source video” wording and
must be mapped explicitly. Use single-face mode and disable enhancement. Its
multi-face mapping pairs different people, not multiple photos of one identity.
Supporting portraits remain comparison evidence; do not falsely claim they were
combined into its identity input. The `lossless` style name is not proof of
unchanged pixels.

**Second candidate: InsightFace Evi, with Dax as a comparison if accessible.**
InsightFace markets Evi for identity similarity and Dax for detail preservation.
Both require commercial API authorization. Public marketing does not establish
our exact video interface, useful multi-view support, quote or tested result.
No outreach was sent and no access agreement was accepted.

**Hold LivingSwap as research.** Its architecture addresses source realism,
identity keyframes and temporal stitching, but the official project still lists
code as coming soon. It is not a ready integration.

Higgsfield demonstrates a dedicated target-video + source-face workflow. The
public feature page does not disclose an exact reusable backend contract or
establish the quality of our own clip. Do not infer its underlying face engine
from its video-generation model menu or infrastructure partnerships.

## What actually protects the original footage

A dedicated swap is the appropriate candidate, but accepting a video is not a
preservation guarantee. The intended pipeline keeps decoded source frames and
their timestamps, tracks the face, and composites only within the necessary
face/contour region. Foreground hands and hair must remain in front. The mask
must allow the replacement person's jaw contour rather than retaining a rim of
the original actor's jaw.

Verify original pixels outside the declared edit mask before lossy export;
separately compare the encoded result for visible changes. If a hosted service
returns only a re-encoded whole clip, frame alignment and our own masks/compositor
are additional work. Reject changed actions, gaze, timing or background. Do not
promise this invariant from a hosted endpoint alone.

Caption removal is a separate masked operation: obscured background must be
reconstructed. It is not recoverable original image data. Sound Off must remove
the final audio stream. Source expressions and perspective naturally change
visible 2D proportions; acceptance concerns stable identity and shape through
those changes, not fixed measurements in every frame.

## Bounded next test, requiring separate approval

The unchanged user assets were rehashed and match the prior benchmark:

| Input | Role | SHA256 |
| --- | --- | --- |
| `cdd.mp4` | Original video, 95 frames, 30 fps, 720×1280, 3.166667 s | `ebd7d9a28d393319a8326d51cde1220d7768d3914498e00adf4efa6c8caf14ee` |
| Car portrait | User-selected main face | `3ebc2b187ed82919900659ad57b505f29a2c3d985fb3eb107163a7a54c74b195` |
| Bed portrait | Supporting appearance / unobstructed contour comparison | `c18f95cba987a246329f482eba2541689160c50f2592362aeaecd71f31e7938d` |
| Sofa portrait | Supporting appearance comparison | `0b50106e42c2bcc7eda1c21e631afbe450c250dcf5d51c024f30557562fe0a4f` |

1. Confirm evaluation access, the exact engine/version, video duration handling,
   billable minimum/rounding and USD charge. No account balance is assumed.
2. Quote one bounded option before requesting approval. Public AKOOL pricing
   lists 4 provider credits/image and 10 credits/10 seconds of face-swap video.
   Three stills would be 12 listed provider credits; six would be 24. A short
   video may be cheaper, but rounding, endpoint applicability and dollar value
   have not been established. These are **not UGC Pilot app credits**.
3. Prefer the cheaper useful screening option after that check: three sentinel
   stills (frames 0, 30 and 60) using Plus, or one unchanged 3.166667-second clip.
   Do not run both automatically. Do not pad the source or resubmit on timeout.
4. Keep the car main photo fixed. Disable enhancement/beautification. Do not
   generate synthetic side views or silently switch to the bed portrait.
5. Review all six benchmark positions (0, 15, 30, 45, 60, 75) when a video is
   available. Compare eye shape/spacing, brows, nose, lips, cheek/jaw contour,
   visible skin detail, expression, and the hand over the mouth.
6. If stills fail, stop. If stills pass, seek any further paid clip approval.
   A video must pass playback and all 95 frames, source timing, occlusions,
   boundaries, silence and outside-region preservation. Present comparisons to
   the user; no single recognition score substitutes for visual acceptance.
7. Only after acceptance consider a shared Hook/Wall replacement route.
   Image+prompt-only requests remain new generation. No silent fallback from
   unsupported replacement to whole-scene regeneration.

The prepared request example and asset references are in
`outputs/person-picker-redesign/face-benchmark-proposal.json`. It contains no
credentials, signed URLs or executable submission code.

## Validation

- TypeScript `npx tsc --noEmit --pretty false`: passed.
- ESLint on the two photo components: passed.
- Focused suites: **107/107 passed** across reference upload, reference image
  provenance and generation UI. Log: `outputs/person-picker-final-tests.log`.
- Hook local browser: batch upload of the three original portraits, role
  promotion, Other images round trip, guidance, Done/reopen and Escape.
  1280×720 and 390×844 inspected; phone dialog stayed inside viewport with no
  document horizontal overflow.
- Wall local browser: same three-photo batch and main promotion verified.
- This is an unauthenticated `preview=1` check with generation disabled.
  Authenticated production acceptance and a final production build are not part
  of this undeployed change.
- Earlier local LivePortrait samples failed gaze, lower-face and hand occlusion
  checks. Earlier Omni output failed identity/scene preservation. Neither is
  rehabilitated by this UI work. See the prior engine evaluation under
  `outputs/hook-wall-visual-test-2026-10-19/engine-evaluation/`.

## Primary documentation checked

- [AKOOL Face Swap Plus V4](https://docs.akool.com/ai-tools-suite/faceswap/faceswap-plus)
- [AKOOL API pricing](https://main.akool.com/api-pricing)
- [InsightFace commercial face swapping](https://www.insightface.ai/solutions/face-swapping)
- [LivingSwap official project](https://aim-uofa.github.io/LivingSwap/)
- [Higgsfield dedicated Face Swap](https://higgsfield.ai/apps/face-swap?type=video)
