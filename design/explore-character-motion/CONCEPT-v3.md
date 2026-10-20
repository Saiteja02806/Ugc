# AI character — Identity in Motion

This iteration replaces the v2 sliced portrait, repeated photo wall, Impact headlines and wipe cuts with one connected studio scene. The same intact portrait comes forward, unfolds into three distinct editorial content designs, then gathers back into the original identity. Physical camera travel and individually staged native 3D planes connect the sequence.

The supplied After Effects notes informed the construction: null parenting (page 34), deliberate keyframe velocity and easing (pages 35–38), reusable precompositions (pages 39–40), camera movement and depth (pages 42–52), and native mask/matte construction (pages 60–66). The book supplies fundamentals; this layout, palette, wording and choreography are our original design choices. The example is not a copy of a tutorial or the earlier phone film.

## Story

| Time | Copy | Visual action |
| --- | --- | --- |
| 0–3 s | Create your own character. | An intact portrait comes forward. A short character description appears above it. |
| 3–6.55 s | One character. More possibilities. | Two individually designed content surfaces unfold from behind the portrait as the camera pulls back. The portrait acquires its own editorial caption. |
| 6.55–9.82 s | Make your content recognizable. | A closer camera position and coordinated rotations turn the collection into a portfolio. |
| 9.82–12 s | Create your own character. | The two outer surfaces fold behind the original portrait. The opening caption returns before the movement finishes, and the final pose matches the opening. |

Palette: charcoal #1F1F1F, paper #F6EFE2, orange #FF7045, sage #B8CEBD, ink #26352E. Georgia and Georgia Italic provide the editorial emphasis; Segoe UI provides supporting text. The small brief is supplementary; the main phrases carry the explanation at cover size.

## Actual content and limits

The illustration uses the supplied `Cozy Bedroom Vlog Selfie.png`, 941×1672, copied unchanged to `Media/creator-primary.png`. All photographic scales retain equal X/Y values. Perspective comes from native 3D rotations and camera projection. Rounded mattes and content crops preserve the face; no sliced-face construction, stretching or blurred filler backgrounds are used. Brief motion blur occurs only during movement.

The three layouts reuse one supplied still photograph. They are illustrative content designs, not separately generated videos, evidence of a new pose, automatic publishing or a promise of views. The film itself is motion graphics made from that still. The Explore generation workflow and other covers are unchanged.

## Native editing

- Open `Explore AI Character — Identity in Motion v3.aep`. Main composition: `AI Character v3 — Identity in Motion`.
- Replace `MEDIA — supplied creator — replace identity here` to update the identity across all three designs. A different source aspect ratio needs a crop check in the three content compositions.
- Edit the native `COPY — …` layers in the cover or individual content compositions. Header width fitting scales uniformly and leaves Source Text editable.
- `CONTROLS — Identity palette` owns Stage, Paper, Accent, Sage and Ink. `Depth strength (%)` controls the artwork Z distances: 100 is the authored scene, 0 makes those artwork distances zero. It does not remove the camera travel or rotations.
- `RIG — camera travel` owns the camera translation. `CAMERA — continuous studio move` has a fixed 1200-pixel Zoom, manual orientation and a small authored roll. The camera has no depth-of-field blur.
- The main composition and content precompositions remain native and editable. Keep the AEP and Media folder together. System fonts are required; no optional AE plugins or redistributed font files are needed.
- v1 and v2 projects and previews remain available as separate return points.

## Verified delivery

Native full render: Best Settings, `H.264 - Match Render Settings - 15 Mbps`, 960×540, square pixels, 24 fps, 288 frames, 12 seconds. `Preview/v3/ai-character-v3-master-final.mp4` is the native render; `Preview/v3/ai-character-v3.mp4` is the silent web preview. The packaged preview passed a full decode and fast-start check.

The native project contains 4 compositions, 32 layers, 16 editable text layers, 3 artwork planes, and 209 sparse numeric keys. No frame-by-frame key baking was used. The export reports no expression failures or missing footage; live AE reports no missing fonts. A temporary duplicate successfully rendered a much longer headline with uniform fitting and the artwork-depth control at zero. It was removed and authored values were restored.

Representative native frames and a 24-frame decoded storyboard cover the opening, unfolding, settled portfolio, return and both ends of the seam. The unfold timing was corrected to keep the emerging headline clear of the portrait, the left content was repositioned to retain its caption, and the return caption was advanced to avoid a blank text beat. Browser verification checks silent autoplay, an actual end-to-start repeat, absence of controls, and 1000/400/360-pixel viewports. These are preview checks; aesthetic acceptance remains with the user.

Repackage the final native render without touching the earlier previews:

```powershell
node scripts/prepare-explore-character-motion.mjs --render "design/explore-character-motion/Preview/v3/ai-character-v3-master-final.mp4" --version 3
```
