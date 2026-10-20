# Background audio library — 14 October 2026

The Explore Demo's **Background audio → Audio Library** button loaded `/api/audio/history` through `WorkflowSavedAudioPicker`. That endpoint lists an account's personal generated speech and uploaded recordings. It never queried the existing background music catalogue, so an account without personal recordings saw an empty library even when music existed in the backend.

## Verified backend

Read-only checks of the linked production Supabase project found 52 active, approved `hook_audio_assets` and 78 active, approved `wall_audio_assets` in the reusable `matcher_pool`. The new application catalogue service returned all 130. Authenticated catalogue resolution followed by GCP HEAD checks confirmed all 130 files returned HTTP 200 with audio content types and sizes within the 25 MB upload limit. No music generation, media writes or database changes were performed.

## Implementation

- `WorkflowBackgroundAudioPicker` replaces the personal-recording picker in the Demo background music section and the opening video's Sound editor.
- `GET /api/explore/background-audio` returns reviewed music metadata from both backend libraries, with names, durations, moods, energy and loop policy. The two sources load in parallel and page through the catalogue.
- `GET /api/explore/background-audio/file` authenticates generation access, resolves a source and track ID against active approved GCP records, and reads a bounded audio file. Storage URLs, credentials and internal paths are excluded from catalogue responses. Client URLs and duplicate/extra parameters are rejected. Reference-locked Instagram tracks remain with their reference.
- The picker supports search, preview, explicit Use, loading/error/retry states, and account changes. Preview performs only a read. Selection uses the existing verified media upload and owned edit-draft flow, so reopening an edit can restore its selected audio.
- A selected loopable track defaults to **Repeat to fit**. Other tracks default to **Play once**. Existing demo speech, text, framing and trim remain separate.
- Saved personal recordings remain available in their existing demo speech/reference controls.

## Verification

Catalogue and API regression tests cover approval/storage filters, reference locks, more than 200 tracks, auth, safe response metadata, invalid selections, bounded downloads and client playback validation. Real Demo event tests verify saving both playback modes without losing demo text, trim or its separate recording. Existing music, voice, composition, scheduling and editor tests were included.

The combined focused suite passed 130 tests. A follow-up run against the latest shared Demo component passed all 62 catalogue/client/Demo-state tests. Scoped ESLint, TypeScript and the production build passed. The initial full build encountered a concurrent caption-editor type mismatch, which was subsequently corrected in the shared code; a retry encountered disk exhaustion in Webpack's regenerable cache. Clearing only the verified `.next/cache/webpack` directory allowed the final build to complete successfully.

`scripts/workflow-background-audio.browser.cjs` bundles the actual picker, React Query, Popover and local attachment hook. It uses a production metadata snapshot and isolated audio responses. Browser checks verify 130 tracks, search, actual preview playback without attachment, selection of both playback modes, preserved audio after failed selection, refresh/retry, account change, and no mobile overflow or page errors. It makes no production account writes.

The production browser redirected to sign-in. The UI fix remains local until deployment; signed-in production acceptance must be performed at `https://www.getugcpilot.com` after deployment. No migration is required.
