# Corpus prompt audit — 7 November 2026

**Timing backfill (8 November 2026):** all 23 no-`PHASE` plans in this report now
carry contiguous `PHASE` timelines. The "MISSING" timing labels in the visual
table are historical; the current state is **106/106 timed**. Content text was
not changed. Boundaries were authored from the 0.25 s source contact sheets, so
they are estimates, not native-frame exact. 52 targeted prompt/motion tests pass.

**Timing correction (8 November 2026):** the compiled prompts in this report
were produced with `durationSeconds` only. The real preview/submission passes
`actionDurationSeconds = min(source, output)`; for source < output the real
prompt is source-scaled and adds a FINAL HOLD. The content verdicts and the
23 no-`PHASE` finding stand, but the timing-only candidates are overstated
where noted. See `docs/prompt-reviews/video-generation-flow-audit-2026-11-08.md`
for the verified percentage → seconds pipeline and real examples.

## Scope and method

Question: does each assembled Hook recreation prompt explain the complete source
video — opening through the final frame, including camera movement, cuts, holds,
hands/props and the ending — well enough to regenerate the source?

- Source library: all **106** remaining reviewed Hook references resolved to local
  MP4s (98 in `.tmp/explore-paired-references/media`, 8 in the 23 October refresh /
  upload batches). Hook 28 was removed from the references by user decision on
  7 November 2026 before this revision.
- Inventory: `.tmp/corpus-audit-2026-11-07/inventory.json` (machine flags plus
  the exact compiled prompt at each reference's preview duration).
- Visual evidence: `.tmp/corpus-audit-2026-11-07/evidence/<referenceId>/` —
  `tools/video_frames.py` at 0.25 s, 640 px frames, timestamped contact sheets.
- This pass visually inspected the **23 plans without a `PHASE` timeline** and
  the **6 newest references** (Hooks 99, 102, 103, 105, 106, 107), which do have
  `PHASE` timelines. The remaining 77 `PHASE` references still need the visual
  content pass.

## Structural result — 106 references

| Check | Result |
|---|---|
| Source files resolved | 106 / 106 |
| Camera clause present | 106 / 106 |
| Opening state present | 106 / 106 |
| Ending state present | 106 / 106 |
| Contiguous numeric `PHASE [0–1]` timeline | 83 / 106 |
| No numeric timeline | 23 / 106 |
| Source longer than preview/output | 13 / 106 |

The 13 source-longer-than-output cases include 10 that do have `PHASE` and are
therefore remapped by `retimeSourceMotionDirections`, and 3 that do not:
Hook 15 (8.63 s → 8 s), Hook 84 (5.73 s → 4 s, needs decision) and Hook 85
(6.10 s → 4 s).

## Visual pass — 23 plans without a numeric timeline

Content verdict means: does the prompt's action order, opening, ending and
camera description match the visible source? Timing verdict means: does the
prompt declare when each action happens and how the source maps to the output
duration?

| Reference | ID suffix | Source → output | Content | Camera | Timing | Notes |
|---|---|---|---|---|---|---|
| Hook 12 | 03d314d5 | 2.43 → 4 s | COMPLETE | COMPLETE (fixed) | MISSING | Sip → lower mug → trickle → rounded hold matched. |
| Hook 15 | 43cc1dae | 8.60 s actual (catalog 8.634) → 8 s | COMPLETE | COMPLETE (steady + one cut) | MISSING, REMAP NEEDED | Two takes and the cut at exactly 5.666667 s match. Output is 0.60 s shorter with no declared remap. Full-resolution frames confirm thin pink stripes; the prompt's "striped shirt" wording is correct. |
| Hook 19 | e683292d | 2.97 → 4 s | COMPLETE | COMPLETE (continuous pan) | MISSING | **needs_decision:** source t=0 has no performer, so an approved influencer opening cannot come from the source opening. |
| Hook 20 | f1afdb32 | 3.23 → 4 s | COMPLETE | COMPLETE (fixed) | MISSING | Hands mouth → cheeks → behind head matched. |
| Hook 26 | 09c4e9b5 | 3.37 → 4 s | COMPLETE | COMPLETE (steady) | MISSING | Sunglasses removed forward, never onto the head. |
| Hook 28 | 917cba02 | 2.93 → 4 s | REMOVED | — | — | User decision, 7 Nov 2026: removed completely from the Hook video references. Data entries removed from the release, motion catalog, motion plans, reviewed prompts and text catalogs; media objects in storage were not deleted. |
| Hook 30 | 9309a041 | 2.17 → 4 s | COMPLETE | COMPLETE (continuous push-in) | MISSING | Eye widening and closer crop matched. |
| Hook 35 | bdc5af5a | 3.50 → 4 s | COMPLETE | COMPLETE (handheld drift) | MISSING | Hand moves from mouth to under-eye dab. |
| Hook 39 | 99ff813e | 3.90 → 4 s | COMPLETE | COMPLETE (slight push-in) | MISSING | Glasses down/forward then off; empty hand to forehead. |
| Hook 46 | 4aa27111 | 2.40 → 4 s | COMPLETE | COMPLETE (drifting selfie) | MISSING | Hand stays over mouth; small eye/head movement only. |
| Hook 47 | 892b0f65 | 2.77 → 4 s | COMPLETE | COMPLETE (drift) | MISSING | Glasses brought down onto the nose, not removed. |
| Hook 50 | c8b971f4 | 2.80 → 4 s | COMPLETE | COMPLETE (subtle) | MISSING | Fingertip stays on lower lip; face turns to lens. |
| Hook 52 | 114b58d5 | 3.47 → 4 s | COMPLETE | COMPLETE (steady) | MISSING | Hands from temples to nose/mouth with fingertips meeting. |
| Hook 64 | 775bf4f0 | 3.03 → 4 s | COMPLETE | COMPLETE (retreat/lower to tabletop) | MISSING | Arm withdraws; laptop and pen revealed. |
| Hook 71 | 8d49391a | 3.10 → 4 s | COMPLETE | COMPLETE (shaky rise) | MISSING | Reclining → upright, hand lowered, crying expression held. |
| Hook 84 | e5870158 | 5.73 → 4 s | COMPLETE | COMPLETE (low partial-face crop) | MISSING, REMAP NEEDED | **needs_decision:** only eyes/brows are visible at t=0, which limits identity preparation. Source is 1.73 s longer than output. |
| Hook 85 | bee95bd7 | 6.03 s actual (catalog 6.1) → 4 s | COMPLETE | COMPLETE (close handheld) | MISSING, REMAP NEEDED | Hand slides to cheek to uncover the mouth. Source is 2.03 s longer than output. At 4.0 s the hand is still over the mouth; the cheek reveal appears only at 5.5 s. |
| Hook 89 | 6365d336 | 2.90 → 4 s | COMPLETE | COMPLETE (wobble/closer/lower) | MISSING | Sleeve raised over mouth; eyes smile above it. |
| Hook 93 | 61eb2906 | 2.80 → 4 s | COMPLETE | COMPLETE (tilted selfie) | MISSING | Same hand: lips → chest → forehead. |
| Hook 94 | f12c90a7 | 4.00 → 4 s | COMPLETE | COMPLETE (fixed) | MISSING | Glasses carried outward and off the face. |
| Hook 96 | 50dd086e | 2.93 → 4 s | COMPLETE | COMPLETE (fixed wider desk) | MISSING | Joined palms slide down to chest, mouth uncovered. |
| Hook 100 | fc44f621 | 3.80 → 4 s | COMPLETE | COMPLETE (low handheld) | MISSING | Glasses removed forward and lowered; earbuds stay. |
| Hook 101 | ddcfb295 | 3.83 → 4 s | COMPLETE | COMPLETE (continuous low→level move) | MISSING | Night-city low-angle reveal matched. |
| Hook 104 | 185ed6ac | 3.40 → 4 s | COMPLETE | COMPLETE (closer handheld) | MISSING | Phone stays in one hand; the other covers the mouth. |

### Batch verdict

- **Descriptions are accurate.** 23/23 non-excluded plans: action order, opening,
  ending and camera match the visible source. No invented gestures, no missing
  ending, no camera error found in this batch.
- **Timing is the real defect.** 23/23 have no explicit numeric timeline, so
  `retimeSourceMotionDirections` returns early: no full-action remap and no
  final-hold instruction. For the 20 short sources this mostly means the model
  decides the pacing; for Hook 15 and Hook 85 it risks rushing or cutting the
  ending because the output is shorter than the source.
- **Two cases need a product decision, not a rewrite:** Hook 19 (no performer
  at t=0) and Hook 84 (only eyes/brows visible at t=0). Their descriptions are
  correct; the route/identity preparation is the open question.
- **Hook 28 is removed by user decision (7 Nov 2026).** The release, motion
  catalog, motion plan, reviewed prompt and text catalog no longer contain it.
  Historical audit documents remain as record.

## Newest references — 6 plans with `PHASE` timelines

| Reference | Source → output | Content | Camera | Timing | Notes |
|---|---|---|---|---|---|
| Hook 99 | 4.10 → 4 s | COMPLETE | COMPLETE (closer + upward tilt) | PRESENT (7 phases) | Hand beside cheek → mouth covered → closer crop → hand lowered matched. |
| Hook 102 | 2.77 → 4 s | COMPLETE | COMPLETE (closer selfie) | PRESENT (8 phases) | Leaning question → hand covers mouth → eyes close → hand to chin matched. |
| Hook 103 | 2.97 → 4 s | COMPLETE | COMPLETE (nearer with wobble) | PRESENT (7 phases) | Can held upright → eyes widen → can lowered → closer face matched. |
| Hook 105 | 1.83 → 4 s | COMPLETE | COMPLETE (steady medium-close) | PRESENT (6 phases) | Hand to mouth and head tilt matched; short source is stretched with declared holds. |
| Hook 106 | 2.80 → 4 s | COMPLETE | COMPLETE (nearly fixed) | PRESENT (6 phases) | Wide-eyed open mouth, hand at chest, slow eyelid closures matched. |
| Hook 107 | 1.00 → 4 s | COMPLETE | COMPLETE (steady close selfie) | PRESENT (3 phases) | One-second held pose stretched to 4 s with a declared hold and final blink. |

No content, camera or ending error was found in these six. The only observation
is expected: very short sources (105 at 1.83 s, 107 at 1.00 s) are held across the
4-second output, which the prompt declares.

## Phase-timeline batch 1 — Hooks 01–06

| Reference | Source → output | Content | Camera | Timing | Notes |
|---|---|---|---|---|---|
| Hook 01 | 3.07 → 4 s | COMPLETE | COMPLETE (low still → physical lift/tilt) | PRESENT (4 phases) | Hand to mouth, reach to phone, tight off-centre ending matched. |
| Hook 02 | 3.07 → 4 s | COMPLETE | COMPLETE (steady) | PRESENT (6 phases) | Laptop lid moved out, surprise, both hands remove glasses matched. |
| Hook 03 | 3.73 → 4 s | COMPLETE | COMPLETE (reclining drift) | PRESENT (7 phases) | Blink, lens gaze, right/left glances, final side glance matched. |
| Hook 04 | 3.07 → 4 s | COMPLETE | COMPLETE (fixed → late lift/tilt) | PRESENT (6 phases) | Mouth cover, arm reach, lower-right crop and wall/ceiling reveal matched. |
| Hook 05 | 3.23 → 4 s | COMPLETE | COMPLETE (approach, retreat, return) | PRESENT (7 phases) | Can held, finger beside nose, eyes close, chin lift, final stare matched. |
| Hook 06 | 3.73 → 4 s | COMPLETE | COMPLETE (ease back, return close) | PRESENT (6 phases) | Can raised, sustained sip, lower, purse, wide-eyed ending matched. |

No content, camera or ending error was found in this batch. All six have explicit
numeric timelines compiled to the 4-second output.

### Batch 1 decision — no prompt changes

Re-sampled Hooks 02 and 04 at 0.1 s because the 0.25 s sheets suggested an offset:

- **Hook 02:** surprise begins at source 0.8 s (generated 1.04 s), hands reach the
  temples at 1.6 s (2.08 s), glasses are pulled at 2.0 s (2.61 s), and the glasses
  are held low at 2.4 s (3.13 s). The compiled phases are 1.04–1.74, 1.74–2.57,
  2.57–3.13. They match.
- **Hook 04:** the palm reaches the mouth at 1.4–1.5 s (generated 1.82–1.95 s)
  against the compiled 1.74–1.96 s; the arm extends at 2.0–2.3 s (2.61–3.0 s)
  against 2.35–3.0 s; the camera lift is 2.6–3.0 s (3.39–3.91 s) against
  3.35–4 s. Differences are within about 0.3 s.

No wording, camera or ending change is justified for Hooks 01–06. The earlier
0.25 s concern was a sampling artifact. **Move to batch 2; do not edit batch 1.**

## Phase-timeline batch 2 — Hooks 07–11

| Reference | Source → output | Content | Camera | Timing | Notes |
|---|---|---|---|---|---|
| Hook 07 | 2.67 → 4 s | COMPLETE | COMPLETE (arm-length drift closer) | PRESENT (5 phases) | Glasses lifted onto the head, hand then covers the lips matched. |
| Hook 08 | 2.70 → 4 s | COMPLETE | COMPLETE (static desk) | PRESENT (7 phases) | Interlaced stretch, left/right neck stretch, return to keyboard matched. |
| Hook 09 | 2.83 → 4 s | COMPLETE | COMPLETE (close handheld bob) | PRESENT (5 phases) | Glasses lifted onto the head, fingertips to lips matched. |
| Hook 10 | 3.10 → 4 s | COMPLETE | COMPLETE (steady) | PRESENT (10 phases) | Fingertip beside lip, hand to chest, repeated blinks matched. |
| Hook 11 | 3.77 → 4 s | COMPLETE | COMPLETE (fixed portrait) | PRESENT (4 phases) | Both hands on earcups, gaze turns from laptop to lens matched. |

No content, camera or ending error was found in batch 2. No prompt change is
justified for Hooks 07–11. **Move to batch 3.**

## Phase-timeline batch 3 — Hooks 14–18 (8 November 2026)

Hook 13 does not exist in the reference catalog. Hook 15 is the already-audited
no-`PHASE` case; its content is correct and its missing remap stays in the
separate timing task. The four `PHASE` references:

| Reference | Source → output | Content | Camera | Timing | Notes |
|---|---|---|---|---|---|
| Hook 14 | 3.37 → 4 s | COMPLETE | COMPLETE (slight handheld bob) | PRESENT (5 phases) | Hand from cheek to mouth, gaze to lens, hand lowers, toothy smile matched. |
| Hook 16 | 3.10 → 4 s | COMPLETE | COMPLETE (small approach/bob) | PRESENT (5 phases) | Knowing pause, hand to lips, sideways glance, smile behind fingers matched. |
| Hook 17 | 2.43 → 4 s | COMPLETE | COMPLETE (close handheld bob) | PRESENT (7 phases) | Hand covers mouth, lowers, broad smile matched. Smile onset is about 0.2 s early in source terms, a timing-only candidate. |
| Hook 18 | 2.17 → 4 s | COMPLETE | COMPLETE (small end shake) | PRESENT (5 phases) | Forehead hand, skeptical squint, blink, end shake matched. |

### Batch 3 decision — no required prompt changes

Hooks 14, 16 and 18 align within sampling tolerance. Hook 17 is the only
timing-only candidate: the authored broad-smile onset maps to about source
1.35 s while the 0.1 s frames show the smile beginning around 1.5–1.6 s
(about 0.2 s early in source time). The sequence, camera and ending are correct,
so this is not a content rewrite. Do not edit it without a controlled generation
that can measure whether the timing difference is visible. **Move to batch 4.**

## Phase-timeline batch 4 — Hooks 21–25 (8 November 2026)

| Reference | Source → output | Content | Camera | Timing | Notes |
|---|---|---|---|---|---|
| Hook 21 | 2.93 → 4 s | COMPLETE | COMPLETE (slight natural drift) | PRESENT (6 phases) | Forehead hand, wide-eyed stare, hand lowers, face turns to lens matched. |
| Hook 22 | 3.23 → 4 s | COMPLETE | COMPLETE (continuous handheld lift/closer) | PRESENT (6 phases) | Glasses removed and held, keyboard hand reaches, camera lifts, glasses hand covers lips matched. |
| Hook 23 | 2.30 → 4 s | COMPLETE | COMPLETE (fixed desk) | PRESENT (5 phases) | Interlaced stretch, release, hand to lid, lid tilts upright matched. |
| Hook 24 | 2.57 → 4 s | COMPLETE | COMPLETE (steady portrait) | PRESENT (4 phases) | Eyeglass grip, brow knit/purse, mouth reopens, glasses pulled away matched. |
| Hook 25 | 1.63 → 4 s | COMPLETE | COMPLETE (fixed desk portrait) | PRESENT (3 phases) | Hands at head, face turns to lens, tense half-smile matched. |

### Batch 4 decision — no required prompt changes

Content, camera and ending are correct in all five. Three timing-only candidates
were measured; none justifies a wording or action rewrite:

- **Hook 21:** hand lowering and eye closure run about 0.3 s early in source time.
- **Hook 23:** the forward-stretch hold ends about 0.3 s early in source time
  (0.1 s frames show the stretch held to ~1.3 s, release ~1.4–1.6 s). The release
  still completes at the authored time; only the hold is shorter.
- **Hook 24:** the brow-knit/purse and mouth-reopen boundaries run about 0.3 s early.

These are pacing refinements, not missing actions or camera errors. Keep them as
controlled-generation candidates and **move to batch 5**.

## Claim verification — 7 November 2026

Every concrete risk below was re-checked against the file, the plan JSON, the
compiled prompt and the extracted frames.

| Claim | Evidence | Verdict |
|---|---|---|
| Hook 15 has no remap | Plan has 0 `PHASE` markers; compiled prompt has 0 numeric ranges and no `FINAL HOLD`; `retimeSourceMotionDirections` returns unchanged at `if (!directions.includes("PHASE [")) return directions;` (`lib/explore/hook-middle-frame-motion.ts:87`). Actual container duration 8.600 s (258 frames @30 fps), output 8 s. | **VERIFIED** |
| Hook 15 cut at ~5.67 s | `ffmpeg` scene detection found exactly one transition at `pts_time 5.666667`; full-res frames at 5.500 s and 5.700 s show take 1 then take 2. | **VERIFIED, exact** |
| Hook 15 says "striped shirt" | Full-res frame at 5.500 s shows thin pink stripes on the white top. | **CORRECT** (my earlier doubt was wrong) |
| Hook 85 has no remap | 0 `PHASE` markers; 0 numeric ranges; no `FINAL HOLD`. Actual duration 6.033 s (181 frames @30 fps), output 4 s. Full-res frame at 4.000 s still has the hand over the mouth; the cheek reveal is at 5.500 s. | **VERIFIED** |
| Hook 19 has no performer at t=0 | Full-res frame 0.000 s shows the airplane window and seatback only; plan says "no performer visible"; review status is `needs_decision`. | **VERIFIED** |
| Hook 28 has two people | Full-res frame 2.500 s shows the foreground performer and the gray-clothed colleague behind on screen-right touching his glasses; plan says the same. | **VERIFIED, then removed from the references by user decision** |
| Hook 84 shows only eyes/brows at t=0 | Full-res frame 0.000 s shows only the forehead, brows and eyes at the bottom of a low-angle selfie; plan says the same; review status is `needs_decision`. | **VERIFIED** |
| Hook 28 removal is complete in data | Release items 46→45 and excluded IDs 4→3; motion catalog 107→106; motion plans 33→32; text catalog 586→585; text transcripts 533→532; reviewed prompt entry deleted. All five JSON files parse; 23 targeted motion/prompt tests and the 6 release-readiness tests pass; `worker:build` and app `tsc --noEmit` clean. | **DONE** |

Removal checks that still fail are pre-existing and unrelated to Hook 28:
`hook-reference-release-staging` expects the obsolete imported id `explore-hook-01`
(HEAD already has only `explore-hook-01f611...`), `hook-scene-release` finds preview
hash drift on scene ordinals 53/54, and `hook-refresh-oct23` expects an older
starting-image prompt prefix. None of those rows or files is Hook 28.

Proof frames: `.tmp/corpus-audit-2026-11-07/proof/`.

## What this means for regeneration fidelity

A prompt with correct content but no timing can still produce a different
performance: events may be stretched, compressed, reordered within a section, or
the ending may be cut. To regenerate "exactly how the source video was", each
static-reviewed plan needs:

1. A contiguous timeline from source t=0 to the source end.
2. An explicit mapping to the output duration (compress or hold).
3. A final-hold clause when the output is longer than the source action.
4. The existing camera, opening and ending clauses kept exactly as they are.

## Next steps

1. Visually re-check the remaining 57 plans for content only (same contact-sheet
   method); timing is now present for all 106.
2. Resolve the two remaining decision cases with the user: Hook 19 (no performer
   at t=0) and Hook 84 (only eyes/brows visible at t=0).
3. Run one controlled generation per corrected group before any bulk assignment.

## Status

- Source-to-prompt content comparison: **49 of 106 references** (23 previously
  untimed + the 6 newest references + Hooks 01–11 + Hooks 14–18 + Hooks 21–25),
  using 0.25 s contact sheets; not every native frame was inspected.
- Timing/coverage completeness: **106 of 106 plans now carry a contiguous
  `PHASE` timeline** (backfilled 8 November 2026). Boundaries are estimates from
  0.25 s sheets; generated adherence is still untested.
- Remaining 57 references: **content pass NOT TESTED in this report.**
- Hook 28: **REMOVED from the references**; media objects in storage were not
  deleted.
- Generated-video adherence: **NOT TESTED.**
- No prompt text, generation model, provider call or deployment changed. The
  product-data changes are the Hook 28 removal and the 23 timing backfills.
