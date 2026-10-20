# Explore Remix symbol rendering — 19 October 2026

Implemented locally; no deployment or production media changes in this task.

## Cause and correction

The reported cross and tick were font characters inheriting the white caption
fill. Face emojis could use color font fallback, so their successful appearance
did not establish that symbols would preserve red/green. Bundled Arial, Inter
and Montserrat have a right-arrow glyph, which also inherits the caption fill.
Fallback formerly split text into individual code points, potentially separating
variation selectors and joined emoji sequences.

`explore-inline-symbols.ts` supplies shared small SVG paths: red crosses/right
arrows, green ticks/check boxes. Browser preview, bundled-font export and legacy
video overlays containing these symbols now use this artwork. Other emojis use
color-font fallback as complete graphemes; no claim is made that every platform
supports every Unicode emoji. An explicit text-presentation selector stays text.
Ordinary X/x, arithmetic, authored Unicode and saved draft fields are preserved.

## Workflow audit

| Path | Result |
| --- | --- |
| Explore Hook Remix/manual text | Fixed in preview, outlined export and legacy export |
| Explore Wall of Text | Same shared video-overlay fix |
| Talking Head/Phone and demo clip text | Same shared preview/export implementation |
| Explore slideshow added text | Fixed in shared SVG preview/PNG export |
| Trending generated Hook | Existing dedicated cross/check icon contract; unchanged |
| Trending Carousel manual text | Separate renderer rejects unsupported glyphs; unchanged |
| Generated/baked slide text and speech subtitles | Separate paths; not covered by Explore rendering acceptance |

## Verification and release

The real-video regression encodes Hook/Wall clips with legacy Arial, Inter,
Montserrat and Snapchat styles. Pixel checks require red/green symbol ink,
ordinary white text, no overlay outside its interval, and unchanged source bytes.
Raster tests cover supported font families and slideshow left/center/right
alignment. Grapheme checks cover selectors, skin tones, joined emojis, flags and
keycaps. Browser checks use the actual Hook/Wall editor at laptop/mobile widths,
verify colors and exact text after save/reopen, and retain drag/preset behavior.

Commands:

```sh
npm run worker:build
node --experimental-transform-types --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --test scripts/explore-symbol-rendering.test.mjs scripts/explore-text-fonts.test.mjs scripts/explore-format-edit.test.mjs scripts/explore-clip-live-controls.test.mjs
node scripts/explore-text-fonts.browser.cjs
npx tsc --noEmit --incremental false
```

Validation passed: worker build, application TypeScript, scoped lint, 34 initial
rendering/editor regressions, the final four symbol/slideshow tests, all 92
related finishing/API/MCP/slideshow regressions, and the laptop/mobile browser
fixture. Related finishing/API/MCP/slideshow regressions run against fixtures. Their
explicit module maps now load the real shared symbol module. The broader
`lib/scheduling/explore-finished-video.test.mjs` suite still has three unrelated
schedule-creation fixture failures: its empty queue/database mocks predate the
current direct-schedule outbox service (`getQueueNameForJobType` and
`insertDirectScheduledPost`). No scheduling implementation is changed here.
An initial parallel regression run exhausted local process memory; the relevant
finishing/MCP/slideshow suites were rerun serially.

Evidence includes `.tmp/explore-symbol-render-JG0zoS/corrected-hook-frame.png`
and `.tmp/explore-text-fonts-browser/symbols-{1366,390}.png`.

Deploy the updated worker before the web preview. Existing completed videos are
immutable and require a fresh export after rollout; never alter an existing paid
request identity or silently regenerate old media. Local acceptance is distinct
from authenticated production acceptance.
