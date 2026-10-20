# Hook reference frame audit

## Original-folder replacement completed

After explicit user authorization, all 18 verified corrected files replaced the
old MP4s in their original D: import folders, retaining original filenames.
Backups are in `outputs/hook-reference-audit-2026-10-19/original-import-backups/`;
the backup map records each original target. Fresh full-media checks, three
independent agents' visual endpoint checks and installed-file checksum readback
passed. Hook 18, sibling audio/text and all 106 manual audio-review files remain
unchanged. See `scripts/data/hook-reference-original-replacements-2026-10-19.json`.

The original-folder files are now corrected. Historical immutable cached source
objects and the active website catalogue remain as before; no deployment occurred.
References below to original files remaining unchanged describe the audit stage
before this explicitly authorized physical replacement.


Three agents inspected every decoded frame in the 98 active Hook references:
9,773 frames total. Flagged boundaries were reopened at the original frame-tile
size and reviewed again by the coordinating agent. Scope is unrelated scenes,
not suitability of captions, claims, audio, lighting or performer expressions.

79 references have no unrelated scene cuts. Eighteen have clear unwanted tail
footage, totalling 22 frames. Exact zero-based frames to remove:

| Hook ordinal | Unwanted frames |
| --- | --- |
| 1 | 91 |
| 2 | 91 |
| 3 | 109 |
| 4 | 92–93 |
| 6 | 111 |
| 7 | 77 |
| 20 | 87 |
| 30 | 69 |
| 39 | 135 |
| 40 | 94 |
| 42 | 110 |
| 43 | 95–96 |
| 53 | 77 |
| 54 | 50–51 |
| 71 | 90–91 |
| 78 | 47 |
| 88 | 74 |
| 89 | 77 |

The user reviewed Hook 18's opening, which continuously pans from an airplane
window to the smiling performer, and explicitly chose to keep it unchanged.
All 18 clear tail trims were approved. No trim is applied to Hook 18. Physical devices beside a
performer and same-performer pose changes are retained rather than treated as
separate screen recordings. No other uncertain or inserted midclip scene was found.

The user deferred all audio analysis to avoid cost. No paid model calls were made.
Music is acceptable; spoken commentary was the concern. This audit does not infer
audio suitability from frame images, filenames or the presence of an audio stream.

The local trim tool uses decoded-frame boundaries, lossless H.264 and exact pixel
comparison. Retained PTS are normalized only by the retained starting timestamp.
The last performer picture remains displayed until the first excluded frame's
PTS. Variable spacing can make this hold much longer than the packet duration;
the independent review caught and corrected that detail. `-bf 0` plus a final
packet-duration expression preserves the hold without adding duplicate frames.

Native audio in Hooks 6, 53, 54 and 88 is packet-copied, never re-encoded or
auditioned. Packet hashes and relative timestamps are verified. FFmpeg's input
container-start normalization is compensated for nonzero starting timestamps.
Silent sources stay silent. Separate catalogue MP3s are untouched.

All 18 corrected media files exist locally, with source/output hashes and exact
frame/timing receipts. Full prompt proposals remove discarded scene instructions.
Remix proposals clip/drop blocks outside the kept interval without rewriting copy,
and bind to the cleaned source hash. Baked-in text remains in source images;
generation's existing text-removal instruction remains in the proposed prompts.

Open `outputs/hook-reference-audit-2026-10-19/review.html` for the complete
review, cleaned videos, keep/remove boundary images, all-frame sheets, proposed
prompts and manual Hook 18 case. `audit.json` records all evidence and derivatives.
The compact durable decision record is
`scripts/data/hook-reference-scene-audit-2026-10-19.json`.

Run `node scripts/audit-hook-reference-scenes.mjs --inventory` for the frozen
inventory and `node scripts/audit-hook-reference-scenes.mjs N` to build labelled
all-frame sheets for one ordinal. Run
`node --experimental-strip-types scripts/prepare-hook-scene-cleanup.mjs` to
regenerate and verify derivatives, or add `--report-only` to rebuild the review
after confirming prior source/output hashes. Run
`node --test scripts/trim-hook-reference-frames.test.mjs` for the media regressions.
The helpers use local preexisting source media; they do not fetch or publish files.

For manual audio review, `outputs/Hook Reference Audio Review/` contains 98 named
Hook folders, 98 full original paired MP3s and eight native-audio extracts.
`index.html` provides thumbnails and players; `AUDIO-MAP.json` and each folder's
`mapping.json` preserve the reference ID, original import folder, original audio
filename, source URL and checksums. `REVIEW-NOTES.txt` is editable and preserved
on rerun. The exporter copies background bytes exactly and verifies extracted
native packet payloads without analyzing their contents. Names use the same Hook
ordinal plus a visual scene description; no audio suitability is inferred.

The current catalogue, originals, soundtracks and production were not changed by
this audit. Before rollout, content-addressed cleaned videos and previews must be
published and verified, then matching media, duration, prompt hash and caption
hash/timing activated together. Preserve old source identities for historical
jobs. No provider generation-quality or deployed end-to-end acceptance is claimed.
