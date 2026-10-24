# Explore workflow recheck — 15 October 2026

This follow-up checks the four public Explore workflows: Talking Head + Demo,
Hook video, Wall of text and Slideshows. It supersedes earlier statements that
the UI was fully verified. The changes are local and have not been deployed.

## Additional defects corrected

1. **Returning to Edit after final preparation removed edit entry points.**
   Hook's `clipStageVisible` depended on whether a combined output existed.
   Once prepared, Edit replaced the Hook and Demo cards with the older sequence
   preview, which offered no clip edit buttons. Edit now retains both clip
   cards. Schedule retains the exact final output; editing a clip invalidates
   that output under the existing rules. A regression covers Schedule → Back
   to Edit → either clip editor, source identity retention and invalidation.
2. **Opening optional Remix hid manual text fields.** The shared Remix control
   now keeps manual text and its style controls mounted and visible while
   Remix is open in an editor. This applies to scratch videos, Demo clips and
   scratch slideshow slides. The older non-editor mode retains its behavior.
3. **Slideshow source label said Video reference.** The shared label now says
   Slide reference for slideshow inputs and Video reference for videos.
4. **Business context implied that missing context was saved.** The status now
   reports Loading, Not set, Sign in, Preview or Unavailable as appropriate.
   Only verified ready context can report Saved in Settings. Generating still
   requires ready context and source text.

## Direct browser evidence

The screenshots below predate the subsequent overview/button cleanup described
at the end of this report. They must not be presented as visual verification of
that latest cleanup.

All local fixtures use the actual editor components. They do not submit paid
generation, final rendering, Library saves, scheduling or publication.

| Workflow | Directly checked | Evidence |
| --- | --- | --- |
| Wall of text | 1280×720 reference-first layout; internal scrolling leaves footer and preview visible; at 390×844 entered text appears in the preview with no horizontal overflow | `outputs/explore-recheck-2026-10-15/wall-reference-top-1280.png`, `wall-reference-scrolled-1280.png`, `wall-mobile-edit-390.png` |
| Hook video | Edit hook opens focused tools with no visible workflow tabs; footer has Back to videos and Save edits; a 4.2s trim endpoint seeks to 4.15s and pauses; new overlay text appears immediately | `outputs/explore-recheck-2026-10-15/hook-focused-1280.png` |
| Talking Head + Demo | Existing isolated fixture: optional Remix opening retains manual text and Text Style; Hook 2.5s endpoint seeks to 2.45s; Demo 2s endpoint seeks to 1.95s; their text changes stay independent; reopening Hook retains its 2.5s trim and copy; no overflow at 1280×720 and 320×700 | `outputs/explore-recheck-2026-10-15/talking-head-demo-edit-1280.png`, `talking-head-hook-mobile-320.png` |
| Slideshows | Actual local page: Slide reference label, immediate heading overlay, no workflow tabs in Edit, compact Save slideshow footer; at 390×844 preview and filmstrip remain visible while editing tools scroll | `outputs/explore-recheck-2026-10-15/slideshow-desktop-1280.png`, `slideshow-mobile-390.png` |

The Talking Head full development page rendered but its Webpack client bundle
failed to load with an Invalid or unexpected token error. Its real-component
isolated fixture was used for the interaction checks above. The default
Turbopack startup also failed while spawning the CSS processor; the supported
Webpack development mode served the other workflow pages. No framework
configuration was changed.

## Acceptance still outstanding

- The production Explore route redirected this browser session to sign-in.
  The authenticated production Create → Edit → final preparation → Schedule
  journey is not verified by these local checks.
- Automatic approval review later blocked a Creative Assets browser click
  because the account hit its usage limit. No alternate browser mechanism was
  used to bypass it. The final Edit-return fix is regression-tested but was
  not re-captured in the browser after that block.
- Talking Head's uploaded video reference does not carry a transcript identity
  into the text editor. Automatic extraction and persistence of its reference
  text remain a product gap. Its optional Remix explicitly accepts the user's
  own text. Demo never borrows the opening Hook's reference copy.
- These checks assess implementation and visible interaction. They do not
  replace observation of first-time users completing the tasks unaided.

## Validation

The repeat suite covers source selection/replacement, focused editors, playback,
trim handles, timed overlays, Remix source identity, independent Demo drafts,
slide order/recovery, generation recovery and Schedule navigation. Results are
recorded in `outputs/explore-recheck-tests-2026-10-15.log`: **262 passed, 0
failed**. Targeted ESLint, TypeScript (`tsc --noEmit --incremental false`) and
`git diff --check` also passed after the final source changes.

## Follow-up: duplicate overview Remix and button sizes

The Hook Demo overview still mounted a second Remix form through
`remixOverviewTarget`, even while its focused clip editor had its own Remix.
The overview section, portal target, editor prop and associated layout CSS
are removed. Hook overview now presents the clips and composition settings;
Edit hook video opens its single text/Remix editor. The inactive editor renders
no hidden Remix form into another workflow step.

Audio upload, Background Audio Library and saved-audio triggers now use compact
34px desktop controls with content-sized widths, 12px labels and wrapping rows.
Talking Head's custom audio attachment control follows the same dimensions.
Coarse-pointer devices retain a minimum 44px touch target. Hook/Demo card Edit
and Change actions also follow the existing Talking Head 34px desktop treatment.
Save and Schedule retain the larger primary-action treatment.

| Public workflow | Duplicate-control check and current change |
| --- | --- |
| Talking Head + Demo | Uses the shared focused clip editor; no overview Remix form. Shared audio triggers and the custom demo-audio button are compact. |
| Hook video | Removed the second overview Remix form and its Add text manually action. Focused Hook and Demo editors each retain their own Remix. Card Edit/Change actions and audio triggers are compact. |
| Wall of text | Remix remains inside Edit only. The same compact audio controls apply. Reference-backed Remix remains expanded; scratch footage keeps optional Remix beside manual text. |
| Slideshows | Remix remains scoped to the selected slide in Edit; no second overview form. Existing compact inspector and slide actions remain in place. |

Regression checks now assert that Hook and Wall overview cards have no Remix,
each focused editor has exactly one, applied text and trim survive leaving and
reopening Edit, and inactive editors render nothing. Existing reference/scratch,
independent Demo, audio ownership, replacement and Schedule checks also pass.

Latest suite: **328 passed, 0 failed**, recorded in
`outputs/explore-overview-cleanup-tests-2026-10-15.log`. Browser screenshots for
this follow-up remain outstanding because the earlier browser session hit the
account usage limit. Authenticated production acceptance and Talking Head's
uploaded-reference transcript gap remain outstanding as described above.
