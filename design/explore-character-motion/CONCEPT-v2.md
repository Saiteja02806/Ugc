# AI character cover — Build, Use, Grow

The previous casting gallery felt too similar to the phone workflow. This iteration uses a kinetic poster direction: condensed display type, a portrait assembled from three moving parts, a continuous wall of the same identity, and a circular creator stamp. The story stays focused on building one character and using it in content.

## Story and timing

| Time | Message | Motion |
| --- | --- | --- |
| 0–3 s | Build your AI character. Your own AI influencer. | Three portrait segments assemble while native text reveals progressively. |
| 3–6.5 s | One character. Your content. Use it in your content. | A horizontal portrait wall moves continuously. Caption words arrive separately. |
| 6.5–9.5 s | Grow your presence. Your creator. | Large words enter with restrained overshoot; the same face arrives as a circular stamp. |
| 9.5–12 s | Return to Build | The portrait assembles again. Text retracts toward the initial pose for the repeat. |

Three short diagonal orange wipes cover the scene cuts. The palette follows Explore: charcoal #1f1f1f, warm white #f4f4f2 and orange #ff7045. Display type is Impact; supporting text is Segoe UI Variable Bold Display. The headline hierarchy remains readable when the 960×540 master is displayed at cover size.

## Source and interpretation

The supplied folder contains seven different portraits. This cover deliberately repeats one portrait to communicate one recurring creator. The repeated wall is an illustration of reuse; it does not claim these are separately generated videos or automatically published posts. “Grow your presence” describes the intended use rather than promising a view count.

Source: `C:/Users/chund/OneDrive/Desktop/workflow/ai character/Cozy Bedroom Vlog Selfie.png`, 941×1672. An unchanged copy is included at `Media/creator-primary.png`.

SHA-256: `D1F2068382D9BD662828C5FD20B67261E8463C6870D3F3EA51A6C6AB50F9D1A7`.

This is motion made from the supplied still portrait. No talking-character footage or additional imagery was generated. Portrait transforms use equal X/Y scale. Image cropping is by named native masks; no blurred duplicate backgrounds are used.

## Editability and delivery

- Open `Explore AI Character — Build Use Grow v2.aep`; the main composition has the same name.
- Change the supplied identity in `Character v2 — Portrait source` by replacing `PHOTO — replace this creator` with artwork of the same aspect ratio. Other aspect ratios require checking the portrait crop.
- Edit native `COPY — …` layers in Build, Use and Presence poster compositions. Uniform text fitting prevents the headline from crossing its allotted width.
- Change Accent, Stage and Paper on `CONTROLS — character cover palette` in the main composition. Named text animators and native Fill effects read those controls.
- Keep the AEP and Media folder together. The JSON export records the native structure and source references.
- `Preview/ai-character-v2.mp4` is the delivery preview. `Preview/preview.html` provides silent autoplay and repetition without controls. The MP4 itself contains no audio.

Validation: complete native AE render, 288 frames at 24 fps, 12 seconds, 960×540. The packaged MP4 passed a complete decode and fast-start verification. Review stills cover the entrances, settled poses, all three cuts and the final loop pose. A longer native headline (“RECOGNITION.”) was tested in a temporary duplicate, rendered successfully with uniform fitting, and the duplicate was removed. After Effects reported no missing fonts or footage. The initial crop and an empty entrance beat were corrected before final delivery.

This iteration is an independent motion preview. It does not replace the Explore production card or change the character-generation workflow.

Repackage a completed native render with:

```powershell
node scripts/prepare-explore-character-motion.mjs --render "design/explore-character-motion/Preview/ai-character-v2-master-final.mp4"
```

The v1 casting concept and earlier studies remain available for comparison.
