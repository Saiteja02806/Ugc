# Hook new batch and icon controls — 15 October 2026

## Prepared source sets

Source: `D:\hookswithlinks\new batch`. The user corrected `New folder (2)`
during preparation; its final set is `muted_72ffc84b.mp4`,
`70be-e1e6-478b-9c95-84673fa5703e.mp3` and its TikTok post TXT.
The other video candidate was removed by the user, not this import.

There are 22 complete sets: `New folder` and folders 2–22. Folder 23 is empty.
All 22 have one source URL (17 TikTok, 5 Instagram), separate supplied audio,
H.264 video and a duration below 15 seconds. No original video duplicates an
existing first/second-release video. Reused audio is allowed and deduplicated by
hash. Original source folders and previous media mappings are preserved.

The third manifest is
`worker/src/lib/explore-hook-reference-new-batch-release.json`. It is separate
from the two already-published releases so those identities are not rewritten.
Original video/audio, generated poster and audible preview use immutable
content-addressed storage keys. The 22 sets require 86 unique objects totaling
33,082,084 bytes. Preview music uses the existing 0.2 volume and replaces embedded
audio, including the embedded track in folder 12, without doubling soundtracks.

## Remix text

All 22 originals have local Windows OCR transcripts, and sampled source frames
were visually reviewed through the final frame. Twenty references have approved
creator captions. Folders 18 and 19 show graphic logo formulas without remixable
caption copy: their reviewed status is `no_text`, with zero caption blocks.
Do not invent brand names as extracted text. Folder 20 retains `= GOATED LEADS`;
the graphic logos remain part of its source video.

Readiness accepts a reviewed `no_text` record only with an empty block list.
The existing Remix API handles this state; source selection, music and video
generation remain available. Existing user-written Remix input remains supported.
No AI generation or paid remix provider call was made during preparation.

All 530 previous caption records and 511 previous transcripts match the snapshot
before extraction exactly. Only 22 records were appended to each catalogue.

## Icon controls

Hook cards now have an 18px source icon at bottom-left and an 18px Recreate icon
at bottom-right, with transparent 32px hit targets and rounded keyboard-focus
outlines. Coarse-pointer devices retain invisible 44px targets. There is no
visible button fill, border, or Recreate text. A subtle icon shadow preserves
contrast. Selected references show a check and keep the card selection ring.
Accessible names, tooltips and independent link/preview/action clicks remain.
The background-music row and other formats are unchanged.

## Local verification and activation

- Full decode, original hashes/source links, unchanged decoded preview pictures,
  durations and actual soundtrack waveform pairing: 22/22 pass. Minimum sampled
  audio correlation 0.99077, with expected volume gain 0.2.
- Real-component browser fixture: all 22 new previews plus 3 existing controls
  played to the end with decoded video and unmuted sound. No failed previews.
  Desktop/mobile layout, icon-only transparent controls, source navigation,
  keyboard access and independent Recreate/preview clicks pass.
- Regression checks exercise gallery activation/rollback, source-bound Remix
  caption application, reviewed no-text handling and existing source preservation.
  The final media/job suite passed 32 tests, including all 98 prospective Hook
  identities through generation soundtrack attachment and Hook + Demo finishing
  and re-editing. Application TypeScript, worker build and targeted ESLint passed.
- Evidence: `.tmp/hook-new-batch/media-audit.json`, `preservation.json`,
  `review/`, `.tmp/hook-card-browser/all-playback.json` and
  `.tmp/hook-icon-only-review/desktop.jpg`.

The new manifest is **published/active locally**. The user explicitly approved
the upload and local activation after automatic approval review requested a
specific external destination. The destination is Google Cloud Storage bucket
`ugcsaas-media`, under `explore/paired-references/v1/`, served from
`https://storage.googleapis.com/ugcsaas-media`. Uploading makes these media
objects accessible through that existing public media base URL.

The completed upload can be reverified/resumed with:

```powershell
node --experimental-strip-types scripts/publish-hook-reference-addition-release.mjs --manifest worker/src/lib/explore-hook-reference-new-batch-release.json --execute --yes
npm run worker:build
```

The publisher verified all 86 objects by SHA-256, size and content type before
locally activating the manifest. A separate unauthenticated public HEAD check
passed for all 86 URLs. A transient connection reset on the first attempt did not
activate the manifest; bounded retries and three concurrent independent workers
completed the resumed verification. Activation still waits for all workers and
refuses changed manifests/text. No existing media was removed.

All 22 source icons were clicked in the real-component browser fixture and opened
their exact expected post URL in a separate tab, independently of preview and
Recreate. Those URLs also match each original folder TXT after canonicalization.
The fixture intercepts platform navigation; it does not promise anonymous access
or bypass Instagram/TikTok login requirements. Evidence is saved in
`.tmp/hook-new-batch/source-links.json` and `public-media-check.json`.

The local page displays 98 Hook references. Website/worker
deployment is separate and has not been requested. The separate known Hook 76 HEVC
compatibility issue is not changed by this batch; the new videos are H.264.
