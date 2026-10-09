# Explore slideshow UI follow-up

Implementation based on main commit
`7076bd4bc1e2f4699dcc624ff6c1c54d0b134612`, included in the complete Explore
follow-up release. Production deployment is verified separately against the
exact merged commit.

## Behavior

- All three format workflows use the existing talking-head/creator-phone sidebar,
  section tabs, instruction field, settings rows and common footer.
- Slideshows Create browses only slideshow references or uploads an ordered set
  of 2–10 JPEG, PNG or WebP images. Image models, aspect ratio and quantity remain
  available. Each generation recreates the selected slide; results open in Your
  Slides and chosen results can replace that slide in Edit slides.
- Edit slides supports reordering, removal, restoration, heading/body text,
  fonts, sizes, colors, alignment, position, opacity and SVG background presets.
  Preview and PNG export use the same vector overlay. Added text does not erase
  text already baked into the original image.
- Edited images are uploaded through the existing owner-checked media flow.
  Saving freezes the resolved images and request key before the idempotent
  Library call. Scheduling receives only the confirmed saved sequence.
- Existing larger references stay visible; users must explicitly choose no more
  than 10 images for saving. The save endpoint accepts ordered subsets and owned
  uploaded images, without trusting client-supplied output URLs.
- A bounded, same-origin image endpoint resolves only known catalogue or owned
  ready raster images. This fixes browser canvas exports blocked by storage CORS.
  Production access is authenticated; guest catalogue preview is development-only.
- Your Video empty states are centered across the preview panel. A single
  Instagram platform choice is limited to a 128 px tile.

## Verification

- TypeScript: `npx tsc --noEmit --incremental false` passed.
- Targeted ESLint across changed TS/TSX files passed without warnings.
- 41 offline checks passed across slideshow text/export, save and image delivery
  APIs, editor save/retry behavior, generation request wiring, existing video
  imports and the local PGlite Library save contract.
- Browser checks used the release checkout at `http://localhost:4200` in preview.
  Desktop and 390 px mobile screens fit without horizontal document overflow.
  The Hook and Wall of text empty states matched their full preview panel center.
- Two local images uploaded in preview and opened in Edit slides. A real browser
  PNG export preserved the original 540×960 image and contained added white text
  plus the dark background shape. A gallery image also exported at 1080×1350 after
  the CORS fix. The one-platform scheduling tile measured 128 px.
- Screenshots are in the workspace's ignored `.tmp/slideshow-ui-audit-20261008/`.

No generation provider request, production Library mutation or publishing action
was executed. Generation and authenticated saving checks used mocked requests;
live generation and production acceptance have not been run for this follow-up.
