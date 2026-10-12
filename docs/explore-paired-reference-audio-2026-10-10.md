# Explore paired reference audio — 2026-10-10

## Registration

Registered 16 pairs: 9 hooks from `D:\hookswithlinks` and 7 wall-of-text references from `D:\wotwithlinks`. The video and MP3 in each subfolder are paired; filenames are never used to guess a match.

All 32 original media files were probed and fully decoded. All videos are 720 × 1280. Generated 16 WebP posters and uploaded 48 objects to the configured primary GCP bucket. Every stored object's size, MIME type and full SHA-256 checksum were verified against the local bytes before publishing the catalog. Source files were not modified.

All 48 configured public media URLs also passed HTTP delivery checks for successful status, expected MIME type and nonempty content length.

`D:\wotwithlinks\New folder (8)` is empty and was skipped. The current hooks directory contains `New folder` through `New folder (9)`; the previously observed `New folder (10)` was absent at registration.

The immutable video/audio/poster keys, hashes and reference IDs are recorded in `worker/src/lib/explore-paired-reference-catalog.json`. These references are appended to Explore's Hook and Wall of Text libraries. No Trending catalog was changed.

| Format | Subfolder | Paired MP3 | Video seconds | MP3 seconds |
| --- | --- | --- | ---: | ---: |
| Hook | New folder | ReelAudio-76927.mp3 | 3.03 | 37.59 |
| Hook | New folder (2) | ReelAudio-82750.mp3 | 2.80 | 24.82 |
| Hook | New folder (3) | ReelAudio-37617.mp3 | 2.40 | 20.58 |
| Hook | New folder (4) | ReelAudio-94752.mp3 | 2.77 | 21.37 |
| Hook | New folder (5) | ReelAudio-72252.mp3 | 3.77 | 21.05 |
| Hook | New folder (6) | ReelAudio-72038.mp3 | 3.10 | 19.25 |
| Hook | New folder (7) | ReelAudio-78632.mp3 | 2.80 | 17.53 |
| Hook | New folder (8) | ReelAudio-5108.mp3 | 3.20 | 27.19 |
| Hook | New folder (9) | ReelAudio-82355.mp3 | 3.47 | 26.72 |
| Wall of text | New folder | ReelAudio-84855.mp3 | 6.07 | 6.14 |
| Wall of text | New folder (2) | ReelAudio-65556.mp3 | 7.03 | 7.08 |
| Wall of text | New folder (3) | ReelAudio-23962.mp3 | 8.00 | 7.99 |
| Wall of text | New folder (4) | ReelAudio-49065.mp3 | 7.40 | 7.44 |
| Wall of text | New folder (5) | ReelAudio-59183.mp3 | 10.07 | 10.14 |
| Wall of text | New folder (6) | ReelAudio-66458.mp3 | 14.07 | 14.13 |
| Wall of text | New folder (7) | ReelAudio-89993.mp3 | 8.30 | 8.39 |

## Generation and editing

- The API resolves the selected reference ID against the published catalog for normal jobs, workflow batches and older Recreate entry points. It writes trusted pairing provenance; a client cannot select a replacement soundtrack URL.
- After a provider completes generation, FFmpeg removes native generated sound and adds the checksum-verified registered MP3. The video stream is copied unchanged. Default music volume is 20%; the editor permits volume changes but locks track selection.
- Saving or joining first composes an unmixed video with the opening's already-applied music muted. Demo speech and separately selected demo audio remain in the clean mix.
- The paired MP3 starts once, after trim/text and after the hook and demo have been joined. Longer tracks are trimmed; shorter tracks repeat. Only the outer start/end receive 200 ms fades. There is no restart or second music layer at the hook/demo transition.
- Each finish stores a separate owned `audio-base.mp4` containing the final pictures, edits, captions and speech without the added paired music. Its storage key is bound to the finished asset ID and its GCP metadata to the owner, request, fingerprint and renderer.
- Reloads and re-edits use that clean base, then apply the same MP3 once. Missing, foreign or mismatched clean bases fail instead of stacking soundtrack layers.
- Subtitles use the complete final audio timeline. Captions are also burned into the clean base so later edits preserve them.
- The server's media response supplies paired preview URLs and saved volume. A music-volume-only change requires rendering; an unchanged hook can still reuse its existing owned output.

## Validation and release

Run `npm run test:explore-reference-audio` for pairing, generation/API, database tagging, worker job, real FFmpeg, storage recovery and editor regression checks. The broader existing composition/finishing tests also cover demo-only audio, speech, cropping and every subtitle style.

The focused suite passed all 98 tests. Targeted ESLint checks passed for the changed application and worker code; `git diff --check` passed. The existing composition/finishing regression checks passed, including every registered subtitle style.

The production Next.js build, worker build and full TypeScript check passed locally. No paid video generation or transcription request was submitted during validation.

Media registration is complete in GCP. The application changes and migration have not been deployed/applied by this task. Release the worker and web application with this same catalog and apply only the reviewed `20261012135247_explore_reference_audio_pairing.sql` migration using the project's normal release workflow. It preserves existing Explore format tagging and adds pairing identity from an owned, server-created generation job.

Final acceptance after release must use `https://www.getugcpilot.com`: select one reference of each format, generate, edit, reload, append a speech-bearing demo to a hook, export, and confirm the paired track stays continuous and appears once.

