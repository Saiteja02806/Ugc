# AI character cover — Casting gallery

Planning study, October 3, 2026. This is a motion proposal using the owner's seven
images from `C:/Users/chund/OneDrive/Desktop/workflow/ai character`. It does not
change the Explore page, the character builder, credits, generation or availability.

## Purpose

Make the result recognizable within the first second: users can create a realistic
AI influencer, choose the creator they prefer and save that influencer. The existing
card already explains the destination, but its three static portraits do not show
the choice or the result. The cover should use portrait movement to explain that.

The character builder creates images. The study animates portrait surfaces rather
than inventing talking footage or showing different people as identity variations.
The supplied portraits are illustrative examples, not results from a live request.

## Recommended nine-second sequence

| Time | Picture | Copy |
| --- | --- | --- |
| 0–2 s | A large portrait is already visible, with two other creators sitting behind it. Small, continuous movement keeps the opening alive. | Your next AI creator. |
| 2–4.2 s | The portraits spread into a gallery. Additional supplied faces enter through the moving strip; preserve each image's original proportions. | Build your AI creator. |
| 4.2–6.2 s | The chosen portrait moves to the centre and grows while the alternatives move outward. This selection is the main visual moment. | Choose your creator. |
| 6.2–8 s | The selected creator occupies a substantial portrait on the left. The copy moves into the space on the right. | Make it yours. / Save your influencer. |
| 8–9 s | The selected portrait returns to the opening arrangement as the supporting portraits rejoin it. Opening copy returns in time for the next loop. | Your next AI creator. |

## Design decisions

- Use the existing Explore charcoal `#1f1f1f`, neutral dark card surface `#282828`,
  white `#f4f4f2`, orange `#ff7045` and muted grey `#b8b8b3`.
- Use Geist Sans for the display and supporting copy, matching the interface.
  Give the main words scale and weight; keep each phrase brief enough for a small card.
- The signature is one portrait becoming the selected creator as the gallery
  moves around it. The motion has a clear purpose instead of adding decorations.
- The supplied images remain intact. Use uniform scale and gentle Z rotation;
  there is no face morph, image blur, decorative outline, phone frame or stretching.
- Keep faces and microphones clear. Full portrait cards may move partially beyond
  the canvas edge while entering, but settled hero views should show the subject.
- Keep the video silent, continuously looping and without playback controls.
- Retain the card's Create yours action and `/explore/build-character` destination.
  Review the proposed 16:9 media area at the existing lower-row width; do not expand
  the entire lower section simply to make the video larger.
- Preserve the three-portrait static card as the fallback and reduced-motion view.

## After Effects implementation

Build a new, independent 960×540, 24 fps, nine-second project. Import unchanged
source images into a labelled media folder. Use separate portrait precomps,
native position/scale/rotation keys, shared palette controls and six to eight
native text layers. Native text masks reveal whole phrases as the picture changes.

Use sparse eased keyframes to spread, select and return the portrait surfaces.
Keep image X/Y scale equal. A modest perspective offset can separate the supporting
portraits, but the selected creator stays nearly front-facing and readable.
Do not imply instantaneous real generation with a fake progress bar or stopwatch.

Render and review the entire loop, plus the first/final frames and every settled
pose at the actual small-card size. Confirm caption legibility, face framing,
silent output, 216 frames, complete decode and a smooth loop before connecting
the cover to the explicit local Explore preview. Hosted acceptance is a separate
release check. Existing workflows and production gates remain unchanged.

## Planning deliverable

`ai-character-casting-motion.html` in the thread's visualization directory is an
animated composition study, not an After Effects render or a finished video. It
uses small embedded previews of all seven supplied portraits. The intended full
render should use the original source files.
