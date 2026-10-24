# Talking Head whole-video background music — 15 October 2026

## Behavior and placement

Previously, Talking Head + Demo offered demo-only audio upload/library and
whole-video default music On/Off. The latter did not support a custom track.

The existing Background music group in Demo now contains Upload music and
Audio Library, followed by the accepted title, audio preview, repeat/play-once
choice and Remove music. A short scope label says the music plays underneath
the talking head and demo. New videos start Off. Selecting a track retains the
current On/Off setting; the user enables music explicitly. Off keeps the
selection available; Remove clears the custom track and turns music off.
Turning on with no custom track uses the existing approved default music.

Demo upload/replacement/removal and demo-only sound keep their existing homes
and behavior. Focused Edit hook/Edit demo tools do not acquire new Sound panels.
No Hook, Wall or Slideshow audio capability was added by this change.

## Data and recovery

- Reuse `WorkflowBackgroundAudioPicker` and its authenticated library/download
  endpoints. Upload or library selection produces a ready owned audio asset.
- `useWorkflowBackgroundMusic` retains the prior accepted asset until a
  replacement succeeds. Removal invalidates pending callbacks. Recovery reads
  the exact owned asset without uploading or generating anything.
- Persist optional `backgroundAssetId` and `backgroundPlayback` in the existing
  owner/draft-scoped workflow session options; old sessions still parse.
- Pass the accepted asset and playback to combined editing preview, caption
  review, final preparation and pending scheduling. Preserve the opening's
  original volume/speech and the independent demo-only audio ID.
- Track changes invalidate stale output/caption corrections. A selected but
  unavailable track blocks preparation instead of silently using default music;
  its group offers replacement or removal.
- Persist explicit off/default/custom identity with finishing recovery. An old
  custom-track output cannot be mistaken for a newly selected default track.
  Existing uncertain requests retain their original request identity.

## Verification

121 functional tests passed in `outputs/talking-head-music-regression.log`.
These cover the actual selection hook, failed/stale replacement, read-only
restore, option serialization, preview, separate demo audio, final request
snapshot, stale output/default recovery, scheduling and existing controls.
The later default-Off check in `outputs/talking-head-music-default-off.log`
confirms uploads/library selections do not turn music on implicitly, replacements
retain an explicit On setting, and an Off track cannot block preparation while
it restores. Reopened drafts keep their saved On/Off choice.
99 additional shared-editor/audio tests passed in
`outputs/talking-head-music-shared-regression.log`, including the local media
composition checks. A separate FFmpeg check passed in
`outputs/talking-head-music-mix.log`: the rendered file preserves opening speech,
places demo audio only during the demo and plays whole-video music across both
trimmed clips. TypeScript and targeted ESLint passed.

After the parallel Wall simplification, the combined eleven-file run passed
217 tests in `outputs/explore-wall-music-integrated.log`; integrated TypeScript,
root music ESLint and whitespace checks passed. These counts overlap the earlier
suites and must not be added together as distinct tests.

The browser fixture uses actual composition controls, selection hook and Audio
Library with stubbed authentication/upload/library responses and a simple
selected-track preview. It compiled, but Edge failed to launch in the sandbox
before any browser assertions. See `outputs/talking-head-music-browser.log`.
It provides no fresh laptop-size screenshots or visual acceptance.
An unsandboxed retry was not executed: automatic approval review could not
complete because its usage limit was reached. This was not a safety rejection.

Production acceptance remains pending because the available production browser
redirected to sign-in. This work was not deployed. Known independent gaps remain
Talking Head reference-text association and automatic text extraction from
uploaded video references; see `EXPLORE_CONTEXT.md`.
