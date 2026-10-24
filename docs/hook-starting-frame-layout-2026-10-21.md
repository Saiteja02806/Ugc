# Starting-frame layout correction, 21 October 2026

The user's screenshots showed broad empty containers around portrait media,
separate source/result sections and a fixed footer with recovery implementation
copy. The new local layout keeps source and result beside each other, constrains
each preview to its media aspect ratio, and puts compact person settings and
actions alongside them. Optional image and animation instructions are collapsed.
Blocking animation errors remain visible outside those collapsed instructions.

The footer is removed. Request checkpoints, status polling, legacy recovery and
duplicate-submission protection are retained. Sound remains off by default and
the explicit approval button still hands an image to the actual starting-frame
input. It does not submit animation. Already reviewed source cuts no longer show
an incorrect "needs review" warning; references awaiting a decision remain gated.

## Local browser checks

- 1020 × 594: initial source/person/actions fit the dialog without internal
  scrolling. The dialog is 720 px wide; its body client/scroll heights both
  measure 489 px. The generation button ends at y=559 inside the viewport.
- The result view expands to 860 px and shows source/result/person together.
  No fixed footer or landscape container surrounds the portrait image.
- 390 × 844: source/result stay together; settings scroll below them. Dialog
  client width and scroll width both measure 354 px, with no horizontal overflow.
  Sound can be toggled on and back off; keyboard focus reaches the controls.
- Simulated image completion → Use as starting frame opens the real video form
  with the approved image, Hook 15's eight-second directions, Seedance 2.5/ReAPI
  and sound off. Original video and face photos are excluded from animation.
  The local adapter disables paid video generation.
- Browser console contains no errors. Sixteen existing UI/client tests pass,
  including stale-input rejection and uncertain-request duplicate protection.
  Scoped ESLint passes. The final production build is recorded separately.

## 22 October local follow-up

The user explicitly keeps deployment paused. A small native model selector now
sits beside the image price; Gemini 3 Pro is the default and Gemini 3.1 Flash the
alternative. No extra settings panel is introduced. Model changes update the
quote and invalidate a previous result; switching to Flash preserves a fifth
photo but blocks a new generation until the user removes it or chooses Pro.
Twenty UI/source-client tests pass, including this limit, model-bound submission,
stale approval rejection and recovery of a completed legacy image. Starting-image
quality is still untested. The development fixture uses local public portraits
and a labelled sample result, so it does not depend on production availability.

Screenshots and a local walkthrough are under
`outputs/hook-layout-correction-2026-10-21/`. The result shown in those screenshots
is explicitly a sample for UI verification, not a new generation.

The real bad image is a separate model scene-preservation failure, documented in
`hook-keyframe-input-adherence-2026-10-21.md`. This layout correction cannot fix
image quality. New role labels and source verification remain visually untested.
No paid inference, production database change or deployment was performed.
