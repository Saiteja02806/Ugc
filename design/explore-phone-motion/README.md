# Workflow 3 — Cal AI v7

Open `Explore Phone Cover — Cal AI v7.aep`. The main composition is nine seconds,
960×540 at 24 fps (216 frames). The explicit local Explore preview uses
`creator-phone-v7.mp4` and its poster. Production catalogue gates are unchanged.

The supplied Cal AI framed iPhone moves toward the gym creator's filmed handset,
hands off sharply at frame 73, then returns after the unchanged Opal example.
The charcoal stage, orange accents and three native kinetic phrases remain:
“Your app.” → “On their phone.” → “Create your video.”
Decorative outlines and the travelling edge light stay disabled.

“Your app.” returns from 8.4 seconds and both words are fully visible by 8.8 seconds.
Matching caption positions and opacity carry readable text across the loop.

## Source assets and alignment

- `Media/creator-cal-ai.mp4` is an unchanged copy of the owner's
  `Editing_influencer_gym_video_ele…_20261003095132.mp4` (720×1280, 24 fps).
  SHA-256: `C18B64C60CA1D61F0942C81EB4C1249DDB7800060B24EC6B2104BBBD5FDC1FED`.
- `Media/iphone-cal-ai.png` is the unchanged transparent 375×666
  `Cal_AI_iPhone_Mockup_on_Dark_Studio_Background-removebg-preview.png`.
  SHA-256: `5EE7A5BF381B82341D48FC74FA59204571D9BCAE9BF62E793CECA80C0D18B062`.
- The creator presents the phone clearly around source seconds three to six.
  `Phone v7 — Creator one scene` plays source time = composition time + one second.
  It retains anchor [360,575], position [717,270] and equal 67.5% scale.
- At composition time three seconds (source four seconds), the main phone reaches
  position [639,314], equal 54% scale and 2.8° Z rotation. Frame 73 cuts to the
  filmed screen. This is a manual alignment, not motion tracking or a replacement
  inside the recorded handset. Replacing footage requires reviewing the pose.
- `Phone v7 — Framed Cal AI iPhone` uses equal 135.2% X/Y image scale in a 400×800
  precomp. `PHONE — framed transfer` locks X, Y and Z scale together through an
  expression. No Corner Pin or independent width/height scale affects the image.
- The second creator uses the unchanged `Media/creator-2.mp4` Opal footage.
  Its framing, timing and reveal remain as in v6.

## Editable project

`Phone v7 — Captions` has six native text layers, with position/opacity keys and
automatic keyword fitting within 400 px. Segoe UI Variable Bold Display is
required. `CONTROLS — cover palette` exposes linked Accent and Stage colours.
The supplied phone bezel and app UI remain raster artwork, not separate layers.

The project contains 17 items, including unused earlier task-list source references
retained for comparison. `native-project-v7.json` is an additional native export;
the `.aep` is the primary editing deliverable. V6 and earlier projects, previews
and versioned README files are preserved. Workflow 1's accepted v6 is unchanged.

## Rendering and verification

Render the complete main comp with Best Settings and the installed output template
`H.264 - Match Render Settings - 40 Mbps`, then package from the repository root:

```powershell
node scripts/prepare-explore-phone-motion.mjs --render "path/to/native-render.mp4" --timeline design/explore-phone-motion/timeline-v7.json
```

The packager verifies dimensions, frame rate and count, strips audio, checks full
decode and fast-start metadata, and creates a poster at 0.75 seconds. Copies are
in `Preview/`. The 1.06 MiB web render has no adjacent duplicate frames. A 58-frame
review covers the opening, transfer, handoff, alternate example and return. At
360×202, mean loop RGB difference is 1.54/255, below the preceding frame difference
of 4.34/255. Native reads confirm equal scale axes at six timeline positions and
both closing caption opacities at 100% at frame zero, 8.8 seconds, the last frame
and nine seconds. AE reports no missing media or fonts.

This is a local media review; authenticated production acceptance is not claimed.
Nothing was pushed or deployed.
