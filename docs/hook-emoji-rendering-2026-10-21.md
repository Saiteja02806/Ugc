# Hook emoji rendering: copy exact text, draw consistent artwork

The AI returns plain Unicode text. `applyVideoTextRemix` and draft persistence
already retain that text, including emojis. The failure was later: the browser
and MP4 renderer used different operating-system fonts, and preserving an emoji
string in SVG did not prove it was drawn correctly. The earlier cross/check
artwork fixed a small subset; it was also absent from the active render workers.

## Implemented correction

General Hook/shared video-overlay emojis now use a locally bundled Twemoji
17.0.3 artwork pack, pinned to upstream commit
`b6b55fef1e8636b540a6d016a4729ca8cdf2e60b`. Both the actual React preview and
worker export use these same glyph bytes. The MP4 export embeds each complete
emoji as vector artwork, independent of OS emoji fonts. It performs no external
fetch or AI generation. The 1,797,829-byte compressed pack loads once per runtime.

Pack SHA-256: `bf3db930a432e97a40f91d2af84cf98e48276f3441d119f3b8351ff8942eff7b`.
Public preview URLs include its version and content hash. Only known IDs resolve;
there is no client-selected path, remote URL, uploaded SVG or caption endpoint.
Missing/corrupt packaged data fails explicitly. The website build traces the
pack into the new asset route; the worker already copies its entire assets tree.

The approved custom red crosses/arrows and green checks remain. Explicit text
presentation selectors retain typography. Text, line breaks, timing, styling,
source bytes, paid remix receipts and finishing fingerprints stay unchanged.
Native textareas use platform typography; the composited preview/export is the
visual authority. No extra controls or user steps are introduced.

Twemoji graphics are CC BY 4.0. Source credits, the complete license and Unicode
data license are bundled; public credits are `/licenses/explore-emoji.txt`.
MP4s containing this artwork carry attribution in their comment metadata,
including the final Hook/demo composition.

## Coverage and limits

Verified against [Unicode's Emoji 17 test data](https://www.unicode.org/Public/17.0.0/emoji/emoji-test.txt):
all **3,944 fully-qualified RGI sequences**, plus **5,216 total qualification
forms** including minimally qualified/unqualified variants, resolve without
splitting. Every one of the
**4,009 graphics** rasterizes to visible pixels without an emoji font. Includes
faces, objects, flags, skin tones, keycaps and joined-person/family sequences.
[Twemoji's upstream project](https://github.com/jdecked/twemoji) defines its
supported Unicode/Emoji version; this is not a claim about every future or
custom emoji.

Unknown emoji-like joined sequences and reserved future pictographs produce an
actionable error in the editor and before new render reservation. They are not
silently replaced, dropped, split or drawn through an unreliable font. Existing
accepted receipt recovery remains available. A font-free glyph selection is
exhaustively checked; human visual review of all 4,009 designs is not claimed.

This change covers Explore Hook, Wall and demo callers of the shared video
overlay. General slideshow text, Trending renderers and speech subtitles are
separate paths and are not claimed fixed here.

## Verification and rollout

- 128 final focused rendering/editor/API/MCP/slideshow regression checks passed,
  including the four new emoji checks after content-hashed URLs and future-symbol
  guards. All corpus entries resolve and all graphics rasterize.
- Actual MP4 tests verify 16 varied samples individually have colored pixels,
  legacy/bundled fonts and presets, copied/saved Unicode, source integrity,
  attribution and no Hook text during the following demo.
- Actual browser fixtures at desktop/mobile widths load all sample artwork,
  retain drag/styles and preserve exact text across save/reopen. An initial
  sandboxed Edge launch failed; the authorized headless run passed outside it.
- Worker build, application TypeScript, final web production build and scoped
  lint passed. The compiled website's actual asset route serves six varied
  emojis byte-for-byte identically to the exporter; its production trace includes
  the compressed pack and unknown IDs return 404. The initial
  default Turbopack build stalled and was stopped; final checking uses Webpack.
- Full corpus/raster, actual MP4 and admission tests are included in the Ubuntu
  video-delivery CI workflow, with locked worker dependencies. This is the
  same font-free path; hosted CI results belong in the combined release receipt.
- Evidence: `.tmp/explore-emoji-render-eaWE5D/corrected-emoji-sample.png`,
  `.tmp/explore-text-fonts-browser/emojis-1366.png`, `emojis-390.png` in that
  same directory, `.tmp/hook-emoji-regressions.log`, and
  `.tmp/hook-emoji-built-route-receipt.json`.

The authorized ongoing combined release must now deploy the website asset route
as well as BOTH `ugc-video-render-worker` and `ugc-video-render-job`. Verify
active service traffic, pinned image/source identity, the batch job digest and
public asset bytes. A staged/READY revision alone is insufficient. Signed-in
production acceptance remains separate from these local checks.

Old MP4s are immutable and need an explicit fresh export from the editable raw
clip and existing remix after rollout. No new paid remix or footage generation,
automatic rerendering, database migration or publishing is part of this work.
