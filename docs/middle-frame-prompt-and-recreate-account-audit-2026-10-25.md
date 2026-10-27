# Middle-frame prompt and Recreate-the-account audit — 25 October 2026

## Decision being audited

When a source video's first frame is unsuitable for identity transfer, a clearer
frame may be selected from any useful point in that video. That later frame is an
`identity_clarity_anchor`; it is not permission to remove the source video's
original opening action.

The required recreation contract has two distinct images:

1. `identity_clarity_anchor`: a reviewed source frame where the original face is
   sufficiently visible to guide identity and appearance.
2. `animation_opening_frame`: a generated image of the chosen influencer in the
   source video's real t=0 composition and pose, including an occluding hand,
   glasses or object when those are part of the viral opening.

The animation provider must receive `animation_opening_frame` as literal frame
zero. The motion prompt must describe the source action from original t=0 through
the reviewed ending. It must not begin after an action merely because the clear
identity frame was selected after that action.

## Audit result

**The current middle-frame path does not satisfy that contract.**

| Dataset | Active references | Frame zero | Nonzero clarity frame | Nonzero cases failing the clarified prompt contract |
|---|---:|---:|---:|---:|
| Public Hook gallery | 104 | 83 | 21 | 21 of 21 |
| Private Recreate-the-account gallery | 12 | 2 | 10 | 10 of 10 |
| Combined | 116 | 85 | 31 | **31 of 31** |

This is a static/data/frame audit. It does not mean all 85 frame-zero prompts
have passed visual recreation review. It means the specific later-frame-versus-
original-opening contradiction applies to the 31 nonzero cases.

## Evidence and review depth

- Public runtime authority: `worker/src/lib/hook-curated-frames.json`.
- Public active-set authority: the five published/active manifests merged and
  filtered by `worker/src/lib/explore-hook-reference-release.ts`.
- Private runtime authority: `worker/src/lib/creator-source-frames.json`.
- Private prompt authority: `lib/explore/creator-account-reviews.json` and
  `lib/explore/creator-accounts.ts`.
- All 31 locally available nonzero cases were decoded. The extraction contains
  **3,110 decoded frames** in total; every configured selected index is in range.
- Every native decoded-frame contact sheet was visually inspected: 118 of 118
  sheets covering all 3,110 decoded frames. The 0.25-second sheets were used as a
  coarse index; exact opening, transition and configured selected frames were
  compared on the native sheets.
- This report does **not** claim that every one of the 3,110 frames received a
  written semantic annotation. The complete visual-sheet review is sufficient to
  establish the opening/anchor chronology defect; a per-frame annotation corpus
  would be a separate deliverable.
- No paid generation was run. Generated-image fidelity and final-video fidelity
  therefore remain unverified.

Local extraction evidence is intentionally temporary and ignored:

- `.tmp/middle-frame-audit-20261025/`
- `.tmp/middle-frame-audit-20261025-native/`

## Why the current pipeline fails

The problem is not one badly worded sentence. The data and request plumbing bind
the wrong semantic role to the provider's first frame:

1. `lib/explore/hook-curated-motion.ts` says curated motion begins after the
   gesture already visible in the chosen later frame. It also forbids replaying
   a gesture that has already finished at the opening.
2. `lib/explore/hook-keyframe-image-prompt.ts` recreates the selected source
   image's scene, pose and visible gesture. The verified original opening
   description is included only when the selected frame index is zero.
3. `lib/explore/hook-keyframe-motion.ts` calls the approved generated image the
   complete opening composition.
4. `worker/src/lib/gemini-omni-video.ts` sends that image as the literal
   `FIRST_FRAME`.
5. `worker/src/jobs/generate-hook-video.ts` rejects mixing the source video/audio
   with this starting-frame route, so the omitted pre-anchor action cannot be
   recovered from the source clip.
6. `lib/explore/hook-keyframe-client.ts` and
   `lib/explore/hook-composer-selection.ts` persist one approved image and one
   editable motion string. They do not model separate clarity-anchor and opening-
   frame receipts.

The current behavior is internally consistent with its former rule—"continue
from the selected frame"—but that former rule is incompatible with the clarified
goal of recreating the complete viral action.

## Public Hook cases

Historical audit numbers are included only for traceability. Seven differ from
today's gallery title because the gallery changed later. Runtime identity must use
stable `referenceId` plus `sourceSha256`, never the Hook number alone.

| Historical audit | Current title | Selected frame / source time | Original opening that is lost or displaced by the current prompt |
|---:|---|---|---|
| 12 | Hook 12 | 36 / 1.200 s | Cup begins across the mouth/lower nose, then lowers to reveal the face. Current motion begins after the cup is lowered. |
| 14 | Hook 15 | 32 / 1.067 s | Eyes begin closed while the hands move from chest-level contact to raised/open palms. Current motion starts with eyes open and palms already raised. |
| 18 | Hook 19 | 44 / 1.467 s | Airplane window/composition opens before the camera reveals the woman. Current motion begins with her already visible. |
| 19 | Hook 20 | 60 / 2.000 s | Hand covers the mouth before both hands move toward the head. Current motion starts near the later hands-at-head pose. |
| 25 | Hook 26 | 73 / 2.433 s | Sunglasses begin on the face and are removed. Current motion starts after removal. |
| 29 | Hook 30 | 40 / 1.333 s | Hand covers the mouth and then lowers toward the chin. Current motion starts after the reveal. |
| 34 | Hook 35 | 78 / 2.600 s | Hand begins across the mouth/lower face before moving toward cheek/eye. Current motion starts at the later pose. |
| 38 | Hook 39 | 43 / 1.433 s | Glasses begin over the eyes and are lowered. Current motion starts with them already below the face. |
| 46 | Hook 46 | 62 / 2.067 s | Hand begins over the mouth and lowers. Current motion starts after lowering. |
| 47 | Hook 47 | 51 / 1.700 s | Glasses begin off the face near the mouth and are put onto the eyes by roughly 0.8 seconds. Current motion starts with glasses already on. |
| 50 | Hook 50 | 30 / 1.000 s | Person begins strongly side-facing and turns toward camera. Current motion starts camera-facing. |
| 52 | Hook 52 | 13 / 0.433 s | Eyes begin closed with hands at the temples before opening. Current motion starts after the eye-opening beat. |
| 64 | Hook 64 | 23 / 0.767 s | Opening and anchor are nearly the same open-mouth café pose with an arm extended. The later withdrawal remains; the strict loss is the initial hold/minor reframe, not a distinct face reveal. |
| 71 | Hook 71 | 45 / 1.500 s | Hand covers the mouth before lowering. Current motion starts after lowering. |
| 85 | Hook 85 | 180 / 6.000 s (absolute PTS 6.066 s) | Hand covers mouth/nose for most of the clip. The selected frame is near the ending, so the current route discards nearly the whole performance. |
| 93 | Hook 93 | 41 / 1.367 s (absolute PTS 1.433 s) | Fingertips begin resting at the lips, lower before the broad-smile anchor, and later move to the forehead. Current motion omits the fingertip-at-lips opening. |
| 94 | Hook 94 | 29 / 0.967 s (absolute PTS 1.033 s) | Glasses/reflection and a hand cover the eye area before removal. Current motion starts after removal. |
| 96 | Hook 96 | 43 / 1.433 s (absolute PTS 1.499 s) | Both hands cover the mouth before lowering and joining near the chest. Current motion starts at chest level. |
| 100 | Hook 100 | 70 / 2.333 s (absolute PTS 2.399 s) | Glasses and a hand begin at the face; the glasses are removed by about 0.9 seconds and the person turns from side-facing toward camera by about 2.0 seconds. Current motion starts after both beats. |
| 101 | Hook 101 | 28 / 0.933 s (absolute PTS 0.999 s) | Extreme upward angle precedes reframing to a visible face. Current motion starts after reframing. |
| 104 | Hook 104 | 37 / 1.233 s (absolute PTS 1.299 s) | Eyes are open at t=0, looking down toward the phone with reflected lenses and a neutral/pursed expression. Current motion starts already open-mouth shocked; it may replay the gaze but omits the original neutral-to-shock transition. |

The historical-to-current title differences are: 14→15, 18→19, 19→20,
25→26, 29→30, 34→35 and 38→39.

## Recreate-the-account cases

`lib/explore/creator-account-reviews.json` stores both `directions` for the
original opening and `selectedFrameDirections` for continuing from a later clear
frame. `lib/explore/creator-accounts.ts` exposes the latter as the default
`generationPrompt` whenever the configured selected frame matches. The workspace
then uses that prompt. Consequently, all ten private nonzero cases repeat the
same contract error.

| Reference | Selected frame / source time | Original opening that is lost or displaced by the current prompt |
|---|---|---|
| creator-account-1-01 | 51 / 1.700 s (absolute PTS 1.766 s) | Both arms sweep through the foreground with hair movement before the later hand-at-crown pose. |
| creator-account-1-02 | 44 / 1.467 s (absolute PTS 1.533 s) | Head begins tilted with a hand in the hair, then turns into a widened-eye/mouth reaction. Current prompt starts already shocked. |
| creator-account-1-03 | 55 / 1.833 s (absolute PTS 1.899 s) | Glasses begin on the face and are removed. Current prompt starts with them off. |
| creator-account-1-06 | 20 / 0.667 s (absolute PTS 0.733 s) | Pencil begins at the lips before moving toward the temple. Current prompt starts after it leaves the lips. |
| creator-account-2-01 | 68 / 2.267 s (absolute PTS 2.333 s) | Head is supported while holding a yellow object; the person straightens and sets it down before the later shock. Current prompt starts after that setup. |
| creator-account-2-02 | 61 / 2.033 s (absolute PTS 2.099 s) | Glasses begin at the eyes and are lifted onto the head. Current prompt starts with them already on the head. |
| creator-account-2-03 | 31 / 1.033 s (absolute PTS 1.099 s) | Hand begins covering the forehead/eyes before moving lower. Current prompt starts after the eye-covering beat. |
| creator-account-2-04 | 32 / 1.067 s (absolute PTS 1.133 s) | Opening and anchor are near-identical held upper-forehead poses, so the important later hand-to-mouth action remains. The strict loss is mainly initial hold/expression timing; the selected prompt also ends near the cheek instead of the source's later return toward the forehead. |
| creator-account-2-05 | 43 / 1.433 s (absolute PTS 1.499 s) | Person begins serious with a yellow object, transitions to shock, then covers the mouth. Current prompt starts after the expression transition. |
| creator-account-2-06 | 85 / 2.833 s (absolute PTS 2.899 s) | Hand covers the mouth for most of the opening and then lowers. Current prompt starts after the main reveal. |

`creator-account-1-04` and `creator-account-1-05` use frame zero and are not
affected by this specific chronology defect. They still need ordinary prompt and
visual-output qualification before being called faithful recreations.

## Data reconciliation and remaining source gap

The older public review file records 83 `keep_opening`, 21
`change_candidate`, three `needs_review`, and 20 approved changes plus one
unapproved proposal. Runtime later added Hook 100 as the twenty-first curated
replacement, kept the unapproved Hook 88 on frame zero, and removed the three
needs-review references 27, 84 and 89 from the visible set. Current runtime is
therefore 21 nonzero plus 83 frame-zero, not the older intermediate totals.

For the current public set, 103 of 104 source videos were locally available and
matched recorded hashes. Hook 99 (`explore-paired-hook-17133540b2315e0a3a05bfbd`)
was missing from its old local `D:` path, although its immutable remote storage
key remains in the release manifest. Hook 99 is a frame-zero case and does not
change the 31-case conclusion.

## Required implementation correction

1. Preserve the reviewed later timestamp as `identity_clarity_anchor` with
   source ID, SHA, frame index/time, reason and immutable stored asset receipt.
2. Preserve a separate source-t=0 description and exact frame evidence.
3. Generate `animation_opening_frame` from the t=0 composition while using the
   clear anchor and owned photos only for identity/appearance guidance.
4. Require explicit review of the generated opening for scene, pose, occlusion,
   face anatomy and identity. A technically completed image is not acceptance.
5. Compile a timestamped motion plan from original t=0 through the source ending.
   Never remove a completed opening gesture merely because the clarity anchor is
   later.
6. Persist both receipts and the source-timeline version through composer,
   API/job, recovery and history. Reject stale prompts after a source/anchor/
   identity change.
7. Send only the reviewed `animation_opening_frame` as provider `FIRST_FRAME`.
   If the selected provider cannot honor the role combination, block with a
   clear limitation instead of silently degrading.
8. Keep the Create UI compact: one preview and one **Change** action. The role
   separation belongs inside the review/change flow and provenance, not in a
   second permanent **Choose photos** tile.

## Acceptance tests required before calling it fixed

- Hand-over-mouth fixture: later clear face is stored as identity anchor;
  generated opening still has the hand-over-mouth composition; animation starts
  there and performs the lowering action.
- Glasses fixture: generated opening has glasses on; motion removes them once;
  prompt never starts with "remove glasses" when the delivered first frame
  already has them removed.
- Reveal/composition fixture: airplane-window or camera-reframe opening is
  retained before the face reveal.
- Near-ending anchor fixture (Hook 85): the late identity anchor does not shorten
  the six-second source performance.
- Prompt/provenance binding: changing source, selected anchor or identity photos
  invalidates the prior opening image and motion plan; refresh restores both
  current receipts and no stale text.
- Provider payload inspection: the literal first-frame asset hash equals the
  reviewed `animation_opening_frame`, never the later source clarity frame.
- UI regression: one preview, one **Change** action, no duplicate **Choose
  photos** tile, stable loading footprint and responsive scroll.
- Real output review: inspect generated frames and action timing. Mock requests,
  local tests and successful provider status alone cannot prove visual fidelity.

## Verification boundary

No production data, prompts, API contracts, provider request, user interface,
database schema, deployment or paid generation was changed by this audit. The
31 failures are code/data-confirmed prompt-contract findings. The proposed fix
still requires implementation plus local, provider-output and authenticated
production verification as separate acceptance layers.
