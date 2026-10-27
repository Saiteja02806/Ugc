# Normal opening-frame prompt quality audit — 26 October 2026

## Verdict

The normal route is conceptually correct: original t=0 is the scene/opening input and influencer photos provide identity. It does not need the later-clarity reconstruction used by the31 middle-frame cases. Its prompts are **not fully qualified for source-faithful pacing**. Action order is often useful, but numeric timings and measured holds are missing; specific source samples also reveal expression/ending details that should be tightened.

This audit checks83 public frame-zero references and two private frame-zero references. All85 current source identities match their review records and all compile at3,4,8,10 seconds. Those compiler checks prove valid prompt assembly, not that all85 videos were visually re-reviewed or will generate faithfully.

78 public records have historical `static_reviewed` status; five retain `needs_decision`. These are historical review labels, not78 successful generated videos. **None of the85 motion prompts has a numeric action timeline.** They describe opening/middle/ending in sequence while final assembly supplies only the total duration. The model must choose each event time.

## Review depth

- Structural audit: all85 current source-bound prompt paths, actual compiler output at four durations, explicit-edit preservation, opening/ending/camera fields and decision gates. Public still-prompt roles stay Image1=opening scene, Image2+=identity; they do not accidentally inherit the middle-frame image order.
- Fresh source review:11 cases,1,148 native decoded frames across46 contact sheets, plus full-resolution opening checks for Hook01, Hook02 and private account1/reference05. All11 source files were SHA-256 checked. The11 comprise representative straightforward cases, all five previously flagged cases, Hook99 and both private frame-zero references.
- This does not claim fresh visual review of every frame of all85 sources. The remaining74 sources have structural/historical-evidence review only.
- Approximate event times below are visual phase boundaries from native sheets; exact packet-level transitions have not all been measured. Existing extraction warnings and source PTS differences remain disclosed.
- No starting image or video was generated. Output identity, anatomy, emotion and caption cleanup remain NOT TESTED.

## What the current prompts get right

The reviewed samples generally retain the correct opening scene, hand/prop state, broad action order and final composition. Hook02 correctly removes glasses forward and holds them rather than placing them on the head. Hook57 correctly avoids inventing a sip. Hook83 correctly preserves the extreme low crop. Existing decision flags are retained. Saved explicit motion edits remain selected instead of being replaced by these audits.

## Source-specific findings

| Video | Assessment | Required refinement |
|---|---|---|
| Hook 01 | Action order broadly matches; timing precision incomplete. | Untimed opening/middle/ending may shorten the long initial hold and advance the cover gesture. Preserve late camera movement and final crop. |
| Hook 02 | Action order broadly matches; timing precision incomplete. | Prompt lacks the measured neutral/reaction holds and glasses-removal boundary. The lower-and-hold ending is correct; do not put glasses onto head. |
| Hook 03 | Broadly faithful order; repeated gaze pattern under-timed. | Full-resolution final-frame inspection confirms sideways gaze, consistent with the current ending. Held-gaze timestamps still need measurement; an ending-direction defect is not established. |
| Hook 22 | Existing continuity decision remains valid. | Do not invent visible glasses disappearance. Preserve offscreen lowering and retain uncertainty about hidden placement. Timing needs explicit measured phases. |
| Hook 51 | Intentional cut confirmed; retain decision gate. | Cannot promise a continuous single-shot copy while preserving this source cut. Keep cut or choose a deliberate adaptation; do not silently convert take structure. |
| Hook 57 | Prop continuity decision remains valid. | Avoid invented drinking, instant can disappearance or handoff. Offscreen placement remains visually unobserved. |
| Hook 72 | Full-duration repetitive action needs a duration decision. | Three generic phases compress repeated movements. Retain complete6.37s sequence or explicitly remap; a shorter output must not accidentally discard final camera tilt. |
| Hook 83 | Partial-face composition decision remains valid. | Prompt correctly retains crop. Identity transfer quality cannot be assumed from this constrained view; do not invent centered full-face framing. |
| Hook 99 | Broad action order matches; holds and blink under-timed. | Current plan lacks the long mouth-covered hold and final blink/release timing. Source is now locally available and hash verified, superseding the earlier missing-local-source note. |
| creator-account-1-04 | Current generic ending underdescribes visible transition. | Explicitly describe sideward-to-lens gaze and open-to-pursed lip change. Do not substitute a generic questioning expression or infer a required late blink. |
| creator-account-1-05 | Current generic ending underdescribes visible transition. | Single small tilt/blink misses the visible lip/brow sequence. Needs timed expression phases; preserve hand contact and same scene. |

## Existing five decision gates

- **Hook22:** glasses leave below the view, then the empty hand returns to cover the mouth. Do not invent a visible disappearance or handoff; retain the offscreen action boundary and uncertainty.
- **Hook51:** an intentional cut around1.17s switches a forward stretch to a hand-at-crown pose. Choose preserving that cut or an explicitly accepted continuous adaptation.
- **Hook57:** the can exits below frame before the empty hand returns. Its placement is unobserved; do not add drinking or visible prop disappearance.
- **Hook72:** repeated tongue/finger/bottle actions across6.37s need a full-duration or explicitly remapped plan; final upward camera tilt must remain.
- **Hook83:** the face stays at the bottom of an extreme upward shot. Identity inspection is constrained; preserve the original crop or choose another opening deliberately.

These are not permission to unblock the references automatically. A successful prompt compile is separate from source/identity/continuity acceptance.

## Recommended refinement

Use the ordinary opening-frame skill: retain the approved original-opening image, write source-measured contiguous actions/holds, describe gaze/brows/lips/hand contact observably, and map the full timeline to the selected output duration. Give the ending its own explicit interval. Keep evidence/hashes separate from compact provider prose. No need to add an identity-clarity image for a sufficiently clear ordinary opening.

Three concrete source-reviewed examples are saved in [normal-opening-prompt-examples-2026-10-26.md](normal-opening-prompt-examples-2026-10-26.md). They are **draft examples, not runtime replacements**. The current request was to check normal quality, so no normal application prompt, saved edit, review gate or image mapping was changed.

## Completed preparation

The private ten-entry middle-frame prompt package is encrypted with the existing project key, verified against the existing package and read successfully through the real production private-package reader. No key was stored or rotated. New release asset: `lib/explore/creator-middle-frame-prompts.json.enc` (37,370bytes).

Public original-t0 storage:104/104 ready and readback-verified. Created21 missing frame/index pairs and verified83 existing ones; all are exact frame0/time0 and match locally extracted SHA-256 pixel identities. Existing objects were not overwritten. No private media was uploaded publicly.

The site/worker code was not deployed by this preparation. Stored source frames retain original source overlays as evidence; generated influencer images must remove those overlays through their image prompts. Stored input availability does not prove generated-caption cleanup.

## Files and verification

New operational scripts: `scripts/prepare-reviewed-hook-t0-frames.mjs`, `scripts/audit-normal-hook-opening-prompts.mjs`, `scripts/normal-opening-preparation-evidence.test.mjs`. New source audit/example/evidence documents under `docs/prompt-reviews/`; this report and the encrypted private prompt package. Existing `.tmp/` operational scripts/receipts contain no saved access token or private-package key.

Tests: source-frame store + all31 assignment group9/9 PASS; preparation-negative/evidence/audit checks3/3 PASS; syntax checks and scoped ESLint PASS. Re-running local frame verification confirms104/104 with no source-video decode. Existing store tests verify fresh-reader recovery, missing/corrupt data, create-only publication order, failed uploads, concurrency and private-source rejection. No runtime application source changed in this phase, so a fresh application build/browser run is not claimed.

The Vercel account was reauthenticated at the user’s request. Broad environment download was rejected by automatic approval review; preparation instead retrieved only the existing package key by verified variable ID and non-secret bucket config. The production GCS key was sensitive and non-exportable, so it was not extracted. Storage preparation used the already active Cloud CLI identity after verifying an auth-library mismatch was corrected; no IAM or service-account settings changed.

Protected contracts: source/identity roles, frozen jobs, user edits, application UI/scheduling and model/billing settings remain unchanged. UGC-VID-010/011/012 remain open for generated-output acceptance. New audit finding UGC-VID-013 records normal prompt timing/expression gaps; it is OPEN until separately revised and visually tested.

Machine-readable structural audit: `normal-opening-prompt-audit-2026-10-26.json`. Visual notes: `normal-opening-visual-findings-2026-10-26.json`. Preparation receipt: `frame-and-private-package-preparation-2026-10-26.json`.
