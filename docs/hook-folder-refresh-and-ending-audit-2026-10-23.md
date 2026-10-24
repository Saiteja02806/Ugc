# Hook refresh and ending audit — 23 October 2026

The user requested another check of `D:/hookswithlinks/notbeen`, then asked to
remove demo/outro frames visible in contact sheets of four full downloaded reels.
They clarified that folder (2) should use the app's default background music.
Deployment remains paused.

## Import decisions

| Folder | Reference | Retained video | Decoded frames | Audio |
| --- | --- | --- | --- | --- |
| Unnumbered | Existing Hook 99 | 4.1 s | 123 | Existing native reaction audio |
| (2) | Hook 100 | 3.8 s | 112 | Approved default `hook_audio_006` |
| (3) | Hook 101 | 3.833008 s | 113 | Exact supplied `ReelAudio-72130.mp3` |
| (4) | Existing Hook 83 | Existing 4.466016 s | 132 | Existing mapping retained |
| (5) | Hook 102 | 2.766016 s | 81 | Exact supplied `ReelAudio-10521.mp3` |
| (6) | Hook 103 | 2.966016 s | 87 | Supplied download's opening reaction audio |
| (7) | Hook 104 | 3.4 s | 100 | Supplied download's opening reaction audio |
| (8) | Hook 105 | 1.833008 s | 53 | Exact supplied `ReelAudio-46427.mp3` |
| (9) | Hook 106 | 2.8 s | 82 | Exact supplied `ReelAudio-27428.mp3` |
| (10) | Hook 107 | 1 s | 28 | Supplied download's opening reaction audio |

The eight immutable IDs are in
`worker/src/lib/explore-hook-reference-oct23-refresh-release.json`, matched to their
source folder, canonical post link, content hashes and audio mapping. Source URLs
lose tracking parameters but retain post identity. No new source link is invented.

Folder (4) is the same canonical TikTok post as Hook 83
(`explore-paired-hook-607bfccda5e91e0d8731fa94`), with a slightly different trim.
Its new short file is 4.566016 seconds/135 frames; the existing registered version
is 4.466016 seconds/132 frames. Both inspected endings remain on the reaction.
The established reference, saved work and audio mapping remain intact.

Default-music provenance: the deployment record names
`EXPLORE_DEFAULT_BACKGROUND_AUDIO_ID=hook_audio_006`; the current approved/active
record was read through the existing application resolver. The public GCP audio
snapshot is SHA-256
`486d51877209ee7c3f8347fe0da2891135a7aa9ea220d37ddd4107c18464bb56`.
No environment variable, database row or account setting changed.

## Demo and outro exclusion

The user's four screenshots show full-download opening/middle/ending panels.
Those MP4s contain product screens and later talking shots. They are inspection
and provenance inputs, not the selected gallery/generation videos. Imports use
only the supplied short `muted_*.mp4` clips, retaining original bytes.

Every one of the 656 frames in the eight new clips was reviewed chronologically.
A separate first/last-four decoded-frame audit covers all nine short candidates
plus existing Hook 83. None of those endings contains a demo screen or later outro.
No additional cut was necessary: full-download tails are excluded by using the
already trimmed reaction files. Originals in the user's folders are unchanged.

The preview renderer copies the reaction video stream and adds its registered
soundtrack at the established 0.2 volume/fades. A decoded-pixel hash comparison for
every new preview matches its reaction source exactly. No pictures are introduced,
dropped or changed by preview creation. TikTok audio extracted from full downloads
is bounded to the reaction interval, excluding later demo narration. Small MP3
duration differences are encoder padding.

Eight source-bound caption records and motion plans were added. Four-second
motion previews adapt short actions with proportionate holds; this does not claim
unchanged timing, generated identity fidelity or paid-animation approval. Existing
admission gates remain.

## Batch and release

`explore-20261023-hook-refresh` has sequence 2 and eight references. All eight have
New. Hook 99 remains available without New; the four slideshow New badges remain.
The current video platform-interleaving rule prioritizes newer batches within
each platform. It supersedes earlier strict global batch sorting where needed
for platform mixing; this import does not change that separate UI decision.

Upload completed at **2026-10-23 10:45:49 UTC**: **32 objects, 14,944,439 bytes**.
All passed full stored-byte hashes, size/content-type and public HTTP/size checks
before local release/batch activation. Website and worker deployment remain paused.
Media upload alone does not update hosted application catalogs.

## Verification

- Follow-up requested by the user: all eight new entries pass the actual
  `getReferenceText` → `remixInputSource` → validated Remix output → timed overlay
  path, plus `createHookKeyframeDraft`/person-photo selection →
  `getHookKeyframePromptPreview`. The image prompt resolves v4 and the verified
  opening pose, omits caption overlays and keeps supporting-photo roles ordered.
  The separate motion prompt compiles without source-video/identity-photo inputs.
  Thirty focused Remix/prompt/release checks pass in
  `outputs/hook-refresh-recreate-remix-check.log`. No paid provider call was made.
- Existing Hook 83 is an exception outside the eight new references: its caption
  is ready, but its old motion review still requires an explicit decision about
  preserving the intentional extreme partial-face crop. The real UI checks
  `requiresDecision` and blocks Use-frame handoff for it. This was not promoted
  merely because the duplicate video file was inspected or re-uploaded.
- 76 focused and release tests pass: approved default mapping, source hashes,
  all 656 frame-review records, post deduplication, motion compilation, caption
  Remix, finishing audio and badge retirement across workflows.
- Application TypeScript, worker compilation and targeted ESLint pass.
- Isolated local production-card/dialog browser fixture fully played 12 previews,
  including all eight new clips, with decoded pictures and no media errors.
  Desktop/mobile New badges, source actions, ordering and Recreate pass.
  This is local component verification, not signed-in hosted acceptance.
- Preparation: `scripts/prepare-hook-refresh-20261023.mjs`; source review data:
  `scripts/data/hook-refresh-oct23-reviews.json`. Explicit uploader:
  `scripts/publish-hook-refresh-20261023.mjs` (dry run by default).
- Receipt and media evidence: `.tmp/hook-folder-refresh-20261023/`:
  `publication-receipt.json`, `upload-manifest.json`, `reviews.json`,
  `ending-audit.json` and `ending-audit-{0,3,6,9}.png`.
- Logs: `outputs/hook-refresh-{tests,browser,typecheck,worker-build,lint}.log` and
  `outputs/hook-refresh-publication.log`. Browser screenshots/playback receipt:
  `.tmp/hook-card-browser-refresh/`.
