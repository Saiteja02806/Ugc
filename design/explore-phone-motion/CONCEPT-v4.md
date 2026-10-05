# Workflow 3 — proposed screen-to-phone concept

Status: implemented for local review, October 3, 2026. The native AE project and
silent nine-second preview are complete. The rejected v3 is retained for comparison.
The earlier builds are preserved. The latest local Explore preview selects v7,
which uses the supplied Cal AI gym creator and framed Cal AI iPhone at natural
proportions. The handoff is realigned to the source's four-second phone pose.
Decorative outlines stay disabled and “Your app.” carries through the loop boundary.
Production catalogue gates are unchanged. `README.md` and `timeline-v7.json` describe
the latest build; the versioned README files record earlier implementations.

## What needs to improve

V3 gave most of the canvas to a static headline and a light stage. The small portrait
window changed creators without adding another piece of information. Focus corners
and a horizontal slide were visible effects, but they did not explain the workflow.

The replacement should show one transformation: an app screen becomes the screen in
a creator's handset, then the real creator video provides the evidence. Motion has a
visible destination and a reason to happen. The second clip provides variety without
restarting the same explanation.

## Art direction

- Use Explore's actual charcoal background `#1f1f1f`, off-white type and restrained
  orange `#ff7045` accents. These values are present in `app/globals.css`.
- Keep the actual app artwork intact. A light app interface may stay light inside
  the screen; the surrounding composition stays dark.
- Use a substantial, crisp app surface and a thin handset contour. A short perspective
  move supplies depth. Avoid a permanent text column beside a narrow portrait strip.
- Use a clear sans-serif with phrase reveals and deliberate scale changes. This gives
  workflow 3 its own identity alongside workflow 1's editorial serif.
- Make the frame feel filled through a designed composition. Test a face-and-phone
  crop at the final 360×202 card size; neither subject should disappear to fill a
  landscape box. Do not add blurred duplicate footage or empty letterbox bands.
- Keep footage running, silent, autoplaying and looping, with no pause/resume controls.

## Proposed nine-second sequence

Timing is a design target, not a finalized edit decision.

| Time | Picture and motion | Copy and purpose |
| --- | --- | --- |
| 0–1.5 s | A clean app screen enters on the dark stage. A restrained orange contour reveals its edges; a small perspective tilt settles. | **Your app.** Identifies the input. |
| 1.5–3 s | The creator footage opens behind the screen. The same app surface moves, scales and changes perspective until its four corners meet the handset screen. It then hands off to the moving footage. | **On their phone.** Completes the promise once. |
| 3–6 s | The creator presents the phone in the real supplied example. The composited screen and outline recede so the footage can carry the message. | **Create your video.** Identifies the output; then lets the footage breathe. |
| 6–8 s | A short second creator example arrives through a shared handset contour, without replaying the title sequence. | No repeated headline. Variety is conveyed visually. |
| 8–9 s | The handset contour turns edge-on; the opening app plane unfolds from that edge and returns to its first arrangement. The edge-on moment conceals the change between the two different apps. | Opening copy returns with the next loop. |

The first clip is the main demonstration. The second is an alternate app/creator
example: the supplied clips show different apps, so the edit must not suggest that
both display the same uploaded screen. Its entry needs a visual match, not a claim
of an identical app. Keep the explanatory wording to the three short phrases above.

## What After Effects contributes

Use one editable app precomposition, native text/shape layers, animated masks and a
four-corner perspective fit. Animate the app plane toward the real handset rather
than applying a generic zoom to the entire frame. Use a short acceleration followed
by a controlled settle; keep the evidence sharp. Native text animators can reveal
whole phrases in coordination with that move.

Adobe documents Corner Pin tracking for fitting an image or clip into a moving
screen, and native text animation by characters, words or lines:

- [Tracking and stabilization](https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/track-motion/tracking-stabilizing-motion-cs5.html)
- [Animating text](https://helpx.adobe.com/after-effects/desktop/animating-text/text-animation/animating-text.html)
- [Controlling speed between keyframes](https://helpx.adobe.com/after-effects/desktop/animate-in-after-effects/speed-between-keyframes/speed.html)

Corner Pin and CC Power Pin were found in the installed AE effect catalogue. The
current connector has no dedicated automatic motion-tracking operation. A short,
stable handset interval can be aligned with manual corner keys; phone movement,
screen glare and finger occlusion must be evaluated in the transition test. This is
a feasible construction plan, not a claim that automatic tracking is already solved.

## Reference lessons

The supplied `preview-1 (1).mp4` is the stronger reference for promise followed by
visible product evidence. The opening typography in `preview-1.mp4` suggests useful
scale contrast, but its small technical text and abstract graphics would be difficult
to read in a workflow card. Do not copy their layouts, branding or media.

[Ordinary Folk's Webflow Ecommerce project](https://www.ordinaryfolk.co/project/webflow-ecommerce)
describes combining 2D/3D depth while keeping the actual UI and message central. That
is the relevant principle here. This research reviewed the project's written process;
it does not claim to have watched its complete external film.

## Assets and next review

The owner supplied a matching clean screenshot during implementation:
`Downloads/Screenshot_2026-09-26_205043.png_20261003001930.jpg`, packaged unchanged
as `Media/app-screen.jpg` (326×637). The app artwork is a supplied raster asset;
the enclosing surface, strokes, text, animation and controls are native AE elements.
The two format3 videos provide the real creator examples. Workflow 1's unrelated
gaming demo is not inserted.

Before another full render, prepare three representative stills at the actual card
size: opening app plane, screen fitted to the phone, and creator result. Then test
only the two-second screen transfer with real footage. Assess legibility, phone/face
framing, perspective alignment, occlusion and connection to dark Explore. Those
results should determine the final edit, rather than committing to another complete
cover before its central visual idea has been checked.

If matching screen artwork is unavailable, the honest fallback is a close-up of the
existing handset followed by a carefully framed creator reveal. That can improve
the edit, but it will have less visual depth than the proposed screen transfer.
