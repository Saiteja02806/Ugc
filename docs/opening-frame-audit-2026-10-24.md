# Hook opening-frame audit — 24 October 2026

Screened all 107 openings in the current local active Hook catalog, including nine newer additions. Source bytes match the active catalog SHA-256 for every reference. This is local catalog review, not a live production check.

- 78 retain their opening based on visual screening.
- 19 have a provisional alternative frame.
- 10 require further review.

Reviewed opening sheets for every reference. For 29 flagged clips, inspected nine decoded timeline samples each (261 sampled images), plus larger opening/candidate comparison sheets. This is not an exhaustive new all-frame or full-video review. Proposed frames are useful sampled candidates, not proven earliest or optimal frames. Frame index is zero-based; elapsed time is measured from first decoded PTS, with absolute PTS also saved. Side angles and glasses alone do not fail. Keep-opening status is not a provider-quality guarantee.

## Proposed alternatives

| Hook | Frame | Elapsed seconds | Reason | Performance tradeoff |
| --- | --- | --- | --- | --- |
| 12 | 36 | 1.200 | Cup blocks the mouth and nose in the opening; selected frame lowers it and reveals the face. | Starting after drinking omits the initial sip. |
| 14 | 32 | 1.067 | Opening eyes are closed; selected frame shows open eyes with the hands still raised. | Expression differs from the closed-eye opening. |
| 19 | 60 | 2.000 | Opening hands and blur obscure the face; selected frame reveals eyes and mouth. | Hands are now beside the head rather than moving over the face. |
| 25 | 73 | 2.433 | Dark sunglasses conceal the eyes; selected frame has glasses lifted away. | The glasses-removal action has already occurred. |
| 29 | 40 | 1.333 | Opening hand overlaps mouth; selected frame reveals the open-mouth expression. | This selected frame was used in the completed Hook 29 pilot; the generated hand still moved over the mouth. |
| 34 | 78 | 2.600 | Opening hand covers lower face; later sample reveals mouth with hand alongside cheek. | Hand remains close to the eye; emotional/crying expression is intentional. Creator caption also crosses the mouth; this frame still requires successful text removal. |
| 38 | 43 | 1.433 | Sunglasses obscure eyes initially; selected frame shows eyes and glasses held below the face. | Glasses removal has already occurred. |
| 46 | 62 | 2.067 | Opening hand covers mouth; selected frame shows eyes open and hand lowered. | Opening mouth-cover action is omitted unless adapted. |
| 47 | 51 | 1.700 | Opening eyes nearly closed and glasses cross the face; selected frame shows open eyes through worn glasses. | Glasses are already on; cannot reuse putting-on opening unchanged. |
| 50 | 30 | 1.000 | Opening is strongly side-facing; selected frame reveals more of both eyes and facial structure. | Completed Hook 50 pilot uses this frame; source is still soft. |
| 52 | 13 | 0.433 | Opening eyes are closed; selected moment opens them while hands remain near temples. | Later motion covers the mouth, so keep that action consistent. |
| 64 | 23 | 0.767 | Opening is blurred while camera is being positioned; selected moment is steadier with face visible. | Camera positioning/reaching begins earlier than selected pose. |
| 71 | 45 | 1.500 | Opening hand covers mouth; selected frame reveals lower face. | Crying expression and squint remain; do not neutralize them. |
| 85 | 180 | 6.000 | Opening hand covers mouth and nose; later sample moves hand to cheek with eyes open. | This is near the end, so the original mouth-cover sequence needs substantial adaptation. |
| 93 | 41 | 1.367 | Opening hand overlaps mouth; later sample reveals the smile and face. | Opening mouth-cover beat has already passed. |
| 94 | 29 | 0.967 | Opening glasses have strong reflections and hand near eye; selected frame removes glasses from face. | Glasses-removal beat has already passed. |
| 96 | 43 | 1.433 | Opening joined hands cover lower face; selected frame lowers them to chest. | Start with hands down and adapt the reaction sequence. |
| 101 | 28 | 0.933 | Opening extreme upward angle hides most facial features; selected frame shows face toward camera. | Moving-camera nighttime scene remains; selected frame is still somewhat soft. |
| 104 | 37 | 1.233 | Opening eyes are closed behind reflections; selected moment opens eyes before later camera approach. | Glasses glare remains; stronger expression than original opening. |

## Needs review

- Hook 18: Opening shows airplane window with no performer. A later visible-face frame exists, but the window-to-person reveal was explicitly preserved by the user. Keep the existing reveal until a separate performance decision is reviewed.
- Hook 27: Foreground face is visible, but another performer enters later. Choose which performer should be regenerated and preserve the other person; no automatic replacement.
- Hook 45: Hand continues to cover the mouth across all nine sampled moments. No clearly unobstructed alternative in samples; inspect full video before deciding.
- Hook 63: Crying close-up has a hand near the eye; later samples remain squinting, obstructed or softer. No clearly superior alternative in samples; preserve emotional expression.
- Hook 73: Opening palm obscures forehead and part of one eye; sampled early alternatives still obscure the eye, while later hand covers mouth. No clearly better overall facial view confirmed; inspect full sequence before choosing.
- Hook 78: Hand covers the mouth throughout the sampled performance. Keep for manual review rather than invent an uncovered face.
- Hook 83: Very low angle crops the lower face; the framing persists throughout samples. No full-face candidate in samples; original shot may require a different approach.
- Hook 84: Only upper portion of face is visible at frame bottom across samples. No full-face candidate in samples; do not pretend later selection solves the crop.
- Hook 88: Creator caption strip crosses the eye region; dim lighting persists. Later samples also obscure eyes or cover mouth; no clean replacement identified.
- Hook 89: Caption strip crosses eye region; later sleeve also covers mouth. No clean replacement identified in samples.

Hook 18's candidate is illustrative only: the user previously required preserving the airplane-window reveal. Do not apply it automatically. Hook 73 was initially flagged as a possible change, then moved to review after the larger comparison still showed eye obstruction.

## Deliverable and checks

Gallery: http://127.0.0.1:8201/opening-frame-audit

Evidence: outputs/opening-frame-audit-2026-10-24/ — inventory.json, candidate-samples.json, review.json, source PNGs, review sheets, index.html and verification.json. Gallery provides status filters/search, full-image links, source playback with manual controls and seek support, sample sheets and per-proposal caveats. Records are source/version/hash bound; no application data or historical receipt was modified.

Integrity validation verifies all source/opening/candidate hashes, 107 unique catalog entries, proposal completeness, JavaScript syntax and 243 local HTTP routes including video byte ranges. Browser interaction remains unverified because local browser use was disabled; this is not an in-application acceptance test. No generation, spending, runtime prompt/frame-selection change or deployment.

Before applying recommendations, inspect each proposed video's full performance and transition around the selected frame, then bind a reviewed motion plan to the exact approved generated image. Preserve existing selections and avoid stale frame-zero instructions. The user prefers the clearer outputs in the two previous paid pilots; this audit itself did not run more provider calls.
