# Talking Head and Wall of Text starting-frame Recreate

Implemented locally on 23 October 2026. Deployment remains paused.

Both workflows use the existing shared preparation screen: resolve the actual
first frame, select a main person photo and optional supporting views, select
image model and variation count, generate and inspect variations, then explicitly
approve one with the fixed **Use selected frame** button. Image generation and
video generation remain separate actions with separate costs. Variation labels
and responsive previews match Hook Recreate.

Talking Head preserves the user's script and Demo media/settings. Approval selects
the approved scene image and clears conflicting appearance/video generation inputs.
Existing audio guidance stays visible with a blocker; the user can remove it or
remove the starting frame to return to audio-reference generation. Sound is an
explicit control, off by default. Animation uses the user's script, not the source
clip's transcript, claims or later demo segment. Compatible models/durations are
shown and the image's ratio stays fixed. The server uses the verified source's
workflow to select script-capable prompt construction, preserving Hook's existing
action-only prompt checks.

Wall of Text prepares and animates clean background footage. Overlay text remains
an editing operation; background animation does not request burned-in text. Both
new flows use generic editable workflow directions, without claiming to duplicate
the original performance.

Approved selections persist separately for Hook, Wall and individual Talking Head
drafts. Exact recovery verifies owned job, asset and canonical source and refreshes
the media URL. Cancelling a replacement preserves the prior approved image. Hook's
recent-frame shelf excludes the other workflows.

The source registry uses active canonical Wall references and a SHA-256/dimension
manifest for nine packaged Talking Head videos. Extraction verifies the original
bytes and decodes frame zero at full resolution. Unsupported source ratios are
blocked before image-credit admission. Video admission validates the owned image,
source workflow and matching ratio again. Both extraction routes explicitly trace
the packaged MP4 files. Existing receipt/job/worker contracts are reused; no
database migration is needed.

Validation:

- 298 focused tests passed covering extraction, ownership, image/video admission,
  workflow prompts, source catalog, selection/recovery isolation, actual parent
  callbacks, audio/Demo preservation, settings and navigation regressions.
- Every packaged Talking Head video was read locally, hash-verified and decoded
  with real FFmpeg; all nine first-frame dimensions matched the manifest.
- Browser layout checks passed for Hook, Talking Head and Wall at 1440×900,
  1280×720, 390×844 and 320×568. They cover four variations, selecting the third,
  enlargement/Escape, approval/handoff, footer visibility at both scroll ends and
  no horizontal overflow. Actual shared preparation, dialog and styles are used;
  auth, source/image results, person picker and final video form are fixtures.
  Reproduce with `node scripts/hook-recreate-layout.browser.cjs`; screenshots and
  receipt are ignored artifacts under `.tmp/hook-recreate-layout/`.
- Focused ESLint and the worker TypeScript build passed. Application TypeScript
  verification is recorded in `.tmp/starting-frame-tsc.log`.

No paid provider submission, production mutation or deployment occurred. These
checks do not establish generated likeness, speech fidelity, provider behavior or
authenticated hosted acceptance. Those remain release acceptance work.
