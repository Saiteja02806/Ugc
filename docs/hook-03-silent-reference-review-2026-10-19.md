# Hook 03 soundtrack correction and frame review

The user rejected spoken background audio on
https://www.instagram.com/reel/Dd394l1gRWG/.
Permanent catalogue ID: `explore-paired-hook-ef59f4b5e69bc9e125f8ada7`.

The reference's original MP4 has no audio stream. Catalogue preview multiplexes
the separately registered 31.63425-second MP3 into the 3.766992-second clip;
generation also replaces native provider audio with that MP3 at volume 0.2.
Muting a player or changing generation prose would not remove this automatic mix.

The release entry now explicitly selects silence. Web/MCP catalogue output uses
the original silent MP4 as preview and omits paired audio. The worker stream-copies
the completed video's pictures while discarding every audio stream, with no MP3
download. New output receipts omit the automatic soundtrack, and later reference
lookup does not infer one for those outputs. Existing explicit soundtrack receipts
remain resolvable so historical editing/recovery is preserved. Existing media,
cached completed outputs and open browser selections are not retroactively repaired.
Other references, explicit user music and demo audio keep their existing rules.

All 110 decoded source frames were visually rechecked in sequence:

| Zero-based frames | Observed action |
| --- | --- |
| 0–8 | Reclining, upward questioning gaze, slightly parted lips, blink |
| 9–35 | Eyes widen toward the lens and brows lift |
| 36–46 | Gaze toward screen-right |
| 47–56 | Gaze toward screen-left |
| 57–98 | Wide-eyed gaze toward lens with small head/camera movement |
| 99–108 | Final sideways glance |
| 109, 3733 ms | Single cut to hand/stylus and screen; creator caption disappears |

The action paragraph matches the source. Added explicit silence and no speaking,
voiceover, singing, lip-sync or music without forcing naturally parted lips shut.
The final cut stays brief. Overlay-removal instructions and Remix caption remain
separate and unchanged. The user's reported spoken words were not transcribed or
independently auditioned; suitability is their explicit decision.

Deliverables are in `outputs/hook-03-review/`: `review.html`,
`hook-03-silent.mp4`, `reference-prompt.txt`, all five frame sheets and
`verification.json`. The output was produced from the actual audible preview
through the corrected worker helper. Every decoded picture and timestamp matches
the original silent source; ffprobe confirms zero audio streams. Source and preview
local SHA-256 hashes match the content-addressed paths returned by the connected
production catalogue. Direct production byte fetching failed DNS in this shell.

Validation: worker build, app TypeScript, scoped lint, real FFmpeg silent-output
regressions, generation dispatch/receipt checks, catalogue and prompt checks.
The full standalone reference-audio suite passes. A broader release test fails
on Hook 01's preexisting final-frame Remix expectation, which conflicts with
earlier caption normalization; it is outside this correction and unchanged.

This is a local correction. Worker and web/MCP need release together, followed
by authenticated production acceptance. No paid generation, production mutation,
push or deployment was performed. Already rendered videos require an explicit
edit/new render or audio removal; changing catalogue metadata does not repair them.
