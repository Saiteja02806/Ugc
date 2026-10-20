# Trending slideshow text controls

Trending → Edit creative previously offered copy changes with fixed type sizes;
Structure 2 movement was constrained horizontally and reduced to three vertical
positions on export. This change adds manual appearance and continuous placement.

## User flow

Select a slide, edit its existing text, then use Text appearance for its font,
heading/body sizes and colors. Drag its text group in the preview or use the
horizontal/vertical sliders; arrows provide keyboard movement. Reset text layout
removes the appearance override and centers the group. Save edit retains the
existing explicit save, background render and final-output confirmation flow.

Each slide keeps its own appearance. The complete text group stays on canvas.
Oversized copy shows a warning and is rejected before saving, without shrinking
the chosen font size or truncating the user's text. Unsupported glyphs fail with
a useful error rather than silently becoming missing-character boxes.

## Implementation

Optional, validated `textStyle` is serialized by the editor and API, merged into
owner-scoped content JSON and restored on reopening. No database schema change
or generation model/prompt change. Legacy absent styles keep existing renderers.

The browser and edit worker share font advances, line wrapping, group geometry,
color and normalized position. The worker uses bundled glyph outlines for manual
styles, avoiding reliance on system font names. It composites over the existing
background, then uses the existing immutable upload/readiness process. Style and
manual-renderer version participate in each slide's render fingerprint.

## Validation and rollout

Local coverage includes four fonts at both ratios, raster bounds, copy escaping,
no truncation/shrinking, existing render regressions, style-sensitive output reuse,
PATCH/merge/reopen behavior and actual-editor mouse/keyboard/mobile browser flows.
The browser fixture mocks authentication and API transport; it invokes the real
manual SVG renderer for saved output. No production content or schedules are made.

Final local checks: 61 focused tests pass, including image compositing and both
legacy renderers. Application TypeScript, worker compilation and scoped ESLint
pass. Actual-editor browser checks pass mouse/touch/keyboard placement, separate
slide styles, color/size/font changes, failed-save recovery, save/reopen and reset
at laptop/mobile sizes. Screenshots are local fixture evidence only.

Deploy the compatible Carousel edit worker before the website. This feature is
implemented locally and is not yet verified in authenticated production use.
