# Explore clip editor clarity

Current behavior and verification limits are recorded in
`docs/explore-workflow-recheck-2026-10-15.md`. The sections below are a historical
change log. Reference-linked content leads with expanded Remix; scratch content
uses a compact Remix entry, and opening it keeps manual text and styling visible.

Follow-up: `docs/explore-workflow-ui-review-2026-10-15.md` records additional
Create/empty Edit/Schedule placement fixes and the current 270 passing checks.

The Talking Head + Demo Create action now reads **Continue** and opens the
Edit overview. That overview always shows separate Hook video and optional
Demo video cards. A missing demo has an Upload demo video action; selected
clips have small, explicitly named Edit hook video / Edit demo video actions.
Replacing or removing a demo uses the existing attachment lifecycle.

Opening a clip editor hides the Create / Edit / Schedule tabs. The selected
clip's tools and live preview occupy the available workspace. Text editing
comes first, Remix stays expanded, and a compact style/audio inspector uses
the space beside the text on wider screens. The clip footer offers Save edits
and Back to videos; combined final preparation stays in the overview.

Shared hook, talking-head and wall-of-text controls and the separate Demo
editor use a single source timeline with draggable start/end handles and
compact numeric times. Pointer and keyboard input preserve a minimum one-second
selection. Saving or uploading disables the handles.

Trim-start changes seek to that start; trim-end changes seek just before the
selected endpoint and pause playback. Text changes seek into the selected text
block if the playhead is outside its timing. Style and volume changes update
the preview without submitting a render. The live player uses selected-clip
duration controls, and small screens keep the preview above the editing tools.
The Library editor returns to its draft preview when editing a rendered clip.

Talking Head finishing options have a combined editing preview when audio or
subtitles are selected. The retained phone workflow also receives current clips,
framing, audio, and caption options in its preview. It remains hidden from Explore
according to the existing product policy.

## Verification

- 210 regression checks pass: 209 workflow/slideshow checks plus the additional
  overview identity regression. The six live-control checks cover playback,
  mute, fullscreen failure/success, listener cleanup, pointer cancellation,
  disabled handles, timed text seeking and local/owned preview identity.
- TypeScript, targeted ESLint and git diff whitespace checks pass.
- The final isolated browser run passed hook/demo/wall text edits, paused trim
  seeks, text color, volume, draggable and keyboard handles, selected-duration
  playback, expanded Remix, compact inspector, independent hook/demo drafts,
  full portrait/landscape/square footage and no overflow across 320–1900px.
  The earlier browser approval limit was resolved for this run.
- In-app browser checks used the real development page for all four workflows.
  Talking Head hook and demo edits independently updated text and paused at
  2.45s/1.95s for 2.5s/2s trim endpoints, with workflow tabs absent. Hook's
  extra Continue to Demo action was removed from its focused editor, and its
  overview previews were shortened to keep Edit actions above the fold.
- Slideshow heading and font edits updated the SVG preview immediately. On
  mobile, both panels stayed visible without horizontal overflow. A 460px
  inherited minimum was removed: the preview uses approximately 320px at
  390×844 and stays visible while editing appearance. Wall's compact preview
  receives the same removal of excess minimum height.
- These changes have not been deployed. Authenticated production acceptance
  of the new behavior against https://www.getugcpilot.com remains pending.

## Explore coverage and production evidence

The four available workflow cards are Talking Head + Demo, Hook video, Wall
of text and Slideshows. Each was inspected on production before comparing its
updated local editor. Production screenshots still show the older layout.
The Build AI influencer entry was also inspected; it is a creator-image tool
with a prompt and image results, rather than this video editor. Quick start
links open the separate AI Studio or Audio generation tools. Their complete
generation journeys are not claimed as verified by this editor change.

Slideshow editing now hides workflow-stage tabs, exposes Remix and text
appearance, places the preview beside a bounded inspector on desktop, keeps
a compact preview/filmstrip above the tools on mobile, and uses a compact save
action. Back to Create/Add slide retain the sequence and reveal Create controls.
Existing explicit save, ownership, ordering and recovery gates are preserved.
Wall of Text now has an explicit return to Create while keeping its clip draft.
Hook's sidebar no longer duplicates Demo source actions already on its card.

The retained phone workflow shares preview improvements but remains hidden.
The Recreate entry redirects to the current Hook/Wall/Slideshow workflows;
it is not an additional active workflow card.

Before/after captures are in `outputs/explore-flow-review-2026-10-15/`:

- `01`–`10`: production Explore, Talking Head, Hook, Wall and Slideshow views.
- `13`: production Build AI influencer entry.
- `19`: local slideshow desktop with an immediate heading/font change.
- `18`: local mobile slideshow styling with the sticky preview visible.
- `20`: local Talking Head overview with Hook and optional Demo cards.
- `21`–`22`: local focused Hook/Demo editors with immediate trim/text changes.

No final render, media generation, scheduling or publishing was submitted by
the verification fixtures. Existing unrelated worktree changes are preserved.

## Follow-up: Remix discovery and consistent editor actions

- Hook, Talking Head and Wall editors show one expanded **Remix text** control
  next to the direct text editor. There is no repeated Remix shortcut, return
  action or second entry point. Mobile keeps the text controls reachable below
  the sticky video preview.
- Demo uses the same trim layout and offers its own Remix form. Its text input,
  request recovery and apply action are scoped to the demo; the opening hook's
  reference is not passed into the standalone Demo editor. Applying a remix
  preserves Demo trim, framing and sound settings.
- All clip editors use **Save edits** and a separate **Back to videos** action.
  Saving Demo edits keeps its editor open, matching Hook. Wall instead says
  **Back to Create**, reflecting its actual destination. Save is primary;
  Schedule is a separate outlined next step, available under the existing draft
  readiness rules. Very narrow screens stack the actions at full width.
- 205 related regression tests pass, including new checks for Remix navigation,
  Demo draft isolation and save-without-render behavior. TypeScript, targeted
  ESLint and whitespace checks pass. Local browser checks covered 1280x720,
  390x844 and 320x800, including Remix focus, preview visibility, return
  destinations, action layout and horizontal overflow.

Screenshots: `outputs/explore-editor-polish-2026-10-15/`. These changes remain
local. Authenticated generation and production acceptance require deployment;
the browser checks did not generate, render or schedule live content.

## Reference-based video editing: Remix first

For Hook, Talking Head and Wall clips linked to a gallery video reference, the
full expanded Remix panel is the first editing task. Remix and Trim occupy the
first desktop row; direct text editing and Text style follow in the second row.
The four panels keep their own height, so the Remix column never stretches to
match Trim and Text style. The panel uses the normal card treatment and a
Video reference label, without an orange accent surface. The smaller Generate
remix action remains visible at 1280x720. Direct text controls are already on
screen, so there is no Edit text manually action.

The original clip reference determines this presentation. A later gallery
selection cannot supply another clip's text. Clips without a linked gallery
reference keep manual editing first. Missing prepared reference text has an
explicit paste-text recovery message; uploaded footage does not borrow gallery
copy. No OCR, generation prompt, business-context or request contract changed.

165 related UI, draft, source-provenance, remix API and text checks pass, with
TypeScript and targeted ESLint passing. Local Hook and Wall browser checks at
1280x720 and 390x844 verified ordering, loaded reference text, direct text
editing, sticky-preview clearance and no horizontal overflow. Browser console
errors: none observed. Screenshots: `outputs/explore-remix-priority-2026-10-15/`.
Live authenticated generation and deployment remain unverified by these local
fixtures; no live generation, rendering or scheduling was submitted.
The dev server reported a Turbopack HMR panic after source edits. A fresh server
start successfully compiled and served the final Wall editor with no browser
console errors. No framework or cache configuration was changed.

## Simplified Remix controls

The owner revised the visual direction: the reference-first order remains,
while the orange accent surface and repeated explanatory copy are removed.
The single Text to remix box accepts both source copy and wording preferences;
there is no separate Additional instructions or overview Options control.
The existing server instructions field receives edited box contents, with its
limit aligned to the source box's 6,000 characters. Unchanged reference text is
not promoted to instructions. Legacy unsent guidance is visible in the same
box, and accepted requests replay their original payload without modification.

The desktop editor uses a purposeful two-column grid: Remix beside Trim, then
direct text editing beside Text style. The inspector groups compact fields in
two columns where space allows.
Important loading, missing-source and failure states remain visible; the usual
helper lines and local-preview note are removed. Generate remains disabled in
the local fixture and its reason is available on the button.

205 related tests pass, including single-box guidance, long-input bounds,
legacy guidance visibility and exact accepted-request recovery. TypeScript and
targeted ESLint pass. At 1280x720 the Remix panel is approximately 350px wide
(previously 525px), with Trim moved left accordingly. Text-style fields use two
compact columns. At 390x844 the source field remains reachable below the sticky
preview without horizontal overflow. Final screenshots are in
`outputs/explore-remix-compact-2026-10-15/`.

The development preview required a compiler restart after slow hydration and
reported a React pre-mount state-update warning during startup. The final
screen rendered and its navigation checks completed; this is not production
acceptance. No live generation, render, schedule or deployment was performed.

## Layout correction: one Remix entry, four editing areas

The direct text editor is no longer nested inside the Remix grid item for a
reference-based clip. Nesting forced the entire left column to take the height
of both Trim and Text style, creating unused vertical space and a duplicate
Remix navigation action. The editor now renders four independent areas:

- Remix text and Trim on the first desktop row.
- Text on video and Text style on the second desktop row.

The Remix heading is the only Remix entry. Its Generate action is compact on
desktop while retaining a 44px mobile target. The manual text area remains
visible directly below Remix, without a second “Remix text”, “Edit text
manually”, or “Back to text” control.

Validation for this correction: TypeScript and targeted ESLint pass; 32
reference-text and common-editor checks pass, including the single-entry
assertion and provenance handling. The isolated browser fixture could not
launch in this Windows sandbox because Edge could not create its temporary
profile, so the final visual browser pass must run in a normal local or CI
browser before production acceptance.
