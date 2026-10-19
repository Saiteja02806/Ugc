# Carousel body styling and history editing

Trending Carousel Edit now shares changed styling fields and placement across
body slides by default, keeping the hook separate. The selected slide's copy
and image never become another slide's copy/image. Shared typography wraps each
slide's own content. Users can copy a complete layout to shared body slides.

Switching off shared styling and making an individual adjustment protects that
slide with persisted `textStyle.bodyStyleMode: individual`. Future shared changes
and full-layout copies skip it. Existing saved manual styles without the marker
are also protected. Explicitly enabling shared styling on that slide rejoins it.
Copy-only editing never propagates. Overflow is listed with individual Review
actions instead of automatically shrinking or rewriting text.

Manual placement uses canvas bounds, without the former 96px safe inset. Sliders
cover the entire permitted travel range and dragging/keyboard movement use the
same bounds. A corner request remains a corner for each slide's differently sized
text group. Glyph/panel extents still stay inside the image. Unchanged historical
styles keep their old placement; the new renderer version invalidates stale
manual render fingerprints on a new save.

## Disabled Edit on edited history

The UI disabled Edit whenever review history was active. Existing edited Carousel
history now permits click/E to reopen. Ownership, creative and assignment checks
remain; terminal history also requires an existing saved edit for that assignment.
Unedited history and other formats retain their existing restrictions.

The production trigger was inspected read-only and has a corresponding restriction.
The local migration permits only UPDATE of an existing Carousel edit whose owned
assignment is completed_skipped, completed_saved or completed_scheduled. It retains
immutable scope, revision and source guards. It neither unskips an assignment nor
changes a stored schedule. New inserts into historical assignments remain blocked.

## Validation

- 99 focused checks pass: 62 renderer/worker, 19 style/persistence/containment,
  and 18 history/decision/local-database checks. Worker compilation, application
  TypeScript, scoped ESLint and the actual-editor browser suite pass.
- Shared/manual override, legacy protection, complete-layout reuse, per-slide
  wrapping, copy/media/identity preservation and one/two/five/ten-slide checks.
- Worker/browser geometry, both canvas formats/corners and raster containment
  checked on a larger canvas so ordinary SVG clipping cannot hide lost pixels.
- Actual editor browser fixture verifies default sharing, a manual override,
  save/reopen and another shared change, then explicit rejoining. Hook and copies
  remain unchanged. It also checks existing library/save/error/touch behavior.
- Local PostgreSQL PGlite runs the original trigger (reproducing rejection), then
  the migration, followed by terminal-history revisions and negative cases for
  new inserts, foreign scope, revision regression, unsupported state and Hook/Wall.
- UI gate and handler checks verify existing edited Carousel history versus
  unedited/other-format history and transitions. Production DOM was not inspected.
- Body-scope controls fit at 1366×768, 1536×864 and 390×844 at normal zoom.
  Other zoom settings and authenticated production acceptance remain untested.

No deployment or production data mutation. Deployment must include migration,
worker and website; local validation does not establish live acceptance.
