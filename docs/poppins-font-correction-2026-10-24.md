# Poppins font and outline correction

24 October 2026. Local implementation; no deployment or hosted acceptance yet.

## Accepted default follow-up

The user accepts this appearance and asks to keep it by default. A shared
`DEFAULT_FORMAT_TEXT_STYLE` now initializes new manual workflow captions and
new Hook/Wall Remix text when no previous text style exists: Poppins 700, white
fill, black outline 8 (about 2.4px at 324px display width). Existing saved styles
and Remix over an existing styled caption retain that style. Font size/placement
and timing follow their existing workflow rules. Other available families and
presets remain selectable; slideshow typography defaults are independent.

The follow-up checks include a new caption created in the actual browser editor,
Save/reload and explicit selection of that saved block, new Wall captions,
initial Remix defaults, and preservation of existing/legacy custom styles.
All 71 targeted default/editor/draft/export checks and the desktop/mobile Edge
fixture pass. Worker build and scoped ESLint pass for the default follow-up.

## User correction and visual comparison

The user rejects the TikTok Sans preview and supplies Poppins Bold 700 as the
closer match, with white fill, a black outline around 2–3 pixels at screenshot
size, normal letter spacing and no shadow. A direct browser comparison shows the
original crop and actual Poppins/TikTok Sans faces using the same size/outline.
Poppins has a closer width and geometric letter shape. The small raster crop
still cannot establish the original family definitively.

The first preview also had a thinner outline than requested: the legacy 2px
stroke on the 1080px canvas displays at only 0.6px at 324px width. Changing just
the font would not reproduce the supplied appearance.

## Implementation

- Poppins Regular/Medium/Bold are added to the shared manual font selector. The
  existing TikTok Sans and other families remain selectable for saved choices.
- Source files are pinned to Google Fonts revision
  `1d0e46c7933245c8180fe83e47917961c913bbdb`, under `ofl/poppins/`, using actual
  `Poppins-Regular.ttf`, `Poppins-Medium.ttf` and `Poppins-Bold.ttf`. The official
  project is [Indian Type Foundry Poppins](https://github.com/itfoundry/Poppins);
  [Google Fonts distribution](https://github.com/google/fonts/tree/main/ofl/poppins).
  OFL licenses are bundled for browser and worker. Per-face source/output hashes
  are recorded in `worker/src/assets/fonts/explore-text/manifest.json`.
- The font builder supports the static faces without synthesizing their weights.
  Poppins Bold source SHA-256:
  `983676516167748b74de6f4771fb384c664fd913acb8b471122ecacf5da5ea6c`.
  All previously bundled font manifest/metric entries remain unchanged.
- Hook/Wall text styling gains an Outline thickness slider, saved as optional
  `outlineWidth` (finite 0–16 on the current 1080px edit canvas). A value of 8
  produces a 2.4px stroke in a 324px-wide preview. Fill/color and weight controls
  remain separate. No shadow or letter-spacing effect is added.
- The parser omits unset outlineWidth, preserving old saved draft/fingerprint
  shapes and the legacy default stroke. Explicit values survive blank drafts,
  Save/reopen and preset switches. Snapchat Classic still suppresses the outline.
- Browser React preview, SVG preview and worker outlined glyphs use the same
  scaled stroke. Explicit outline changes for Original/Arial also enter the
  outlined rendering path; untouched Arial edits retain the old drawtext path.
- Shared manual slideshow controls inherit the Poppins family. Slideshow outline
  schema and automated generation typography remain independent.

## Verification

- All 68 targeted render/editor tests pass, including actual Poppins video export,
  the manual slideshow renderer and the Unicode/final-composition regressions.
  Worker build, application TypeScript and scoped ESLint also pass.
- Local Edge checks cover all eighteen font/weight faces and save/reopen. Poppins
  Bold with outline 8 survives a reload and visibly renders on 1366×768 and
  390×844 previews. Font bytes are loaded from the actual bundled face; there is
  no OS-font substitution. Tests inspect white fill, black stroke, exact copy,
  responsive fit, drag/touch, presets and Wall's advanced controls.
- Real FFmpeg video export tests verify Poppins Bold's multiline glyph pixels,
  the saved black outline and caption timing after serialization/reopening. A
  neutral gray video separates black stroke from its background without YUV420
  blue chroma contaminating thin edge pixels during RGB checks. This avoids an
  invalid all-RGB-channels assertion on highly saturated blue footage.
- Parser tests reject negative, oversized, string, null and nonfinite thickness;
  test 0/8/16 and legacy omission; and verify both explicit Arial and Poppins
  outline edits reach the actual render pipeline. Existing manual slideshow,
  draft, clip-control, Unicode and final-composition tests are included.
- Worker build, application TypeScript and scoped ESLint are checked separately.

Browser comparison evidence is generated by setting `FONT_REFERENCE_CROP` to the
original local PNG when running `node scripts/explore-text-fonts.browser.cjs`.
It is kept in ignored
`.tmp/explore-text-fonts-browser/poppins-reference-comparison.png`, alongside
`poppins-1366.png`, `poppins-390.png` and `poppins-preview-1366.png`.

Deployment must include worker TTF assets/parser changes before the website can
submit the newly supported family/outline field. These local fixtures do not
replace authenticated acceptance at `https://www.getugcpilot.com`.
