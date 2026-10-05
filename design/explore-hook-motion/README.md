# Explore hook cover — Editorial motion

## Current version: v6, coordinated native panels and type

Open `Explore Hook Cover — Editorial Motion v6.aep`, main composition
`Explore Hook Cover — Motion v6`. V5 remains preserved as a separate project
and cover. V6 is the first workflow's explicit local Explore preview.

The 960×540, 24 fps, 404-frame loop now uses four packaged source videos in
`Media/v6`: three creators and the real demo. `60 Media sequence — editable v6`
contains named opening, demo, individual examples, horizontal strips and
diagonal-return precomps. Each creator is independent; replacing its SOURCE
item updates that creator's appearances. The current framing assumes the
supplied 720×1280 portrait footage. Reframe different source dimensions and
check their length before replacing them.

The opening spans 0–4 seconds. Its panels settle over 15 frames while the
native serif title builds in phrases: the hook fills from outline over frames
8–22 and the video suffix arrives over frames 15–22. The actual demo and its
caption begin together at frame 96 (4 seconds), with a six-frame sharp diagonal
reveal. The caption moves 28px with that reveal. The demo lasts exactly 60 frames
and both footage and caption finish at 6.5 seconds.

The final horizontal strips turn into a diagonal triptych. One `Diagonal return`
slider, 0–100 percent, drives shared partition lines and source fitting, keeping
the cover filled at intermediate poses. `Panel settle`, also 0–100 percent,
controls the opening. These are native keyed sliders with small geometry
expressions. Closing Position values act as additional framing offsets; Scale
values act as percentages of the automatic fit. The source clips keep moving
throughout. Closing footage ends at source frame 31 and the opening follows at
source frame 32 with matching geometry and framing.

The project uses 58 numeric keys, native text, sharp masks and Linear Wipe.
The bottom contrast shade is a separate native layer; it never blurs footage.
Fonts are Bodoni MT Black Italic, Georgia Italic and Georgia, as listed below.
There is no added sound or playback control on the cover.

After rendering the current main comp with Best Settings and
H.264 - Match Render Settings - 40 Mbps, prepare the web version:

```powershell
node scripts/prepare-explore-hook-motion.mjs --render 'C:\absolute\path\native-v6-final.mp4' --version v6 --timeline design/explore-hook-motion/timeline-v6.json
```

The prepared silent MP4 is approximately 2.74 MiB, fast start, 404 frames and
passes a full decode with zero adjacent duplicate frames. The final card-size
review checked cue boundaries, moving masks and the loop seam. At 160×90, the
mean grayscale difference across the seam was 2.49/255, comparable to 2.42/255
between the preceding two frames. A longer keyword was rendered in a temporary
duplicate, verifying that the video suffix follows the edited word. No missing
fonts or media were reported. Scoped ESLint and 85 workflow/catalogue checks
passed. Browser acceptance is not claimed; media and code verification are
complete. This version has not been deployed.

## Previous version: v5, immediate real demonstration

Open `Explore Hook Cover — Editorial Motion v5.aep`. The main composition is
`Explore Hook Cover — Motion v5`. The earlier v4 source and media are preserved.
Both versions run at 960×540, 24 fps, 404 frames (16.83 seconds).

The current sequence starts with the talking-hook title for **0–4 seconds**.
The real demo and `Add your own demo` follow immediately at **4–6.5 seconds**,
exactly 60 frames. The remaining creator examples, horizontal triptych and
diagonal return follow afterward. This removes v4's 6.29-second caption gap.
The source demo excerpt is unchanged; the uncaptioned montage is reordered at
exact frame cuts before the titles are rendered.

The demo's lead phrase is readable immediately, and the keyword fills from
outline to solid teal over 0.4 seconds. The opening keyword retains its
half-second ink reveal. Both keywords now have a 2px outline, helping the
entrance survive reduction to a 360px-wide card. They share the same lower-left
baseline and restrained scale settle. Native titles use 30 numeric keyframes
and the existing spacing expression. They remain editable using the fonts
listed below. No additional effects or footage blur are used.

`Media/cover-plate-v5.mp4` is the current composition's media. Its uncaptioned
source is packaged as `Media/example-montage-v4.mp4`. To rebuild the plate:

```powershell
node scripts/prepare-explore-hook-motion-plate.mjs --source design/explore-hook-motion/Media/example-montage-v4.mp4
```

After rendering the main v5 composition with the settings below, prepare it:

```powershell
node scripts/prepare-explore-hook-motion.mjs --render 'C:\absolute\path\native-v5-master.mp4' --version v5 --timeline design/explore-hook-motion/timeline-v5.json
```

This writes `public/explore/covers/create-hook-v5.{mp4,webp,json}` and copies the
MP4 and poster into `Preview`. The local Explore registry uses v5. The final
render is approximately 2.57 MiB, silent, and passes a complete decode. Its
entering, settled and exiting frames were inspected at 360×202 to review the
actual card scale. All 404 frames are present with zero adjacent duplicates.
Scoped ESLint and all 81 current workflow and catalogue checks passed.

## Previous version: v4

This is the editable After Effects source for the first workflow's local Explore
cover. The supplied Higgsfield recording informed the staged type entrance and
color emphasis. The finished artwork uses the project's footage and an editorial
serif direction.

Open `Explore Hook Cover — Editorial Motion v4.aep`. The main composition is
`Explore Hook Cover — Motion v4` (960×540, 24 fps, 404 frames / 16.83 seconds).
`Media/cover-plate.mp4` is packaged beside the project. If After Effects requests
a missing-media location after moving the folder, relink that file.

## Editing the titles

- `01 Hook title — Editorial motion`: editable `Create a talking`, `hook`, and
  `video` text layers. The suffix follows the keyword width through a position
  expression; changing `hook` to another short word preserves the spacing.
- `02 Demo title — Editorial motion`: editable `Add your own` and `demo` layers.
- Keywords use **Bodoni MT Black Italic** (`BodoniMTBlack-Italic`). Supporting
  text uses **Georgia Italic** and **Georgia**. These are installed fonts on the
  author's machine; no font files are included. Install the same fonts before
  editing on another machine to retain the design. The rendered MP4 needs no
  fonts installed.

The native range selectors reveal the lead text with a 14-pixel rise and reveal
the keyword from outline to solid fill over half a second. The keyword settles
from 94% to 100% scale without an overshoot. Both cues fade inside their intervals.
There are 35 numeric keyframes and one spacing expression. No third-party effects
are required.

The opening caption occupies 0.25–4.5 seconds. The real demo and its caption
occupy exactly frames 259–318 (10.7917–13.2917 seconds, 2.5 seconds). The plate retains
the existing edge-to-edge crops and continuously moving montage. A bottom
contrast gradient is baked into the plate around the two caption cues.
It adds no blur to the footage.

## Rendering and preparing the web version

Render the main composition with **Best Settings** and
**H.264 - Match Render Settings - 40 Mbps**, using the complete composition.
From the repository root, pass the finished render to:

```powershell
node scripts/prepare-explore-hook-motion.mjs --render 'C:\absolute\path\native-master.mp4'
```

The preparation script validates resolution, frame count and frame rate,
removes audio, creates an optimized fast-start MP4 and a 1.25-second poster,
and decodes the entire result before accepting it. It updates
`public/explore/covers/create-hook-v4.{mp4,webp,json}` and copies the media into
this folder's `Preview` directory. The prior `create-hook-v3.json` supplies the
montage metadata, so run the script from the repository containing that file.

The local registry points to the current version only for `/explore?preview=1`. This pass does
not release the preview catalogue to production.

## Verification

The native render completed in After Effects. Entering and settled title
frames, both cue boundaries, and a real source-text change were inspected.
Changing `hook` to `demo` in a temporary duplicate retained the keyword motion
and moved `video` to the new width; the temporary duplicate was then removed.
No missing or substituted fonts were found. The optimized output is silent,
404 frames at 24 fps, 960×540, approximately 2.52 MiB, and passes a full decode.
