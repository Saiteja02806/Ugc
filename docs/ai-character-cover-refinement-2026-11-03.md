# AI Character cover refinement - 3 November 2026

The local 15-second cover now presents three choices in every existing trait beat, selects the original centre choice with the existing glossy flash, and keeps the dock/fusion/finale sequence. Generate uses a blue rounded rectangle, bundled Anton display type, a separate 4K portrait badge/percentage, a thin progress strip and a small damped click shake. The finale no longer contains the Gemini model label.

Status: **LOCALLY VERIFIED**. No deployment, paid image generation or backend acceptance is implied.

## Deliverables and changed files

- [Editable cover source](C:/Users/chund/OneDrive/Desktop/UGC/remotion/AICharacterPromo.tsx): bounded three-choice data and rendering, Generate styling/motion, model-label removal. No new dependency or image asset.
- [Cover verification tests](C:/Users/chund/OneDrive/Desktop/UGC/scripts/verify-ai-character-promo.test.mjs): replaces the superseded selected-only assertion and executes the actual component at the six selection boundaries and Generate/finale states using real Remotion interpolation/springs with deterministic frame hooks.
- [Explore context](C:/Users/chund/OneDrive/Desktop/UGC/EXPLORE_CONTEXT.md): current direction and local verification appended; earlier direction retained as history.
- [Incident ledger](C:/Users/chund/OneDrive/Desktop/UGC/docs/ai-context/clear.md): UGC-VID-055 opened before implementation, followed by concrete local verification. The earlier AI Character UGC-VID-045 history remains intact.
- This receipt: `docs/ai-character-cover-refinement-2026-11-03.md`.
- Updated public outputs: `public/explore/covers/ai-character-promo-v1.mp4`, `public/explore/covers/ai-character-promo-v1.webp`, `public/explore/covers/ai-character-promo-contact-sheet.png`, `public/explore/characters/ai-character-create-yours-v5.mp4`, `public/explore/characters/ai-character-create-yours-v5.webp`.
- Updated existing review outputs: `output/remotion-review/ai-character-promo-contact-sheet.png` and the 12 existing milestone files: `aichar-034-type-extreme-3d-pick.png`, `aichar-050-type-docks-to-stack.png`, `aichar-090-scene-studio-wall-male25.png`, `aichar-138-heritage-middle-eastern-olive.png`, `aichar-186-face-chiseled-round-eyes.png`, `aichar-226-hair-curls-3d-pick.png`, `aichar-242-hair-black-platinum.png`, `aichar-286-outfit-crew-tee-black-half.png`, `aichar-312-generate-traits-orbit.png`, `aichar-330-generate-3d-click.png`, `aichar-372-finale-reveal.png`, `aichar-430-finale-hold.png`.
- New ignored review artifacts, temporary renderer, prior source/video snapshots, timestamp manifests and all per-frame images are enumerated in [the artifact manifest](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-revision-2026-11-03/delivery-manifest.json). They remain local, under the task's review directory.

[Updated standalone MP4](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-revision-2026-11-03/ai-character-promo-v2.mp4)

## Preflight evidence

Inspected `AGENTS.md`, `docs/ai-context/nonnegotiables.md`, the relevant Explore and mistake-ledger promo entries, current source/test/render/registration files, dirty worktree status and diffs, existing Vidmake Generate CSS, and bundled Next documentation (`index.md` and the installation guide). Ran `python tools/preflight.py --repo . --task "Refine existing 15-second AI Character promotional cover video: show three options and pick one with current flash, redesign Generate button typography and brief click shake, remove Gemini 3 Pro ending label"`: PASS, required sources discoverable/readable.

Skills actually read: `ugc-context-memory`, `ugc-immutable-contracts`, `ugc-ui-clarity`, `ugc-frame-analysis`, `ugc-video-prompt`, `ugc-regression-gate`, `frontend-design` and the PDF skill. This is deterministic Remotion film editing; no image-to-video prompt or identity preparation was performed.

The three attached screenshots define the requested changes. All three PDF pages were text-extracted and read as a historical completion receipt, not as new instructions. The eight supplied-folder clips were probed and inspected through three-frame overview samples as aesthetic references. The actual original and final 15-second cover were sampled every 0.25 seconds across their full duration (60 samples each); before/after sheets were visually inspected. The original PDF's selected-only direction is explicitly superseded by the current request.

## Protected behavior

| Contract | Result and evidence |
| --- | --- |
| Six existing chosen traits, click times and recipe | VERIFIED - frame-state tests across all six beats; original portrait and staged trait assets pass provenance tests. |
| Exactly three options, exactly one chosen, no stale alternatives | VERIFIED - component renders before, during and after each click; six native pre-pick frames visually reviewed. |
| Flashy selection and docking | VERIFIED - selection before/at/after frames and final encoded timeline sheets reviewed. Only the original choice receives the check/flash/dock. |
| Headlines, recipe orbit/fusion, step odometer, 2D/3D cursor | VERIFIED - these function sections are byte-equivalent to pre-edit snapshots after newline normalization; hashes in `preservation-checks.json`. |
| Camera/reveal timing and final portrait | VERIFIED - original camera/flash calculations retained, reveal at frame 352, exact final portrait bytes retained; final frames visually reviewed. |
| Generate shake | VERIFIED - bounded at 8px maximum, opposite directions after click, settled by frame 334; loading reaches 100% at frame 344. Native click frames reviewed. |
| Media format | VERIFIED - ffprobe: 450 frames, 15.000 seconds, 1920x1080, H.264, 30fps, no audio. Complete ffmpeg decode exits 0. |
| Public duplicate outputs | VERIFIED - all three final MP4 copies share SHA-256 below; both WebP posters match. |
| Proportional cover presentation | VERIFIED - native frames, 960px desktop images and 390px film previews reviewed; existing cover CSS is 16:9/contain. This is video scaling, not an authenticated browser acceptance test. |
| Neighboring covers and Explore playback contracts | VERIFIED by focused source/asset tests; source files were not edited for this task. |
| Live production, authenticated navigation and backend generation/scheduling | NOT TESTED - outside this local cover-film change; no push/deployment or provider calls performed. |

## Checks and outcomes

- `npx eslint remotion/AICharacterPromo.tsx scripts/verify-ai-character-promo.test.mjs`: PASS, no warnings/errors.
- `npx tsc --noEmit --incremental false`: PASS, including a final repeat after the last source change.
- `node --test scripts/verify-ai-character-promo.test.mjs scripts/verify-slideshow-promo.test.mjs scripts/verify-wall-of-text-promo.test.mjs scripts/verify-hook-video-promo.test.mjs scripts/verify-talking-head-promo.test.mjs scripts/explore-navigation-ui.test.mjs scripts/reference-cover-playback.test.mjs`: **36/36 PASS**, after updating the actual media outputs.
- Local review renderer: final source bundled successfully; 55 native comparison stills, sheets, 450-frame MP4 and posters produced. A missing review-only frame 222 initially interrupted sheet assembly; the frame list was corrected and all sheets regenerated. No application source was involved in that correction.
- `ffprobe` metadata check: PASS. `ffmpeg -hide_banner -v error -i <updated-mp4> -f null NUL`: PASS, no decode errors.
- `git diff --check` on the touched source/context files: PASS. Existing unrelated worktree changes were preserved. No Next production build was needed for this isolated Remotion composition.

The first sandboxed browser connection was denied by local socket isolation; the approved renderer run succeeded with local browser access. OneDrive briefly locked the existing character MP4 during final copy. Native `Copy-Item` recovered the completed export, and all final copies were hash-verified; the video was not regenerated to recover that copy.

MP4 SHA-256: `e3e5dfb8ebb7ab4da22735923e58ac383371eba2d3e84b3ff8622cb24d60b189` (6,136,207 bytes).

Poster SHA-256: `d7f27f4cec39f7f3e0d335d0e55c8e3eb71ea124a72d54ba4f121f378720238a`.

## Visual evidence and rollback

- [All six three-choice scenes](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-revision-2026-11-03/three-options.png)
- [Selection motion states](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-revision-2026-11-03/selection-motion.png)
- [Generate and ending states](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-revision-2026-11-03/generate-ending.png)
- [Scaled cover review](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-revision-2026-11-03/scaled-cover-review.jpg)
- [Original video preserved](C:/Users/chund/OneDrive/Desktop/UGC/output/remotion-review/ai-character-revision-2026-11-03/before/ai-character-promo-v1.mp4)

The task directory's `before/` contains the original composition, tests, renderer script, video, poster and contact sheet. Restore only this task's source/media boundary if reverting; do not revert unrelated user work or erase append-only incident history. No external Vidmake pixel-exact motion match or production acceptance is claimed.
