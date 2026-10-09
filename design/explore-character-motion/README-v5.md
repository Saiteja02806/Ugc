# AI character cover — Brand Motion v5

Approved by the user on 2026-10-03 for the Explore AI character cover. Use this iteration as the design baseline, including Geist/orange captions, the supplied transparent cutout, and the aligned seven-image lineup.

Open **Explore AI Character — Brand Motion v5.aep**, main composition **AI Character v5 — Brand Motion**. This is the current local Explore cover. Earlier v2/v3/v4 files and compositions remain available.

The revision uses the site's Geist font, #ff7045 orange, #f5f3f0 text and #1f1f1f background. Captions reveal word by word. A native outline-to-fill YOURS motif travels behind the supplied transparent person; galleries enter in depth and fan into the closing lineup. All seven images are independent reference examples. The final lineup has a common 330-pixel height and aligned edges; aspect ratios stay natural.

## Media and editing

- Preview/v5/ai-character-v5.mp4: silent 960×540, 24 fps, 16 seconds, 384 frames; compressed web copy of the native AE delivery.
- Preview/v5/ai-character-v5-master-delivery.mp4: AE Best Settings, H.264 Match Render Settings at 15 Mbps.
- Preview/v5/preview.html: continuous review player.
- Preview/v5/storyboard-v5.jpg: timed visual review.
- Media/v5: seven original images and the user-supplied transparent subject, copied unchanged.
- Fonts/Geist: Regular, Medium and SemiBold, with SIL OFL license.

Edit CAPTION layers inside V5 SCENE compositions. The native Range Selector on each caption controls the staggered word reveal without replacing Source Text. GRAPHIC TYPE — YOURS has a separate fill-opacity animator. SUBJECT uses the supplied alpha PNG directly; the rough V4 silhouette mask is absent. Image scale has equal X/Y values. The native gradient only darkens the lower region for caption readability.

The last transition returns to a frozen first frame using native Time Remap; the opening word reveal then begins again at the loop boundary. No expressions or proprietary effects are required. Geist was made available in the Windows user font folder for AE; packaged licensed copies support handoff. native-project-v5.json is an inspection snapshot: the bridge does not serialize all text-selector internals or temporal easing. The AEP is the authoritative editable motion source, with word-reveal-specs-v5.json recording the caption timing.

## Verification

The delivered movie fully decodes, contains no audio, has fast-start metadata and no blank frames. Representative transition, silhouette, caption and loop frames were reviewed. Font and media dependency checks pass. A temporary duplicate verified native caption content editing, then was removed. Local browser checks cover desktop/mobile sizing, autoplay, looping, absence of controls, reduced-motion poster behavior and the existing builder navigation. TypeScript passes. Explore remains hidden in production; this revision is local and was not deployed.
