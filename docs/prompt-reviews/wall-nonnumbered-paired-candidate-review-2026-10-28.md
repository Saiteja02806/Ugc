# Wall non-numbered and paired candidate review — 28 October 2026

This is a candidate review, not runtime admission or production acceptance. No application behavior, saved drafts, videos, provider state or deployment was changed. Source media were sampled; no new video was generated.

## Four non-numbered sources

Original local files were checked against the listed SHA-256, and extracted at nominal 0.25-second intervals using `tools/video_frames.py`. I viewed both contact sheets for each video and the opening JPEG, then rendered source words on a neutral 9:16 canvas with the production text renderer and visually inspected each side-by-side comparison. The source JPEGs are scaled frames; they are not a verified native-pixel font identification. In all four samples the caption appears static through the last sampled frame. Sampling can miss transitions between frames and the final 0.25–0.44 seconds; this is not every decoded frame.

| Source ID | Last sample / duration | Candidate width, top, size at 1080 | Layout and unresolved review |
|---|---:|---|---|
| `explore-wall-text-652f166f3a7a7a8d` | 7.75 / 8.194s | 46%, 50%, 36px | Nine centered white lines. Neutral comparison is close; size sits at current fitter minimum. Dark source, contrast on generated scene unknown. |
| `explore-wall-text-e95ccc86a8f9ee96` | 9.50 / 9.935s | 69%, 44%, 56px | Nine centered white outlined lines. Neutral placement close; real generated-scene contrast and fit for rewritten copy unverified. |
| `explore-wall-text-d496fde4808ff903` | 7.50 / 7.753s | 48%, 39%, 40px | Seven centered list lines separated by blank lines (13 layout lines). The candidate retains breaks but is slightly lower with looser spacing than the opening source. Requires calibration and structured list validation. |
| `explore-wall-text-2fe054f77b9d9549` | 8.25 / 8.589s | 56%, 20%, 44px | Seven centered white outlined lines above face. Neutral placement close; contrast changes with background. |

Source hashes and exact extraction paths are in `outputs/wall-layout-batch-20261028/all-source-review-inventory.json`. Frame metadata and timestamped sheets are under `outputs/wall-layout-batch-20261028/nonnumbered-full-samples/<source-id>/`. Each `nonnumbered-<ID suffix>-comparison.png` is source left and candidate right. Reproduce with `node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON outputs/wall-layout-batch-20261028/nonnumbered-four-candidate-comparison.mjs`.

Production formatter accepts exact source copy at 9, 9, 13 and 7 lines, respectively; one locally written shorter business-related sample fits all four without bottom overflow. This is not a model response or proof for longer output. Candidates still need varied copy, runtime admission, source-mismatch, edit/save/reopen and full-duration tests before adding.

## Seven paired sources

Reviewed every existing 0.25-second contact sheet for the seven paired records listed in `wall-nonnumbered-layout-triage-2026-10-28.md`; no caption move or replacement was apparent at sampled times. The final 0.18–0.43 seconds of each source was not sampled. I generated and inspected six source-left/neutral-right opening comparisons, using the existing hash-bound numerical candidates. The formatter accepts source copy and preserves original line counts: 12 (`d3259c1239762b2daa319893`), 4 (`1d9ddc3d4a768263d88460f0`), 5 (`a7691418a6df49c274c4d888`), 17 (`499cd7912d85e60e54ac54be`), 23 (`abb1480dfd075d5c7923b4d6`) and 18 (`f056193f755c5158c5e8a7c4`).

The comparisons are `outputs/wall-layout-batch-20261028/paired-<ID suffix>-comparison.png`; reproduce using `paired-candidate-comparison.mjs` in that folder. Text block position, width and line breaks appear broadly similar; the exact source font remains unknown. `499c...` crosses bright clothing and requires contrast assessment. `abb...` uses a 36px size at the current minimum and contains sensitive source content that cannot be treated as business facts. `f056...` needs five paragraph groups preserved. The seventh `d2a11374187469b8f8baee61` has a left-aligned yellow list, unsupported by the current centered profile, so it was excluded from the six comparisons. Business Remix fit, source mismatch, editor recovery, full-duration behavior and actual output readability have not been verified for these candidates.

## Remaining 24 non-numbered references: temporal sampling

After the four comparisons above, the remaining 24 files in the non-numbered inventory were also found locally, individually SHA-256 checked against `all-source-review-inventory.json`, and extracted at nominal 0.25-second intervals. I viewed every resulting `contact_sheet_001.jpg` and all ten `contact_sheet_002.jpg` pages. Across these sampled thumbnails the source overlay remained in the same screen region; no text transition was apparent. This is a temporal triage observation, **not** a frame-by-frame text transcription, exact geometry measurement or production acceptance. The last sample precedes the source endpoint, and the actual unobserved tail and any between-sample events are not verified. All 28 non-numbered sources have contact sheets, metadata, a timestamped manifest and blank observation CSVs under `outputs/wall-layout-batch-20261028/nonnumbered-full-samples/<source-id>/`; original IDs, hashes, durations and paths are in `all-source-review-inventory.json`.

Cases needing specific treatment before assigning a profile:

- `explore-wall-text-8ed8ad307341d9c3`: three different text regions, including two boxed areas; a single centered overlay would collapse the intended design.
- `explore-wall-text-242588ba1be47a25`: boxed heading and a left-aligned body with different styles; multiple regions are needed.
- `explore-wall-text-15c1344dbc9683f6`: separated small text regions; validate region boundaries and readability first.
- `explore-wall-text-952c9e951086145c`: left-aligned, blank-separated text; existing centered profiles cannot represent it faithfully.
- `explore-wall-text-186edbf9361266e6`: many fast scene cuts under the stable text; assess contrast across every shot before choosing one style.
- `explore-wall-text-edcf31d415ad6095` and `explore-wall-text-6ef884242109d8db`: thin white text crosses pale clothing in multiple samples; source-like color alone may be difficult to read.
- `explore-wall-text-e1d5e39019c57edd` and `explore-wall-text-5cdc0bf33fa496f7`: particularly dense text and changing or bright backgrounds; require fit and contrast review.
- `explore-wall-text-cf2340e8e4407dab` and `explore-wall-text-1a22e628bb1a4428`: horizontal letterboxed footage; preserve framing and review visibility over a light notebook.

## Thirteen further non-numbered opening comparisons

I visually estimated and rendered initial geometries for the other 13 sources: `0d0039479ef4cca9`, `f5bc390383e437fb`, `c2fbebde7c4f9676`, `ec359c870c62a893`, `765ce326c924aaf6`, `359cef4971f58d83`, `dd3e344317913399`, `f02839f347ec57fe`, `d5ac739cb19678ff`, `5286682bcc6952ad`, `a1616299d8dcc625`, `0fad669fefb4c9e6`, and `8d69fa9e5c2f3c3b` (each has the prefix `explore-wall-text-`). The full SHA-256 is validated against the reviewed text record and printed by the script. All 13 opening comparisons were visually inspected. Each source's explicit line count was preserved, and one short locally authored sample fit each estimated container. This does not establish arbitrary longer output acceptance or generated-footage readability. The sample is not an AI output.

The initial comparisons show meaningful differences that prevent classifying them as calibrated final profiles: `dd3e...` is noticeably smaller and shorter than the source; `f028...` is shorter, with altered paragraph spacing; `0fad...` has changed vertical gaps; `765c...` needs closer text-size and grouping calibration. `ec35...`, `765c...`, `359c...` and `dd3e...` contain financial claims which must not be copied into business-specific output as facts. The other comparisons look broadly close at opening-frame scale but still need pixel calibration, source/background contrast, varied copy, full-duration runtime, save/reopen and export tests. Source font identity remains unproven.

Reproduce with `node --import ./scripts/next-server-only-test-loader.mjs --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON outputs/wall-layout-batch-20261028/nonnumbered-13-comparison.mjs`; it writes `nonnumbered-<ID suffix>-comparison.png` in the same directory. The previous `wall-nonnumbered-layout-triage-2026-10-28.md` records every reference ID, hash and initial concern. None of these proposed geometries has been added to runtime.
