# Hook full-recreation plan: clear identity anchor and original opening

Date: 2026-10-25  
Status: product contract clarified; implementation and production verification pending

## Outcome

Recreate the complete reviewed action of a viral Hook from its original opening
through its ending, even when the source video's first frame is unsuitable for
facial identity generation.

The system must no longer use one image for two incompatible roles:

- `identity_clarity_anchor`: a reviewed face-clear source frame chosen from any
  suitable timestamp. It helps establish and verify the selected influencer's
  identity and later facial continuity.
- `animation_opening_frame`: a separately generated image of the selected
  influencer in the source video's actual opening pose, scene, camera and
  occlusion. This is the literal frame-zero input to image-to-video generation.

## Preflight context receipt

- Sources: `AGENTS.md`, `EXPLORE_CONTEXT.md`, `docs/ai-context/clear.md`,
  `docs/ai-context/nonnegotiables.md`, and the local starting-frame,
  frame-analysis, video-prompt, UI-clarity and immutable-contract skills.
- Related incidents: UGC-VID-001, UGC-VID-002, UGC-VID-004, UGC-VID-005,
  UGC-VID-006 and new UGC-VID-010; UI protections UGC-UI-001/002/003 remain.
- Preserved expectations: full source action, exact source provenance, separate
  scene and identity roles, editable reviewed instructions, compact single-entry
  UI, no scheduling or sibling-workflow changes.
- Unknowns requiring implementation-time verification: which deployed provider
  can keep identity stable through opening occlusion; whether reference-video
  conditioning is sufficiently faithful; actual cost, duration and recovery
  behavior; visual quality on a representative source corpus.

## Implementation essence

### 1. Analyse the complete source video

Extract timestamped frames across the entire clip, with dense coverage around
the opening action. Record camera, scene, cuts, body/hand movement, expression,
occlusion, timing, overlays and ending state. Select a clarity anchor based on
actual visibility and usefulness; never hardcode 1.5 seconds.

### 2. Persist two immutable frame roles

Store the source video ID/hash, original opening timestamp, clarity-anchor
timestamp/index/hash, selected influencer asset IDs and selection reason. Give
the generated opening its own asset/job/receipt. Recovery must reject stale or
cross-reference combinations.

### 3. Generate and review the identity anchor

Use the clear source frame for relevant source appearance/scene evidence and the
user's photos as identity authority. Review the result for recognizable identity,
face clarity, anatomy and scene leakage. A completed provider job is not a visual
pass.

### 4. Reconstruct the real opening frame

Generate source t=0 with the chosen influencer, preserving the original pose,
hands/objects, camera, clothing, lighting and environment. Use the approved
identity anchor and user photos only as identity guidance. Review occlusion,
contact shadows, visible facial regions and compatibility with the first motion.

### 5. Compile a full-source motion plan

Build the prompt from the frame-by-frame source analysis, beginning from the
actual reconstructed opening. Include timecoded actions from original source
t=0 through the ending, camera behavior, emotion, hand/object physics and locked
identity/scene properties. Exact on-video text remains an editor responsibility.

Bind the prompt version/hash to the source video, opening-frame receipt,
identity-anchor receipt, influencer IDs, duration and sound choice. The server
and worker must reject mismatched or stale combinations before billing.

### 6. Use a provider route that matches the contract

Preferred candidates, in validation order:

1. Original reconstructed opening as `FIRST_FRAME`, with separately labeled
   identity references retained through animation.
2. A proven source-video-motion route with separately labeled identity inputs.
3. Explicit multisegment generation and stitching when one request cannot cover
   the full source chronology.

Do not send the clear later anchor as literal frame zero while asking the model
to begin in an earlier pose. Do not silently fall back to a route that drops
identity references or original opening actions.

### 7. Keep the UI simple

The loaded Create state retains one starting-frame preview and one **Change**
action. Change opens the existing preparation/review flow. Internal labels may
explain “identity reference” and “video opening” inside that flow, but no second
permanent Choose Photos tile is added. Restoration reserves the established
preview size and failures offer retry/change without clearing accepted work.

## Acceptance gates

1. Clear-first-frame fixture uses source t=0 without unnecessary extra stages.
2. Occluded-opening fixture selects a later clear anchor but produces a distinct
   opening image matching original source t=0.
3. The provider receives that opening image as frame zero and keeps exact owned
   identity references; the later source timestamp is never relabeled t=0.
4. The generated clip includes the original opening gesture, reveal and ending
   in the reviewed order, with no reverse/loop artifact introduced to compensate
   for a contradictory input frame.
5. Identity, scene, hands, camera, duration and silence are reviewed separately;
   technical completion alone does not pass.
6. Reload, replacement, cancellation, stale responses and accepted-operation
   recovery preserve the correct paired receipts without duplicate billing.
7. Desktop/mobile UI shows one preview plus Change, stable restoration geometry
   and no duplicate permanent photo control.
8. Local automated checks, real provider visual trials and authenticated
   production acceptance are reported separately. No production claim is made
   until the deployed website and every relevant worker are verified.

## Explicit non-goals

- No fixed middle-frame timestamp.
- No promise of pixel-identical stochastic generation.
- No automatic paid retries.
- No changes to Schedule, Wall, Talking Head or Slideshow while implementing the
  Hook contract unless separately approved.
- No new always-visible photo-package or main/reference-photo controls.

## Pilot implementation status — 26 October 2026

Hook 100 is the only implemented pilot. It uses receipt v4 to bind stored source
frame 0, reviewed clarity frame 70, the original v3 browser preparation and the
ordered influencer photos. The opening-image request receives those roles in
that order, while the video provider receives only the approved generated
opening output as `FIRST_FRAME`. Its motion plan covers original t=0 through the
reviewed ending. Legacy receipts and all other Hook references remain unchanged.

Offline API, worker, provider-adapter, recovery, chronology and responsive UI
checks pass. Production storage preparation, paid still/video generation,
frame-by-frame generated-output review, deployment and authenticated production
acceptance remain intentionally unperformed. The pilot is technically ready for
an explicitly approved paid visual trial; it is not yet a visual-quality pass or
evidence for rolling the change across the remaining references.
