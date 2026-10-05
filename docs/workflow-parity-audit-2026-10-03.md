# Workflow 1 / Workflow 3 UI parity audit

Date: 2026-10-03. Scope: Create a Hook and Creator Shows App on Phone.

## Result

Workflow 3 already uses the same three-section UI and recent Edit video redesign as Workflow 1. There is no separate legacy finishing sidebar in Workflow 3. The remaining creation-form difference found in this pass was the missing desktop example prompt; it now has a phone-specific example.

| Area | Shared implementation / result |
| --- | --- |
| Sections | Both owners use `WorkflowCreationPanel` with mounted Create, Edit video and Schedule panels. |
| Create | Both composers use `WorkflowCreationForm`: equal reference squares, waveform audio, instructions, Model/Duration and side-by-side Quality/Videos/Ratio. Both now have desktop-only example placeholders. |
| Edit video | Both use `WorkflowCompositionPanel`: full-width Demo area, horizontal Demo audio selector below, background music, four illustrated subtitle-style choices and Clean selected by default. Repeated visible subtitle explanations are removed; accessible scope/limitations remain. |
| Schedule | Both use `WorkflowSchedulingPanel`: Instagram/TikTok/YouTube icon choices, separate post caption, date and time. No Account field or old Select platform dropdown. |
| Frames | Both use the shared creation stylesheet for aligned desktop control/workspace frames and normal mobile page flow. |

Workflow 3 intentionally retains its separate Inside the phone / App screen input, phone-video labels and app-screen ownership. These are functional differences, not missing UI parity.

## Changes in this pass

- Added a tailored phone-video example as a native textarea placeholder, not prefilled instructions.
- Scoped the desktop-only placeholder styling to the shared Create composer so both workflows behave consistently. Below 1024px the hints are visually hidden; typed instructions are not hidden or rewritten. Schedule captions are outside this selector.
- Updated regression contract source for the phone hint and shared responsive selector. No test suite was executed.

No edits were made in this pass to Recreate, APIs, workers, media owner hooks, scheduling integration, global theme or dependencies. Unrelated worktree changes were preserved.

## Checks performed

- Scoped ESLint passed for `workflow-creation-form.tsx` and `workflow-creation-form.test.mjs`.
- Full TypeScript check (`tsc --noEmit --incremental false`) passed on the final run. An earlier run reported an unrelated `HTMLVideoElement.autoPlay` error in the Explore character card; another concurrent change had corrected it to `autoplay` before the final run. This pass did not edit that file.
- Inspected Workflow 3's Create, Edit video and Schedule sections on the existing local development server at `http://127.0.0.1:3100/explore/creator-phone?preview=1`.
- At 1366×768 CSS pixels, the control and workspace frames each measured 688px high with the same 64px top edge in all three sections.
- The phone instructions value stayed empty. Its example placeholder had opacity 1 on desktop, and opacity 0 / font-size 0px at 390×844. Restored the temporary viewport override afterward.
- Visually inspected the stacked Demo/audio controls, Clean selected, the other three subtitle samples and the absence of the old visible subtitle paragraphs. Inspected Schedule's three named platform choices, separate caption/date/time and absence of the Account field.
- No browser error logs were captured during this inspection. No uploads, generation, transcription, composition, subtitle rendering or scheduling actions were invoked.
- Saved actual local UI captures to `.tmp/phone-workflow-create-2026-10-03.jpg` and `.tmp/phone-workflow-edit-2026-10-03.jpg`.

These are local UI observations and static checks, not production acceptance or an end-to-end generation test. Browser CLI/connector startup issues were worked around using the available in-app browser and the existing development server; no existing server or browser process was stopped.

## Important wiring limitation

UI parity does not mean these workflows generate or publish finished videos. Both remain development-only local preview routes. Generate, Apply edits, Auto subtitles, Background music and Schedule post remain disabled where integration is unavailable. There is no workflow generation/composition callback or rendered-subtitle result binding here. The style cards are illustrative samples, not subtitles rendered from uploaded speech.

The separate standalone generation/subtitle paths and missing workflow integration are documented in `workflow-generation-subtitle-code-audit-2026-10-02.md`. Nothing was deployed in this pass.
