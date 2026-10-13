# Explore action audit — 13 October 2026

## Scope

Three agents audited Hook/Wall of text, Slideshows, and Talking Head/shared media
actions. This is a local implementation and verification record, not a production
deployment receipt. Existing unrelated worktree changes were preserved.

## Confirmed fixes

| Action | Failure | Corrected behavior |
| --- | --- | --- |
| Recreate a Hook or Wall gallery video | Upload/Creative Assets mode remained selected. An earlier uploaded reference could override the clicked gallery clip. | Enter Create → Generate with the clicked registered video ID. Submit real video guidance through the existing server resolver and source-video edit provider path. |
| Recreate the same video again | A previous upload could survive a repeated card selection. | Each explicit selection has a revision; a new Recreate replaces earlier uploaded video guidance, including the same card. Appearance images remain attached. |
| Recreate after changing models | WAN quality/duration settings could remain unsupported by Omni. | Select the compatible video model, preserve supported quality, and normalize unsupported quality/duration. Pending reference uploads cannot change models. |
| Remove a gallery video | Local preview could display an old uploaded thumbnail despite no active video input. | Display only the current explicit video selection; removed guidance cannot reappear through local preview fallback. |
| Replace an optional reference | Failed replacement retained an older preview, allowing generation with the wrong reference. | Retain the preview but block submission until successful replacement, removal, or explicit cancellation of the failed format-reference change. |
| Choose saved reference audio | Generate could use earlier audio while the new recording was still downloading or after download failure. | Track download and validation pending/error in the parent attachment. Stale downloads cannot overwrite a newer selection or removal. |
| Replace a saved slideshow image | Schedule could use the previous saved sequence during replacement upload. | Invalidate the scheduling output as valid upload starts; reject stale schedule clicks. Failed uploads keep editable images but require explicit re-save before scheduling. |
| Open Schedule during slideshow work | Direct tab navigation bypassed editor upload/save locks. | Both the Schedule tab and scheduling review receive the slideshow pending state. |
| Generate / recover / load connected accounts | Native browser `fetch` received a dependency object as its receiver and could throw before a request. | Call the injected fetch function without an object receiver; preserve request body, owner token and recovery identity. |

## Reference presentation and multiple images

Selected image/video/audio tiles keep their original dimensions. A single image
fills the tile, and the overlay plus adds images into an ordered grid inside it.
Individual removal keeps the remaining images. Talking Head uses an ordered local
image collection that uploads on Generate; Hook/Wall use the existing owned upload
records, and the standalone video reference uploader uses the same full-container
presentation. Existing slideshow image selection already keeps its full preview.

Every selected image is submitted. Kling retains its two-reference limit; other
models retain six total references. Hook/Wall video edits now admit up to five
appearance images plus the source video, replacing the previous one-image UI/API
restriction. The existing provider receives every image part and the actual video
bytes, and token-counts all of them. Limits never silently discard attachments.

Generation payload checks retain a video's media role: the gallery poster is not
included in `referenceImageUrls`. The server resolves catalogue IDs within the
requested workflow, verifies MP4 duration, and the worker forwards actual video
bytes. Existing ten-second/32 MB source limits and owner checks remain enforced;
unsupported media cannot fall back silently to image-only generation.

## Verification

- Final video-reference API, UI, worker and provider suite: 123 tests passed.
- New real-workspace Recreate interaction checks: 22 tests passed.
- Broader Explore suite: 905 checks, 904 passed. The sole failure is the
  catalogue-staging temporary-file rename denied by the Windows sandbox.
  Its isolated suite passes all ten tests outside the sandbox.
- Native generation-fetch, audio races, connected accounts and client checks:
  68 tests passed in a separate focused run.
- Final focused action, image-collection, audio, scheduling and transport rerun:
  206 tests passed after the last edits.
- Six real Next.js browser scenarios passed: Talking Head, Hook and Wall at
  1342px and 390px, checking unchanged tile size, image fill, plus append and
  containment. Screenshots are in `outputs/reference-tiles/`.
- The isolated real slideshow browser test passed its editing/recovery,
  attachment selection, generated-result replacement and actual captured
  generation-request checks, including the native-fetch correction.
- Worker TypeScript build, application TypeScript check and scoped ESLint passed
  (zero ESLint errors; two existing unused-variable warnings).
- The catalogue-staging test fails a temporary-file rename under the Windows
  sandbox (`EPERM`) and passes all ten tests outside that sandbox.
- Production Hook access redirects to sign-in in the available browser. No
  authenticated production generation or publishing was performed. No paid
  providers were called by the fixture checks.

Dormant legacy Phone/Recreate components were inspected but are not claimed as
active production acceptance. Deployment and authenticated production checks
remain separate from these local fixes.
