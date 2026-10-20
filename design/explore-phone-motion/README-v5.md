# Workflow 3 — iPhone Motion v5

Open `Explore Phone Cover — iPhone Motion v5.aep`. The main composition is nine
seconds, 960×540 at 24 fps (216 frames). The explicit local Explore preview uses
`creator-phone-v5.mp4` and its poster. Production catalogue gates are unchanged.

The supplied framed iPhone replaces v4's bare app panel in the opening, transfer
and loop return. It moves toward the creator's handset, hands off sharply to the
real moving footage at frame 73, then returns after the alternate example. The
charcoal stage, orange contours and three native kinetic phrases remain:
“Your app.” → “On their phone.” → “Create your video.”

## Image proportions and editable sources

- `Media/iphone-task-agenda.png` is the owner's unchanged 375×666 transparent PNG.
  Its SHA-256 is `CAF4216EDDBA87706325096F54E9FD24C60E3CD883D0D3AD58F68E634F2DA7DA`.
- `Phone v5 — Framed iPhone` contains that image and a native travelling edge
  light. The image uses equal 132.2% X/Y scale inside the 400×800 precomposition.
- `PHONE — framed transfer` uses uniform scale, position and native 3D rotation.
  Its Scale expression locks X, Y and Z together, including between keyframes.
  There is no Corner Pin or independent width/height scaling on the iPhone image.
  The main front-facing opening uses equal 53.5% scale.
- The first creator's physical phone is a different shape. The transition moves
  the intact mockup toward it, then cuts to the recorded handset; it does not warp
  the mockup to force an exact four-corner match. Manual placement requires review
  when replacing source footage.
- `Phone v5 — Captions` has six native text layers. Keywords automatically fit
  within 400 px; native position/opacity keys remain editable. Segoe UI Variable
  Bold Display is required. `CONTROLS — cover palette` exposes linked Accent and
  Stage colours.
- Both creator clips remain unchanged copies in `Media/`. Their scenes, reveal
  mattes, depth contour and return contour are separate editable elements.

The supplied iPhone's screen, bezel and chrome are raster artwork; those details
are not separately editable. The project contains 15 items, including v4's unused
app-screen reference. It is not used by the v5 cover. `native-project-v5.json` is
an additional native export; the `.aep` is the primary editing deliverable.

## Rendering and verification

Render the complete main comp with Best Settings and the installed output template
`H.264 - Match Render Settings - 40 Mbps`, then package from the repository root:

```powershell
node scripts/prepare-explore-phone-motion.mjs --render "path/to/native-render.mp4" --timeline design/explore-phone-motion/timeline-v5.json
```

The packager verifies frame count, size and rate, strips audio, checks full decode
and fast-start metadata, and creates a poster at 0.75 seconds. Copies are in
`Preview/`. The 1.22 MiB web video has zero adjacent duplicate frames. A 58-frame
review covers the opening, transfer, handoff, alternate example and return. At
360×202, mean loop RGB difference is 0.90/255, below the preceding frame difference
of 2.47/255. Native scale reads confirm equal axes at eight points through the
motion. AE reports no missing media or fonts. No footage blur or controls are used.

V4 and v3 projects/previews are preserved, with their notes in `README-v4.md` and
`README-v3.md`. Workflow 1's accepted v6 and other covers remain unchanged. This
is a local media review; authenticated production acceptance is not claimed.
Nothing was pushed or deployed.
