# Workflow 3 — Screen to Creator v4

Open `Explore Phone Cover — Screen to Creator v4.aep`. The main composition has
nine seconds at 960×540, 24 fps (216 frames). The explicit local Explore preview
uses `creator-phone-v4.mp4`; production availability gates are unchanged.

The motion follows one story: your app surface enters, moves into the real
creator's handset, and hands off to the creator video. A short alternate example
appears without repeating the headline. The final handset contour turns edge-on
and returns the app surface to the opening pose. The surrounding stage matches
Explore's charcoal and orange palette. There is no footage blur, sound, still hold
or playback control in the cover.

## Editable sources

- `Phone v4 — App surface` contains the supplied screenshot, editable screen
  backing, clock, home indicator, edge and travelling accent. The screenshot itself
  is raster artwork, 326×637. It is packaged unchanged as `Media/app-screen.jpg`.
- `Phone v4 — Captions` has six native text layers for the three phrases. Keyword
  scale automatically fits its rendered width within 400 px. Position and opacity
  have native keys; changing the wording does not replace those keys.
- `CONTROLS — cover palette` in the main comp exposes Accent and Stage colours.
  Accent is linked to the keyword fills and orange contours.
- `Phone v4 — Creator one scene` and `Phone v4 — Creator two scene` have independent
  replaceable footage. The source clips remain unmodified copies in `Media/`.
- The main comp has ten semantic layers. `APP — screen transfer` uses native
  Corner Pin keys, with a separate depth contour and return handset contour.
  The two native rectangle mattes reveal the creator scenes. The project contains
  this workflow and its dependencies only, with no temporary editability comps.

`timeline-v4.json` documents source offsets, framing and caption intervals.
Alignment is manual, not automatically tracked. Replacing the creator clips
requires reframing and realigning the four screen corners and return contour.
The screenshot's UI is the actual supplied asset, not a native reconstruction.
The visible clock, screen container, typography and contours remain editable.
Segoe UI Variable Bold Display is required; AE reports no missing fonts or media.

The clean surface reaches the first handset at three seconds. At frame 73
(3.0417 s), the cover cuts sharply to the recorded screen, avoiding a crossfade
that would double the app's text. The two supplied examples show different apps;
the edge-on return conceals that change rather than suggesting an identical screen.
There is no appended demo because no matching demo was supplied for these examples.

## Rendering

Render the complete main comp with Best Settings and the installed output template
`H.264 - Match Render Settings - 40 Mbps`, then package from the repository root:

```powershell
node scripts/prepare-explore-phone-motion.mjs --render "path/to/native-render.mp4" --timeline design/explore-phone-motion/timeline-v4.json
```

The script verifies frame count, dimensions and frame rate, strips audio, checks
full decode and fast-start metadata, writes a poster at 0.75 seconds, and copies
the web video and poster to `Preview/`. `native-project-v4.json` is an additional
native project export. The `.aep` remains the primary editing deliverable.

## Verification and return paths

All 54 frames of the short transfer render were inspected at card size. A separate
58-frame review covers the complete entrance, transfer, caption boundaries, alternate
example and loop. The 1.19 MiB web video is 216 frames with no audio and zero adjacent
duplicate frames. At 360×202, the seam's mean RGB difference is 0.67/255, below the
preceding frame difference of 1.64/255. A temporary longer keyword (`app demo.`)
and blue Accent render verified fitting and linked colours, then the original text
and warm orange palette were restored.

The rejected v3 is preserved in its own project and preview, with its notes in
`README-v3.md`. `Archive/` includes backups before v4 construction and cleanup.
Workflow 1's accepted v6 and all other covers are unchanged. Current production
browser acceptance is not claimed. Nothing was pushed or deployed.
