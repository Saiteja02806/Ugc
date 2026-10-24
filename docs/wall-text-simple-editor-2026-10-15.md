# Wall text editing simplification — 15 October 2026

The Wall Edit step now puts the tasks used most often first: Remix text and Your
wall of text, beside the live preview. Trim/style/audio are reached with the
compact **Edit** button below the text. **Back to text** returns to the simple
view. The same editor, draft state and player stay mounted across this switch.
Returning from Create or Schedule starts with the simple text view and retains
the existing draft.
Reference Remix remains expanded for a linked reference; scratch editing keeps
manual copy first and a nearby optional Remix entry.

| Capability | Previous location | Current location |
| --- | --- | --- |
| Remix and manual text | Beside advanced inspector | Default Edit view |
| Live video/text/audio preview | Preview pane | Same mounted preview pane in both modes |
| Trim and text appearance | Always visible | Edit → advanced tools |
| Whole-video audio upload/library/playback/volume | Always-visible Sound group | Edit → advanced Sound group |
| Save, Back to Create and Schedule | Stable editor footer | Same footer/actions/readiness |
| Wall text timing | Per-block start/end inputs and timing badges | Full selected clip; no timing controls |

Every Wall text block now spans 0 to the selected clip's end. Normalization
applies to local/server recovery, manual changes, applied Remix and both shorter
and longer trims. Existing Wall blocks and styles/positions are retained. Hook
and demo text keep their independent timing. No media generation or rendering is
submitted by opening advanced tools or returning to text editing.

Local validation: 96 functional tests passed across common editor, live controls
and demo-state suites; TypeScript and targeted ESLint passed. Coverage includes
simple/advanced round trips, preserved text and preview, hidden Wall timing and
style UI, full-duration text on trim extension/contraction, audio-clock behavior
and unchanged Hook/demo timing.

Fresh screenshots, constrained-laptop scroll/occlusion checks and authenticated
production acceptance remain pending. Browser startup was already blocked in this
session and escalation review hit a usage limit; no deployment or production
write was performed. This report describes local code, not a deployed UI result.
