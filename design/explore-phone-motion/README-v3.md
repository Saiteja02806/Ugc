# Workflow 3 — Product Motion v3

**Review status: rejected by the owner.** The light stage did not fit dark Explore,
the two creator examples repeated the same message, and the card slides did not
explain the workflow through motion. The local preview has been restored to v2.
Keep this editable project as an evaluated direction, not an approved cover.
The proposed replacement is documented in `CONCEPT-v4.md`; it has not been built.

Open `Explore Phone Cover — Product Motion v3.aep`. The main composition is
`Explore Phone Cover — Product Motion v3`: 960×540, 24 fps, 150 frames (6.25 s).
The packaged project contains this cover and its dependencies only. Workflow 1's
v6 project and the previous `creator-phone-v2` cover remain available separately.

The second supplied reference (`Downloads/preview-1 (1).mp4`) informed the clear
statement-to-demonstration rhythm. No reference imagery, branding or interfaces
are included. The paper stage and upright video window are new design decisions.
This intentional composition keeps each complete portrait frame visible, including
the creator and handset, rather than enlarging the portrait into a landscape crop.

## Editing

- `Phone 04 — kinetic heading` contains the four editable text layers. The wording
  is “Your app. On a creator’s phone.” `HEADLINE — fit and motion` fits the combined
  headline into 540 px when either word changes. The underline follows “phone.”
- `CONTROLS — text and accent` exposes the heading/underline Accent colour. The
  phone-focus corners have independently editable mint strokes in their scene comps.
- `Phone 01 — creator and app` and `Phone 02 — second creator` each have their own
  replaceable footage and focus layer. `Phone 03 — loop return` deliberately shares
  creator 1's source to continue into the opening.
- `Media/creator-1.mp4` and `Media/creator-2.mp4` are unmodified copies of the supplied
  format3 videos. Their original audio is disabled in AE and removed from the web cover.
- The portrait window is x=654, y=24, 276.75×492 px. Source framing is fitted for
  720×1280 media. Replacement media with another aspect ratio needs reframing.
- Focus corners use sparse manually aligned position keys, not automatic tracking.
  Realign them when the source changes. Six-frame horizontal slides use fixed rounded
  aperture masks on the main scene layers; ordinary layer positions remain editable.

The source ranges and half-open frame intervals are in `timeline-v3.json`. Creator 1
starts at source frame 66. The closing return ends at source frame 65, so the next
loop continues with frame 66. No still-frame holds, pauses, dissolves or footage
blur are inserted. There is no appended demo because no matching app-demo footage
was supplied for these two examples.

## Render and package

Render the complete main comp using Best Settings and the native output template
`H.264 - Match Render Settings - 40 Mbps`. Then run from the repository root:

```powershell
node scripts/prepare-explore-phone-motion.mjs --render "path/to/native-render.mp4"
```

The packaging script verifies dimensions, frame rate and frame count, removes audio,
checks full decode and fast-start metadata, creates a poster at 1.25 s, and copies
the web video/poster into `Preview/`. It does not generate or flatten the editable
AE artwork; its input is the completed native render.

Following the owner's review, the local development Explore cover points to v2. Production catalogue gates and
the other workflow covers are unchanged. Rendered-media verification is complete;
current browser acceptance is not claimed. Nothing was pushed or deployed.

## Validation

The final compressed cover is 150 frames at 24 fps with no audio, no adjacent
duplicate frames and successful full decode. A 42-frame review at 360×202 px includes
the typography entrance, settled states, both six-frame transitions and loop seam.
Mean full-frame RGB change at the loop is 2.76/255, comparable to the preceding frame
(2.72/255). The source advances by one frame at the seam.

A temporary duplicate changed “app.” to “website.” and changed Accent colour. The
native headline fit retained the layout, and the accent updated both keywords and
the underline. The test comps were removed before saving. AE reports no missing
fonts or footage. The deliverable uses installed Segoe UI Variable Regular Display
and Bold Display fonts.
