# Wall text layout pilot — 28 October 2026

Review artifacts only. No application behavior changed, no paid API calls, and no deployment.

## Evidence and result

Recovered the six original source MP4s from `.tmp/wall-money-review-2026-10-26/media/` and verified their SHA-256 values against `wall-money-source-manifest-2026-10-27.json`. Extracted their original-resolution 720x1280 opening frames. This supersedes the earlier note that original videos were unavailable: the old manifest paths are absent, but retained copies exist.

Rendered two placement trials using the application's outlined text renderer, with its existing Proxima Nova 600 candidate. The source font is NOT confirmed. Each comparison shows the original, source words rendered on a neutral background, and manually authored sample copy on a neutral background. These are fit trials, not generated Remix results or finished composited videos.

| Reference | Lines | Font size at 1080-wide canvas | Candidate box width | Equal side inset | Top |
|---|---:|---:|---:|---:|---:|
| wall-money-03 | 4 | 58 px | 65% | 17.5% | 53% |
| wall-money-06 | 10 | 44 px | 64% | 18% | 52.5% |

Both source-word and sample-copy renders preserve their exact words and intended 4/10 lines and fit the candidate bounds. These are candidate container dimensions, not measurements of the original source's hidden text box. Visible glyph width varies with the actual words. The source's heavier outline and the dense example's tighter vertical spacing are not matched exactly; the current renderer's 1.35 line-height makes the dense trial taller. Do not activate these values as universal Wall defaults.

## Artifacts and reproduction

- `outputs/wall-layout-pilot-20261028/wall-money-03-comparison.png`
- `outputs/wall-layout-pilot-20261028/wall-money-06-comparison.png`
- `outputs/wall-layout-pilot-20261028/pilot-metrics.json`
- `outputs/wall-layout-pilot-20261028/render.mjs`
- `outputs/wall-layout-pilot-20261028/wall-money-01-original.png` through `06-original.png`

Run `node outputs/wall-layout-pilot-20261028/render.mjs` to reproduce the trials. This uses the actual format layout and outlined export renderer. It does not exercise the browser editor, persistence, production, or automatic generation.

## Safe next implementation boundary

Use separate, versioned reference-specific Wall profiles. Measure the remaining four references at original resolution before enabling their profiles. Keep full selected Wall duration and editable text; do not reuse Hook trimming or short-copy constraints. Initialize only untouched new drafts, preserving saved styles, words, line breaks, trims and explicitly empty text. Validate desktop/mobile editor appearance, exported frames and reopen behavior before automatic activation.

The pilot is enough to establish that short and dense Wall blocks require different sizes, but not enough to establish one layout for every Wall category. Font matching, outline, dense line spacing, real video/editor visibility and saved-edit protection remain NOT VERIFIED by these raster trials.
