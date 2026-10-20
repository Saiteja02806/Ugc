# Workflow 3 — Clean Loop v6

Open `Explore Phone Cover — Clean Loop v6.aep`. The main composition is nine
seconds, 960×540 at 24 fps (216 frames). The explicit local Explore preview uses
`creator-phone-v6.mp4` and its poster. Production catalogue gates are unchanged.

The supplied framed iPhone moves toward the creator's handset, hands off sharply
to the real footage at frame 73, then returns after the alternate example. The
decorative outlines and travelling edge light are disabled. The charcoal stage,
orange keyword accents and three native kinetic phrases remain:
“Your app.” → “On their phone.” → “Create your video.”

“Your app.” returns from 8.4 seconds and both words are fully visible by 8.8 seconds.
The final frames and frame zero have matching caption position and opacity, so the
ending carries readable text across the nine-second boundary. The opening phone
keeps a small uniform drift, avoiding a frozen interval after removing the lines.

## Image proportions and editable sources

- `Media/iphone-task-agenda.png` is the owner's unchanged 375×666 transparent PNG.
  Its SHA-256 is `CAF4216EDDBA87706325096F54E9FD24C60E3CD883D0D3AD58F68E634F2DA7DA`.
- `Phone v6 — Framed iPhone` contains the supplied image and a disabled native
  edge-light layer. The image uses equal 132.2% X/Y scale inside its 400×800 precomp.
- `PHONE — framed transfer` uses uniform scale, position and native 3D rotation.
  Its Scale expression locks X, Y and Z together, including between keyframes.
  There is no Corner Pin or independent width/height scaling on the iPhone image.
  The main front-facing opening uses equal 53.5% scale.
- The first creator's physical phone is a different shape. The transition moves
  the intact mockup toward it, then cuts to the recorded handset; it does not warp
  the mockup to force an exact four-corner match. Manual placement requires review
  when replacing source footage.
- `Phone v6 — Captions` has six native text layers. Keywords automatically fit
  within 400 px; native position/opacity keys remain editable. Segoe UI Variable
  Bold Display is required. `CONTROLS — cover palette` exposes linked Accent and
  Stage colours.
- Both creator clips remain unchanged copies in `Media/`. Their scenes, reveal
  mattes and the disabled contour layers remain separate editable elements.

The supplied iPhone's screen, bezel and chrome are raster artwork; those details
are not separately editable. The project contains 15 items, including v4's unused
app-screen reference. It is not used by the v6 cover. `native-project-v6.json` is
an additional native export; the `.aep` is the primary editing deliverable.

## Rendering and verification

Render the complete main comp with Best Settings and the installed output template
`H.264 - Match Render Settings - 40 Mbps`, then package from the repository root:

```powershell
node scripts/prepare-explore-phone-motion.mjs --render "path/to/native-render.mp4" --timeline design/explore-phone-motion/timeline-v6.json
```

The packager verifies frame count, size and rate, strips audio, checks full decode
and fast-start metadata, and creates a poster at 0.75 seconds. Copies are in
`Preview/`. The 1.19 MiB web video has zero adjacent duplicate frames. A 58-frame
review covers the opening, transfer, handoff, alternate example and return. At
360×202, mean loop RGB difference is 0.94/255, below the preceding frame difference
of 2.44/255. Native reads confirm both input caption opacities are 100% at frame
zero, 8.8 seconds, the final frame and nine seconds. A longer keyword was rendered
in a temporary duplicate to verify editability and width fitting; the QA comps
were removed. AE reports no missing media or fonts. No footage blur or controls
are used.

V5, v4 and v3 projects/previews are preserved, with their notes in `README-v5.md`,
`README-v4.md` and `README-v3.md`. Workflow 1's accepted v6 remains unchanged. This
is a local media review; authenticated production acceptance is not claimed.
Nothing was pushed or deployed.
